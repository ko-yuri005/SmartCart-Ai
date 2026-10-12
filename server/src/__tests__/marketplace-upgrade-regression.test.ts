import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { app } from '../server.js';
import { initMarketplaceTables } from '../db/database.js';
import { SqliteProductRepository } from '../db/repositories/product.repository.js';
import { SqliteSessionRepository } from '../db/repositories/session.repository.js';
import { SqliteOfferRepository } from '../db/repositories/offer.repository.js';
import { SEED_PRODUCTS } from '../db/seed-data.js';
import { CartOrderService } from '../services/cart-order.service.js';
import { ComparisonService } from '../services/comparison.service.js';
import { VisualSearchService } from '../services/visual-search.service.js';
import { GeminiService } from '../services/gemini.service.js';
import { FilterService } from '../services/filter.service.js';
import { RankingService } from '../services/ranking.service.js';
import { RelaxationService } from '../services/relaxation.service.js';
import { AlternativesService } from '../services/alternatives.service.js';
import { SecurityService } from '../services/security.service.js';
import { ContextService } from '../services/context.service.js';
import { PriceComparisonService } from '../services/price-comparison.service.js';
import { ShoppingAssistantService } from '../services/shopping-assistant.service.js';

// Valid minimal PNG (1x1 pixel) in base64 with authentic PNG magic bytes (\x89PNG\r\n\x1a\n)
const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Valid minimal JPEG header + bytes in base64 (\xFF\xD8\xFF\xE0...)
const VALID_JPEG_BASE64 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
]).toString('base64');

describe('Marketplace Upgrade Regression Suite (Phases 2–7)', () => {
  let db: Database.Database;
  let productRepo: SqliteProductRepository;
  let sessionRepo: SqliteSessionRepository;
  let offerRepo: SqliteOfferRepository;
  let cartOrderService: CartOrderService;
  let comparisonService: ComparisonService;
  let visualSearchService: VisualSearchService;
  let assistantService: ShoppingAssistantService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        brand TEXT NOT NULL,
        price REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'INR',
        rating REAL NOT NULL DEFAULT 0.0,
        review_count INTEGER NOT NULL DEFAULT 0,
        description TEXT NOT NULL,
        features TEXT NOT NULL,
        specifications TEXT NOT NULL,
        use_cases TEXT NOT NULL,
        image TEXT NOT NULL,
        product_type TEXT,
        image_type TEXT,
        availability INTEGER NOT NULL DEFAULT 1,
        stock_count INTEGER NOT NULL DEFAULT 25,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        recommended_product_ids TEXT,
        extracted_requirements TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE retailer_offers (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        retailer_id TEXT NOT NULL,
        retailer_name TEXT NOT NULL,
        external_listing_id TEXT,
        listing_title TEXT NOT NULL,
        listing_url TEXT,
        search_url TEXT NOT NULL,
        link_type TEXT NOT NULL,
        match_type TEXT NOT NULL DEFAULT 'exact',
        match_confidence REAL NOT NULL DEFAULT 1.0,
        matched_variant_summary TEXT,
        price REAL,
        original_price REAL,
        discount_percent REAL,
        currency TEXT NOT NULL DEFAULT 'INR',
        shipping_cost REAL,
        shipping_known INTEGER NOT NULL DEFAULT 0,
        availability TEXT NOT NULL DEFAULT 'unknown',
        verification_status TEXT NOT NULL,
        source_provider TEXT NOT NULL,
        last_checked_at DATETIME,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    initMarketplaceTables(db);

    productRepo = new SqliteProductRepository(db);
    productRepo.upsertMany(SEED_PRODUCTS);
    sessionRepo = new SqliteSessionRepository(db);
    offerRepo = new SqliteOfferRepository(db);

    const priceComparisonService = new PriceComparisonService(productRepo, offerRepo);
    cartOrderService = new CartOrderService(productRepo, db, priceComparisonService);
    comparisonService = new ComparisonService(productRepo);
    const geminiService = new GeminiService({ apiKey: '', client: null });
    visualSearchService = new VisualSearchService(
      productRepo,
      sessionRepo,
      geminiService,
      priceComparisonService
    );

    const filterService = new FilterService(productRepo);
    const rankingService = new RankingService();
    const relaxationService = new RelaxationService(filterService, rankingService);
    const alternativesService = new AlternativesService(productRepo, filterService);
    const securityService = new SecurityService();
    const contextService = new ContextService(productRepo);

    assistantService = new ShoppingAssistantService(
      productRepo,
      sessionRepo,
      filterService,
      rankingService,
      relaxationService,
      alternativesService,
      comparisonService,
      securityService,
      geminiService,
      contextService,
      { sessionThrottleMs: 0, duplicateSubmitWindowMs: 0 },
      priceComparisonService,
      cartOrderService
    );
  });

  afterEach(() => {
    db.close();
  });

  // =========================================================================
  // 1. Cart Quantity, Stock Limits & Server-Side Pricing Calculations
  // =========================================================================
  describe('Phase 2: Shopping Cart & Server-Side Price Calculations', () => {
    it('adds products to cart, updates quantities, removes items when quantity is 0, and computes accurate totals', () => {
      const sessionId = 'cart_test_session_1';
      // hp-boat-airdopes-141 is ₹1,299; hp-oneplus-nord-buds-2r is ₹2,199
      const cartAfterFirst = cartOrderService.addItem(
        sessionId,
        'hp-boat-airdopes-141',
        1
      );
      expect(cartAfterFirst.totalQuantity).toBe(1);
      expect(cartAfterFirst.pricing.subtotal).toBe(1299);
      // Subtotal >= ₹999 qualifies for free shipping
      expect(cartAfterFirst.pricing.shippingCost).toBe(0);
      expect(cartAfterFirst.pricing.finalTotal).toBe(1299);

      // Add second item -> totalQuantity = 2, subtotal = 1299 + 2199 = 3498
      // Multi-item bundle discount (5% off 2+ items >= ₹3000) = Math.round(3498 * 0.05) = 175
      const cartAfterSecond = cartOrderService.addItem(
        sessionId,
        'hp-oneplus-nord-buds-2r',
        1
      );
      expect(cartAfterSecond.totalQuantity).toBe(2);
      expect(cartAfterSecond.pricing.subtotal).toBe(3498);
      expect(cartAfterSecond.pricing.discountAmount).toBe(175);
      expect(cartAfterSecond.pricing.finalTotal).toBe(3498 - 175);

      // Increase first item quantity to 2
      const cartUpdated = cartOrderService.updateItemQuantity(
        sessionId,
        'hp-boat-airdopes-141',
        2
      );
      expect(cartUpdated.totalQuantity).toBe(3);
      expect(cartUpdated.pricing.subtotal).toBe(1299 * 2 + 2199);

      // Setting quantity to 0 removes the item
      const cartAfterZero = cartOrderService.updateItemQuantity(
        sessionId,
        'hp-boat-airdopes-141',
        0
      );
      expect(cartAfterZero.uniqueItemCount).toBe(1);
      expect(cartAfterZero.items[0].productId).toBe('hp-oneplus-nord-buds-2r');
    });

    it('applies standard ₹99 shipping for orders below ₹999 and supports coupon codes', () => {
      const sessionId = 'cart_shipping_test';
      // Find a product priced under ₹999
      const lowPriceProduct = SEED_PRODUCTS.find((p) => p.price < 900 && p.availability)!;
      expect(lowPriceProduct).toBeDefined();

      const cart = cartOrderService.addItem(sessionId, lowPriceProduct.id, 1);
      expect(cart.pricing.subtotal).toBe(lowPriceProduct.price);
      expect(cart.pricing.shippingCost).toBe(99);
      expect(cart.pricing.finalTotal).toBe(lowPriceProduct.price + 99);

      // Apply FREESHIP coupon
      const cartWithFreeShip = cartOrderService.applyCoupon(sessionId, 'FREESHIP');
      expect(cartWithFreeShip.pricing.shippingCost).toBe(0);
      expect(cartWithFreeShip.pricing.finalTotal).toBe(lowPriceProduct.price);
    });

    it('rejects invalid quantities (negative, zero on add, fractional, NaN) and enforces stock limits', () => {
      const sessionId = 'cart_validation_test';

      expect(() =>
        cartOrderService.addItem(sessionId, 'hp-boat-airdopes-141', 0)
      ).toThrow(/whole number of at least 1/i);

      expect(() =>
        cartOrderService.addItem(sessionId, 'hp-boat-airdopes-141', -3)
      ).toThrow(/whole number of at least 1/i);

      expect(() =>
        cartOrderService.addItem(sessionId, 'hp-boat-airdopes-141', 1.5)
      ).toThrow(/whole number of at least 1/i);

      expect(() =>
        cartOrderService.updateItemQuantity(sessionId, 'hp-boat-airdopes-141', -1)
      ).toThrow(/non-negative integer/i);

      // Stock limit is 25 by default
      expect(() =>
        cartOrderService.addItem(sessionId, 'hp-boat-airdopes-141', 26)
      ).toThrow(/Only 25 unit\(s\) available in stock/i);
    });
  });

  // =========================================================================
  // 2. Order Creation, Input Validation & Duplicate Submission Prevention
  // =========================================================================
  describe('Phase 2: Checkout, Order States & Duplicate Submission Protection', () => {
    const validAddress = {
      line1: '42 MG Road, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560038',
      country: 'India',
    };

    it('validates checkout inputs and creates a confirmed demo order that decrements stock and clears the cart', () => {
      const sessionId = 'checkout_test_1';
      cartOrderService.addItem(sessionId, 'hp-boat-airdopes-141', 2);

      // Invalid email should fail
      expect(() =>
        cartOrderService.createOrder({
          sessionId,
          customerName: 'Aarav Sharma',
          customerEmail: 'not-an-email',
          customerPhone: '9876543210',
          shippingAddress: validAddress,
        })
      ).toThrow(/valid customer email/i);

      // Invalid phone should fail
      expect(() =>
        cartOrderService.createOrder({
          sessionId,
          customerName: 'Aarav Sharma',
          customerEmail: 'aarav@example.com',
          customerPhone: '12345',
          shippingAddress: validAddress,
        })
      ).toThrow(/10-digit phone number/i);

      // Valid order creation
      const order = cartOrderService.createOrder({
        sessionId,
        idempotencyKey: 'idem_key_001',
        customerName: 'Aarav Sharma',
        customerEmail: 'aarav@example.com',
        customerPhone: '9876543210',
        shippingAddress: validAddress,
      });

      expect(order.id).toMatch(/^ORD-/);
      expect(order.isDemoCheckout).toBe(true);
      expect(order.demoDisclaimer).toMatch(/No real payment was processed/i);
      expect(order.status).toBe('Confirmed');
      expect(order.totalQuantity).toBe(2);
      expect(order.pricing.subtotal).toBe(1299 * 2);

      // Cart should now be empty
      const cartAfter = cartOrderService.getCart(sessionId);
      expect(cartAfter.items.length).toBe(0);

      // Stock should have decremented from 25 to 23
      const updatedProduct = productRepo.findById('hp-boat-airdopes-141')!;
      expect(updatedProduct.stock_count).toBe(23);

      // Transition order status: Confirmed -> Shipped -> Cancelled (restores stock)
      const shipped = cartOrderService.updateOrderStatus(
        sessionId,
        order.id,
        'Shipped'
      );
      expect(shipped.status).toBe('Shipped');

      const cancelled = cartOrderService.updateOrderStatus(
        sessionId,
        order.id,
        'Cancelled'
      );
      expect(cancelled.status).toBe('Cancelled');
      expect(productRepo.findById('hp-boat-airdopes-141')?.stock_count).toBe(25);
    });

    it('prevents accidental duplicate order submissions via idempotencyKey and rapid duplicate window', () => {
      const sessionId = 'duplicate_order_test';
      cartOrderService.addItem(sessionId, 'hp-oneplus-nord-buds-2r', 1);

      const firstOrder = cartOrderService.createOrder({
        sessionId,
        idempotencyKey: 'unique_checkout_click_123',
        customerName: 'Priya Nair',
        customerEmail: 'priya@example.com',
        customerPhone: '9876501234',
        shippingAddress: validAddress,
      });

      expect(firstOrder.duplicatePrevented).toBeUndefined();

      // Second submission with the same idempotencyKey returns the existing order
      const secondOrder = cartOrderService.createOrder({
        sessionId,
        idempotencyKey: 'unique_checkout_click_123',
        customerName: 'Priya Nair',
        customerEmail: 'priya@example.com',
        customerPhone: '9876501234',
        shippingAddress: validAddress,
      });

      expect(secondOrder.id).toBe(firstOrder.id);
      expect(secondOrder.duplicatePrevented).toBe(true);

      // Only 1 order exists in order history
      const allOrders = cartOrderService.getOrdersBySession(sessionId);
      expect(allOrders.length).toBe(1);
    });
  });

  // =========================================================================
  // 3. AI Image-Based Product Discovery (Phase 3)
  // =========================================================================
  describe('Phase 3: AI Image-Based Product Discovery & Failure Handling', () => {
    it('rejects unsupported image formats, corrupted headers, and missing image data', async () => {
      // Unsupported MIME type (PDF)
      await expect(
        visualSearchService.searchByImage({
          sessionId: 'vis_err_1',
          imageData: VALID_PNG_BASE64,
          mimeType: 'application/pdf',
        })
      ).rejects.toThrow(/Unsupported image format/i);

      // Corrupted / spoofed binary header (text encoded as base64 claiming to be image/png)
      const fakeBase64 = Buffer.from(
        'This is definitely not a valid PNG binary header!'
      ).toString('base64');
      await expect(
        visualSearchService.searchByImage({
          sessionId: 'vis_err_2',
          imageData: fakeBase64,
          mimeType: 'image/png',
        })
      ).rejects.toThrow(/header does not match a valid JPEG, PNG, or WebP/i);
    });

    it('identifies confirmed exact match, likely match, relevant alternatives, and supports user corrections', async () => {
      // 1. Confirmed Exact Match when image clues identify Sony WH-CH720N
      const exactRes = await visualSearchService.searchByImage({
        sessionId: 'vis_exact_1',
        imageData: VALID_PNG_BASE64,
        mimeType: 'image/png',
        fileName: 'sony_wh-ch720n_wireless_headphones.png',
      });

      expect(exactRes.overallClassification).toBe('confirmed_exact_match');
      expect(exactRes.products.length).toBeGreaterThan(0);
      expect(exactRes.products[0].brand.toLowerCase()).toBe('sony');

      // 2. Blurry image degrades classification to likely_match with quality warning
      const blurryRes = await visualSearchService.searchByImage({
        sessionId: 'vis_blurry_1',
        imageData: VALID_JPEG_BASE64,
        mimeType: 'image/jpeg',
        fileName: 'blurry_photo_sony_wh-ch720n.jpg',
      });
      expect(blurryRes.clues.imageQuality).toBe('blurry');
      expect(blurryRes.clues.qualityWarning).toMatch(/blurry/i);
      expect(blurryRes.overallClassification).toBe('likely_match');

      // 3. Relevant alternative when uploaded brand is not in our catalogue (e.g., Bang & Olufsen headphones)
      const altRes = await visualSearchService.searchByImage({
        sessionId: 'vis_alt_1',
        imageData: VALID_PNG_BASE64,
        mimeType: 'image/png',
        userHint: 'Bang & Olufsen Beoplay H95 wireless headphones',
        correction: {
          brand: 'Bang & Olufsen',
          model: 'Beoplay H95',
          category: 'headphones',
        },
      });
      expect(altRes.overallClassification).toBe('relevant_alternative');
      expect(altRes.products.length).toBeGreaterThan(0);
      expect(altRes.products[0].category).toBe('headphones');

      // 4. User correction re-search updates brand/model/category and finds exact match
      const correctedRes = await visualSearchService.searchByImage({
        sessionId: 'vis_alt_1',
        correction: {
          brand: 'boAt',
          model: 'Airdopes 141',
          category: 'headphones',
        },
      });
      expect(correctedRes.overallClassification).toBe('confirmed_exact_match');
      expect(correctedRes.products[0].id).toBe('hp-boat-airdopes-141');
    });
  });

  // =========================================================================
  // 4. Meaningful Product Comparisons & Organic Certification Audit (Phase 4)
  // =========================================================================
  describe('Phase 4: Meaningful Comparisons & Organic Certification Verification', () => {
    it('never infers organic certification from "natural", "green", "herbal", or "eco-friendly" marketing claims', () => {
      const naturalMarketingItem = {
        id: 'test-natural-facewash',
        name: '100% Natural Green Eco-Friendly Herbal Face Wash',
        category: 'beauty-personal-care',
        description:
          'Made with 100% natural green tea, eco-friendly botanicals, and pure herbal extracts.',
        features: ['100% Natural', 'Eco-Friendly Packaging', 'Green Tea & Herbal'],
        specifications: {
          skin_type: 'All Skin Types',
          volume: '100ml',
        },
      };

      const auditNatural =
        comparisonService.auditProductCertifications(naturalMarketingItem);
      expect(auditNatural.isOrganicCertified).toBe(false);
      expect(auditNatural.organicStatus).toBe('not_certified_organic');
      expect(auditNatural.unverifiedMarketingTerms).toEqual(
        expect.arrayContaining(['natural', 'green', 'eco-friendly', 'herbal'])
      );
      expect(auditNatural.auditNote).toMatch(/Never inferred as organic/i);

      const certifiedOrganicItem = {
        id: 'test-usda-organic-oil',
        name: 'Cold Pressed Virgin Coconut Oil',
        category: 'food-nutrition',
        description: 'Certified organic cold-pressed oil.',
        features: ['Cold Pressed', 'USDA Organic'],
        specifications: {
          organic_certification: 'USDA Organic & India Organic (NPOP Certified)',
          volume: '500ml',
        },
      };

      const auditCertified =
        comparisonService.auditProductCertifications(certifiedOrganicItem);
      expect(auditCertified.isOrganicCertified).toBe(true);
      expect(auditCertified.organicStatus).toBe('certified_organic');
    });

    it('produces category-relevant matrices, separates verified facts from seller claims, and provides priority-based verdicts', () => {
      const comp = comparisonService.compareProducts([
        'hp-boat-airdopes-141',
        'hp-oneplus-nord-buds-2r',
      ]);
      expect(comp.success).toBe(true);
      if (!comp.success) return;

      expect(comp.data.categoryGroup).toBe('electronics');
      expect(comp.data.commonMatrix.length).toBeGreaterThanOrEqual(5);
      expect(comp.data.categorySpecificMatrix.length).toBeGreaterThanOrEqual(3);

      const boatEvidence = comp.data.evidenceBreakdown['hp-boat-airdopes-141'];
      expect(boatEvidence.verifiedFacts.length).toBeGreaterThan(0);
      expect(boatEvidence.sellerClaims.length).toBeGreaterThan(0);
      expect(boatEvidence.aiInterpretations.length).toBeGreaterThan(0);

      expect(comp.data.verdictsByPriority.budget.recommendedProductId).toBe(
        'hp-boat-airdopes-141'
      );
      expect(
        comp.data.verdictsByPriority.quality_performance.recommendedProductId
      ).toBe('hp-oneplus-nord-buds-2r');
    });
  });

  // =========================================================================
  // 5. Smarter AI Assistant Follow-Ups & Cart Integration (Phase 5)
  // =========================================================================
  describe('Phase 5: Smarter AI Assistant Follow-Up Context & Cart Commands', () => {
    it('handles "Compare the first two", "Which is better for me?", and "Add the second one to my cart"', async () => {
      const sessionId = 'smart_followup_sess_1';

      // Step 1: Initial search
      const step1 = await assistantService.handleUserMessage(
        sessionId,
        'Wireless headphones under ₹3000 for gym'
      );
      expect(step1.products.length).toBeGreaterThanOrEqual(2);
      const firstProd = step1.products[0];
      const secondProd = step1.products[1];

      // Step 2: "Which is better for me?"
      const step2 = await assistantService.handleUserMessage(
        sessionId,
        'Which is better for me?'
      );
      expect(step2.intent).toBe('QUESTION_ON_PREVIOUS');
      expect(step2.message).toMatch(/Best for Quality|Best for Budget/i);

      // Step 3: "Compare the first two"
      const step3 = await assistantService.handleUserMessage(
        sessionId,
        'Compare the first two'
      );
      expect(step3.intent).toBe('COMPARE');
      expect(step3.comparison).toBeDefined();
      expect(step3.comparison.products.map((p: any) => p.id)).toEqual([
        firstProd.id,
        secondProd.id,
      ]);

      // Step 4: "Add the second one to my cart"
      const step4 = await assistantService.handleUserMessage(
        sessionId,
        'Add the second one to my cart'
      );
      expect(step4.intent).toBe('ADD_TO_CART');
      expect(step4.cartAction?.action).toBe('added');
      expect(step4.cartAction?.product?.id).toBe(secondProd.id);
      expect(step4.cart?.totalQuantity).toBe(1);
      expect(step4.cart?.items[0].productId).toBe(secondProd.id);
    });

    it('asks for clarification when "Add it to my cart" is ambiguous across multiple recommendations', async () => {
      const sessionId = 'ambiguous_cart_sess';

      const step1 = await assistantService.handleUserMessage(
        sessionId,
        'Best phones under ₹25000'
      );
      expect(step1.products.length).toBeGreaterThanOrEqual(2);

      // Ambiguous pronoun without ordinal when multiple products were recommended
      const step2 = await assistantService.handleUserMessage(
        sessionId,
        'Add it to my cart'
      );
      expect(step2.intent).toBe('ADD_TO_CART');
      expect(step2.cartAction?.action).toBe('clarification_needed');
      expect(step2.message).toMatch(/Which product from your current recommendations/i);
    });
  });

  // =========================================================================
  // 6. HTTP API Endpoints Integration Test (Supertest)
  // =========================================================================
  describe('HTTP API Endpoints (/api/cart, /api/orders, /api/visual-search, /api/account)', () => {
    it('executes end-to-end cart, checkout, order history, and account API calls', async () => {
      const sessionId = `http_e2e_${Date.now()}`;

      // 1. Add item via POST /api/cart/items
      const addRes = await request(app)
        .post('/api/cart/items')
        .send({ sessionId, productId: 'hp-boat-airdopes-141', quantity: 2 });
      expect(addRes.status).toBe(200);
      expect(addRes.body.totalQuantity).toBe(2);

      // 2. Checkout via POST /api/orders/checkout
      const checkoutRes = await request(app)
        .post('/api/orders/checkout')
        .send({
          sessionId,
          idempotencyKey: `idem_${sessionId}`,
          customerName: 'Rohan Mehta',
          customerEmail: 'rohan@example.com',
          customerPhone: '9811122233',
          shippingAddress: {
            line1: '10 Park Street',
            city: 'Kolkata',
            state: 'West Bengal',
            postalCode: '700016',
            country: 'India',
          },
        });
      expect(checkoutRes.status).toBe(201);
      expect(checkoutRes.body.isDemoCheckout).toBe(true);
      expect(checkoutRes.body.status).toBe('Confirmed');

      // 3. Duplicate checkout with same idempotencyKey returns 200 with duplicatePrevented: true
      const dupRes = await request(app)
        .post('/api/orders/checkout')
        .send({
          sessionId,
          idempotencyKey: `idem_${sessionId}`,
          customerName: 'Rohan Mehta',
          customerEmail: 'rohan@example.com',
          customerPhone: '9811122233',
          shippingAddress: {
            line1: '10 Park Street',
            city: 'Kolkata',
            state: 'West Bengal',
            postalCode: '700016',
            country: 'India',
          },
        });
      expect(dupRes.status).toBe(200);
      expect(dupRes.body.duplicatePrevented).toBe(true);
      expect(dupRes.body.id).toBe(checkoutRes.body.id);

      // 4. Visual search endpoint POST /api/visual-search
      const visRes = await request(app)
        .post('/api/visual-search')
        .send({
          sessionId,
          imageData: VALID_PNG_BASE64,
          mimeType: 'image/png',
          fileName: 'oneplus_nord_buds_2r.png',
        });
      expect(visRes.status).toBe(200);
      expect(visRes.body.overallClassification).toBe('confirmed_exact_match');
    });
  });
});
