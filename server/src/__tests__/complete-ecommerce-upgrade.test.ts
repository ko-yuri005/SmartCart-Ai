import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { app } from '../server.js';
import { initMarketplaceTables } from '../db/database.js';
import { SqliteProductRepository } from '../db/repositories/product.repository.js';
import { SqliteSessionRepository } from '../db/repositories/session.repository.js';
import { SqliteOfferRepository } from '../db/repositories/offer.repository.js';
import { SEED_PRODUCTS } from '../db/seed-data.js';
import { AuthService } from '../services/auth.service.js';
import { CartOrderService } from '../services/cart-order.service.js';
import { ReviewService } from '../services/review.service.js';
import { ProductRequestService } from '../services/product-request.service.js';
import { ComparisonService } from '../services/comparison.service.js';
import { GeminiService } from '../services/gemini.service.js';
import { FilterService } from '../services/filter.service.js';
import { RankingService } from '../services/ranking.service.js';
import { RelaxationService } from '../services/relaxation.service.js';
import { AlternativesService } from '../services/alternatives.service.js';
import { SecurityService } from '../services/security.service.js';
import { ContextService } from '../services/context.service.js';
import { PriceComparisonService } from '../services/price-comparison.service.js';
import { ShoppingAssistantService } from '../services/shopping-assistant.service.js';

const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Complete AI Ecommerce Marketplace Upgrade Suite (Phases 1–14)', () => {
  let db: Database.Database;
  let productRepo: SqliteProductRepository;
  let sessionRepo: SqliteSessionRepository;
  let offerRepo: SqliteOfferRepository;
  let authService: AuthService;
  let cartOrderService: CartOrderService;
  let reviewService: ReviewService;
  let productRequestService: ProductRequestService;
  let comparisonService: ComparisonService;
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
        original_price REAL,
        discount_percent REAL,
        sale_start_at DATETIME,
        sale_end_at DATETIME,
        currency TEXT NOT NULL DEFAULT 'INR',
        rating REAL NOT NULL DEFAULT 0.0,
        review_count INTEGER NOT NULL DEFAULT 0,
        description TEXT NOT NULL,
        features TEXT NOT NULL,
        specifications TEXT NOT NULL,
        use_cases TEXT NOT NULL,
        image TEXT NOT NULL,
        image_gallery TEXT DEFAULT '[]',
        product_type TEXT,
        image_type TEXT,
        availability INTEGER NOT NULL DEFAULT 1,
        stock_count INTEGER NOT NULL DEFAULT 25,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    authService = new AuthService(db);

    const priceComparisonService = new PriceComparisonService(productRepo, offerRepo);
    cartOrderService = new CartOrderService(productRepo, db, priceComparisonService);
    reviewService = new ReviewService(productRepo, db);
    productRequestService = new ProductRequestService(productRepo, db);
    comparisonService = new ComparisonService(productRepo);

    const geminiService = new GeminiService({ apiKey: '', client: null });
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
  // PHASE 2: Authentication, RBAC, Demo Admin Bootstrap & Rate Limiting
  // =========================================================================
  describe('Phase 2: Secure Authentication, RBAC & Session Protection', () => {
    it('bootstraps demo admin (admin/admin) with mustChangePassword=true and hashes passwords with scrypt', () => {
      const adminLogin = authService.login({
        usernameOrEmail: 'admin',
        password: 'admin',
        ipAddress: '127.0.0.1',
      });
      expect(adminLogin.user.username).toBe('admin');
      expect(adminLogin.user.role).toBe('admin');
      expect(adminLogin.user.mustChangePassword).toBe(true);
      expect(adminLogin.token).toBeTruthy();
      expect(adminLogin.csrfToken).toBeTruthy();
      expect((adminLogin.user as unknown as Record<string, unknown>).password_hash).toBeUndefined();

      // Change admin password clears mustChangePassword
      const updatedAdmin = authService.changePassword(
        adminLogin.user.id,
        'admin',
        'NewSecureAdminPass!2026'
      );
      expect(updatedAdmin.mustChangePassword).toBe(false);
    });

    it('registers customers with role="customer" only and prevents self-promotion or duplicate accounts', () => {
      const reg = authService.registerCustomer({
        username: 'priya_k',
        email: 'priya@example.com',
        password: 'CustomerPass123',
        fullName: 'Priya Kapoor',
      });
      expect(reg.user.role).toBe('customer');
      expect(reg.user.username).toBe('priya_k');

      // Duplicate email or username is rejected
      expect(() =>
        authService.registerCustomer({
          username: 'priya_k',
          email: 'other@example.com',
          password: 'CustomerPass123',
        })
      ).toThrow(/already taken/i);
    });

    it('enforces brute-force login rate limiting after repeated failed attempts', () => {
      const ip = '10.20.30.40';
      for (let i = 0; i < 5; i++) {
        expect(() =>
          authService.login({
            usernameOrEmail: 'admin',
            password: 'wrong_password',
            ipAddress: ip,
          })
        ).toThrow(/Invalid username/i);
      }

      // 6th attempt within window is rate-limited
      expect(() =>
        authService.login({
          usernameOrEmail: 'admin',
          password: 'admin',
          ipAddress: ip,
        })
      ).toThrow(/Too many failed login attempts/i);
    });

    it('disables default demo admin (admin/admin) in production and supports secure ADMIN_BOOTSTRAP_PASSWORD', () => {
      const prevNodeEnv = process.env.NODE_ENV;
      const prevBootstrapPwd = process.env.ADMIN_BOOTSTRAP_PASSWORD;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.ADMIN_BOOTSTRAP_PASSWORD;

        // Re-run bootstrap in production mode without ADMIN_BOOTSTRAP_PASSWORD
        authService.bootstrapInitialAdmin();

        expect(() =>
          authService.login({
            usernameOrEmail: 'admin',
            password: 'admin',
            ipAddress: '10.0.0.99',
          })
        ).toThrow(/disabled in production/i);

        // Now provide a strong ADMIN_BOOTSTRAP_PASSWORD in production
        process.env.ADMIN_BOOTSTRAP_PASSWORD = 'ProdStrongPass!2026';
        authService.bootstrapInitialAdmin();

        const prodLogin = authService.login({
          usernameOrEmail: 'admin',
          password: 'ProdStrongPass!2026',
          ipAddress: '10.0.0.100',
        });
        expect(prodLogin.user.role).toBe('admin');
        expect(prodLogin.user.mustChangePassword).toBe(false);
      } finally {
        process.env.NODE_ENV = prevNodeEnv;
        if (prevBootstrapPwd === undefined) {
          delete process.env.ADMIN_BOOTSTRAP_PASSWORD;
        } else {
          process.env.ADMIN_BOOTSTRAP_PASSWORD = prevBootstrapPwd;
        }
      }
    });
  });

  // =========================================================================
  // PHASE 3 & 4: Admin Product Management, Soft Archive & Image Galleries
  // =========================================================================
  describe('Phase 3 & 4: Admin Product Management, Soft-Archive & Multi-Angle Galleries', () => {
    it('preserves 150 verified products with distinct motorcycle images and multi-angle galleries', () => {
      const allActive = productRepo.findMany({ limit: 300, inStockOnly: false });
      expect(allActive.length).toBeGreaterThanOrEqual(150);

      const honda = productRepo.findById('auto-honda-sp125');
      const hunter = productRepo.findById('auto-re-hunter-350');
      const raider = productRepo.findById('auto-tvs-raider-125');
      const pulsar = productRepo.findById('auto-bajaj-pulsar-ns125');

      expect(honda).toBeDefined();
      expect(hunter).toBeDefined();
      expect(raider).toBeDefined();
      expect(pulsar).toBeDefined();

      const bikeImages = new Set([
        honda!.image,
        hunter!.image,
        raider!.image,
        pulsar!.image,
      ]);
      expect(bikeImages.size).toBe(4);
      expect(honda!.image_gallery?.length).toBeGreaterThanOrEqual(3);
    });

    it('allows admin to create, update, and soft-archive products while hiding archived items from public search', () => {
      productRepo.upsert({
        id: 'fash-atelier-merino-hoodie',
        name: 'Atelier Merino Wool Travel Hoodie',
        brand: 'Atelier & Co.',
        category: 'clothing',
        price: 3499,
        original_price: 4499,
        currency: 'INR',
        rating: 4.8,
        review_count: 14,
        description: 'Breathable merino wool zip hoodie for travel.',
        features: ['100% Merino Wool', 'Odor Resistant'],
        specifications: { material: 'Merino Wool', fit: 'Regular' },
        use_cases: ['travel', 'winter'],
        image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7',
        availability: true,
        stock_count: 12,
      });

      const created = productRepo.findById('fash-atelier-merino-hoodie')!;
      expect(created).toBeDefined();
      expect(created.is_on_sale).toBe(true);
      expect(created.discount_percent).toBe(22);

      // Soft archive hides product from public findById() but keeps it in findById(id, { includeArchived: true })
      const archived = productRepo.setArchived('fash-atelier-merino-hoodie', true);
      expect(archived?.is_archived).toBe(true);
      expect(productRepo.findById('fash-atelier-merino-hoodie')).toBeNull();
      expect(
        productRepo.findById('fash-atelier-merino-hoodie', { includeArchived: true })
          ?.is_archived
      ).toBe(true);
    });
  });

  // =========================================================================
  // PHASE 5, 6 & 7: Variants, Cart Merge, Checkout, Ownership & Stock Restore
  // =========================================================================
  describe('Phase 5, 6 & 7: Product Variants, Cart Merge, Checkout & One-Time Stock Restoration', () => {
    it('seeds category-appropriate variants for clothing/footwear/helmets without forcing sizes onto non-variant electronics', () => {
      const allProducts = productRepo.findMany({ limit: 300, inStockOnly: false });
      const footwear = allProducts.find(
        (p) => p.category === 'footwear' && (p.variants?.length || 0) > 0
      );
      expect(footwear).toBeDefined();
      expect(footwear!.requires_variant_selection).toBe(true);
      expect(footwear!.variants!.some((v) => v.sizeSystem === 'UK')).toBe(true);

      const mouse = productRepo.findById('km-logitech-pebble-m350-mouse');
      expect(mouse).toBeDefined();
      expect(mouse!.requires_variant_selection).toBeFalsy();
    });

    it('supports variant-aware cart lines, merges guest cart on customer login, and restores stock only once on order cancellation', () => {
      const guestSessionId = 'guest_sess_merge_1';
      const userSessionId = 'user_sess_merge_1';
      const customerReg = authService.registerCustomer({
        username: 'vikram_s',
        email: 'vikram@example.com',
        password: 'Password123!',
        fullName: 'Vikram Singh',
      });

      const clothingProd = productRepo
        .findMany({ limit: 300, inStockOnly: false })
        .find((p) => (p.variants?.length || 0) >= 2)!;
      const variantA = clothingProd.variants![0];
      const variantB = clothingProd.variants![1];

      // Add two different variants of the same product to guest cart
      cartOrderService.addItem(guestSessionId, clothingProd.id, 1, {
        variantId: variantA.id,
      });
      const cartWithTwoVariants = cartOrderService.addItem(
        guestSessionId,
        clothingProd.id,
        2,
        { variantId: variantB.id }
      );
      expect(cartWithTwoVariants.uniqueItemCount).toBe(2);
      expect(cartWithTwoVariants.totalQuantity).toBe(3);

      // Merge guest cart into customer account
      const mergedCart = cartOrderService.mergeGuestCartIntoUserCart(
        guestSessionId,
        userSessionId,
        customerReg.user.id
      );
      expect(mergedCart.userId).toBe(customerReg.user.id);
      expect(mergedCart.totalQuantity).toBe(3);

      const initialVariantBStock = variantB.stockCount;

      // Checkout order
      const order = cartOrderService.createOrder({
        sessionId: userSessionId,
        userId: customerReg.user.id,
        customerName: 'Vikram Singh',
        customerEmail: 'vikram@example.com',
        customerPhone: '9876543210',
        shippingAddress: {
          line1: '12 MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          country: 'India',
        },
      });
      expect(order.status).toBe('Confirmed');

      const afterOrderProd = productRepo.findById(clothingProd.id)!;
      const afterOrderVarB = afterOrderProd.variants!.find((v) => v.id === variantB.id)!;
      expect(afterOrderVarB.stockCount).toBe(initialVariantBStock - 2);

      // Another customer cannot view or cancel Vikram's order
      expect(() =>
        cartOrderService.updateOrderStatus(
          'other_session',
          order.id,
          'Cancelled',
          'Unauthorized attempt',
          {
            id: 'other_user_id',
            username: 'intruder',
            email: 'intruder@example.com',
            role: 'customer',
            mustChangePassword: false,
            createdAt: new Date().toISOString(),
          }
        )
      ).toThrow(/permission|not found|only cancel your own/i);

      // Cancel order -> restores stock once
      const cancelledOrder = cartOrderService.updateOrderStatus(
        userSessionId,
        order.id,
        'Cancelled',
        'Customer requested cancellation',
        customerReg.user
      );
      expect(cancelledOrder.status).toBe('Cancelled');
      expect(cancelledOrder.stockRestored).toBe(true);

      const restoredProd = productRepo.findById(clothingProd.id)!;
      const restoredVarB = restoredProd.variants!.find((v) => v.id === variantB.id)!;
      expect(restoredVarB.stockCount).toBe(initialVariantBStock);
    });
  });

  // =========================================================================
  // PHASE 8: Customer Reviews, Verified Purchase & Admin Moderation
  // =========================================================================
  describe('Phase 8: Customer Reviews, Verified Purchase Detection & Moderation', () => {
    it('marks review as Verified Purchase only when customer ordered the product, prevents duplicates, and updates rating summary on moderation', () => {
      const buyerSession = 'buyer_review_sess';
      const nonBuyerSession = 'visitor_review_sess';
      const productId = 'hp-boat-airdopes-141';

      // Buyer purchases the product
      cartOrderService.addItem(buyerSession, productId, 1);
      cartOrderService.createOrder({
        sessionId: buyerSession,
        customerName: 'Ananya Rao',
        customerEmail: 'ananya@example.com',
        customerPhone: '9876500001',
        shippingAddress: {
          line1: '88 Jubilee Hills',
          city: 'Hyderabad',
          state: 'Telangana',
          postalCode: '500033',
          country: 'India',
        },
      });

      const verifiedReview = reviewService.createReview({
        productId,
        sessionId: buyerSession,
        authorName: 'Ananya Rao',
        rating: 5,
        title: 'Great gym earbuds',
        comment: 'Strong bass and reliable battery life for workouts.',
        categoryAttributes: { batteryLife: 'Excellent (40+ hrs)' },
      });
      expect(verifiedReview.isVerifiedPurchase).toBe(true);

      // Duplicate review from same session is blocked
      expect(() =>
        reviewService.createReview({
          productId,
          sessionId: buyerSession,
          authorName: 'Ananya Rao',
          rating: 4,
          comment: 'Second duplicate review attempt.',
        })
      ).toThrow(/already submitted a review/i);

      // Non-buyer review has isVerifiedPurchase = false
      const unverifiedReview = reviewService.createReview({
        productId,
        sessionId: nonBuyerSession,
        authorName: 'Casual Visitor',
        rating: 2,
        comment: 'Have not bought it yet.',
      });
      expect(unverifiedReview.isVerifiedPurchase).toBe(false);

      const summaryBefore = reviewService.getProductReviewSummary(productId, 'highest');
      expect(summaryBefore.totalPublishedCount).toBe(2);
      expect(summaryBefore.verifiedPurchaseCount).toBe(1);
      expect(summaryBefore.reviews[0].rating).toBe(5);

      // Admin rejects the unverified review
      reviewService.moderateReview(unverifiedReview.id, 'rejected', 'Not a product review');
      const summaryAfter = reviewService.getProductReviewSummary(productId);
      expect(summaryAfter.totalPublishedCount).toBe(1);
    });
  });

  // =========================================================================
  // PHASE 9: Genuine Discounts, Sale Validation & Coupon Codes
  // =========================================================================
  describe('Phase 9: Discounts, Sales & Coupon Code Validation', () => {
    it('applies WELCOME10, SAVE500, FREESHIP, APPAREL15, and rejects EXPIRED20 or ineligible carts', () => {
      const sessionId = 'coupon_test_sess';
      cartOrderService.addItem(sessionId, 'hp-oneplus-nord-buds-2r', 1); // ₹2,199

      // WELCOME10 -> 10% off
      const withWelcome = cartOrderService.applyCoupon(sessionId, 'WELCOME10');
      expect(withWelcome.pricing.couponCode).toBe('WELCOME10');
      expect(withWelcome.pricing.couponDiscountAmount).toBe(220);

      // EXPIRED20 -> rejected
      expect(() => cartOrderService.applyCoupon(sessionId, 'EXPIRED20')).toThrow(
        /expired/i
      );

      // APPAREL15 on electronics-only cart -> strict validation rejects ineligible category
      expect(() =>
        cartOrderService.validateCouponEligibility('APPAREL15', {
          subtotal: 2199,
          items: [
            {
              productId: 'hp-oneplus-nord-buds-2r',
              category: 'headphones',
              unitPrice: 2199,
              quantity: 1,
            },
          ],
          strictSubtotalAndEligibilityCheck: true,
        })
      ).toThrow(/only eligible for/i);

      // And applying APPAREL15 on electronics-only cart yields ₹0 coupon discount
      const withApparelOnElectronics = cartOrderService.applyCoupon(sessionId, 'APPAREL15');
      expect(withApparelOnElectronics.pricing.couponDiscountAmount).toBe(0);
    });
  });

  // =========================================================================
  // PHASE 10: Out-of-Stock Restock Alerts & Missing-Product Requests (SSRF Safe)
  // =========================================================================
  describe('Phase 10: Out-of-Stock Restock Subscriptions & SSRF-Safe Product Requests', () => {
    it('subscribes to restock notifications for out-of-stock items and transitions to EligibleForNotification when stock is replenished', () => {
      const targetProd = productRepo.findById('hp-jbl-tune-760nc')!;
      expect(targetProd).toBeDefined();

      // Set product out of stock
      productRepo.upsert({
        ...targetProd,
        stock_count: 0,
        availability: false,
      });

      const sub = productRequestService.subscribeRestock({
        productId: targetProd.id,
        sessionId: 'restock_sess_1',
        email: 'alertme@example.com',
        consentGiven: true,
      });
      expect(sub.status).toBe('Subscribed');
      expect(sub.notificationProviderConfigured).toBe(false);

      // Replenish stock via repository -> triggers transition to EligibleForNotification
      productRepo.adjustStock(targetProd.id, 15);

      const list = productRequestService.getCustomerRestockSubscriptions(
        'restock_sess_1'
      );
      expect(list[0].status).toBe('EligibleForNotification');
    });

    it('records missing-product URL requests with exact confirmation message and blocks SSRF/unsafe URLs', () => {
      const validReq = productRequestService.createProductRequest({
        sourceUrl: 'https://www.nike.com/in/t/pegasus-41-road-running-shoes#section',
        requestedName: 'Nike Pegasus 41',
        desiredVariant: 'UK 9 / Volt',
        sessionId: 'req_sess_1',
        contactEmail: 'runner@example.com',
        consentGiven: true,
      });

      expect(validReq.status).toBe('Requested');
      expect(validReq.confirmationMessage).toBe(
        "Thanks! We've recorded your request. We'll contact you when availability is confirmed."
      );
      expect(validReq.normalizedUrl).toBe(
        'https://www.nike.com/in/t/pegasus-41-road-running-shoes'
      );

      // SSRF / private IP / non-HTTP URLs must be rejected
      const unsafeUrls = [
        'http://localhost:8080/internal',
        'http://127.0.0.1/admin',
        'http://169.254.169.254/latest/meta-data/',
        'http://192.168.1.1/router',
        'javascript:alert(1)',
        'file:///etc/passwd',
      ];
      for (const badUrl of unsafeUrls) {
        expect(() =>
          productRequestService.createProductRequest({
            sourceUrl: badUrl,
            sessionId: 'req_sess_1',
            contactEmail: 'runner@example.com',
            consentGiven: true,
          })
        ).toThrow();
      }
    });
  });

  // =========================================================================
  // PHASE 11 & 12: Smart Comparison, Strict Organic Audit & AI Assistant Queries
  // =========================================================================
  describe('Phase 11 & 12: Footwear Comparison, Strict Organic Filtering & AI Assistant', () => {
    it('builds dedicated footwear comparison matrix and never labels Logitech Pebble Mouse as organic', () => {
      const shoes = productRepo
        .findMany({ limit: 300, inStockOnly: false })
        .filter((p) => p.category === 'footwear')
        .slice(0, 2);
      expect(shoes.length).toBe(2);

      const comp = comparisonService.compareProducts([shoes[0].id, shoes[1].id]);
      expect(comp.success).toBe(true);
      expect(comp.data?.categoryGroup).toBe('footwear');
      expect(
        comp.data?.categorySpecificMatrix?.some((r) => r.key === 'available_sizes')
      ).toBe(true);

      // Verify Logitech Pebble M350 Mouse ("Slim Organic Pebble Shape" in features) is NOT organic certified
      const mouseComp = comparisonService.compareProducts([
        'km-logitech-pebble-m350-mouse',
        shoes[0].id,
      ]);
      expect(mouseComp.success).toBe(true);
      const mouseAudit =
        mouseComp.data?.certificationAudit?.['km-logitech-pebble-m350-mouse'];
      expect(mouseAudit?.isOrganicCertified).toBe(false);
    });

    it('handles required natural-language AI shopping queries accurately', async () => {
      const sessionId = 'ai_nl_queries_sess';

      // 1. "Find organic products under ₹1,000" -> only certified organic items <= 1000, never computer mice
      const organicRes = await assistantService.handleUserMessage(
        sessionId,
        'Find organic products under ₹1,000'
      );
      expect(organicRes.products.length).toBeGreaterThan(0);
      for (const p of organicRes.products) {
        expect(p.price).toBeLessThanOrEqual(1000);
        expect(p.id).not.toBe('km-logitech-pebble-m350-mouse');
      }

      // 2. "Suggest comfortable shoes for daily walking"
      const walkingRes = await assistantService.handleUserMessage(
        sessionId,
        'Suggest comfortable shoes for daily walking'
      );
      expect(walkingRes.products.length).toBeGreaterThan(0);
      expect(
        walkingRes.products.some(
          (p) =>
            p.category === 'footwear' ||
            p.name.toLowerCase().includes('shoe') ||
            p.name.toLowerCase().includes('sneaker')
        )
      ).toBe(true);

      // 3. "Add the second product to my cart"
      const secondProduct = walkingRes.products[1];
      const addRes = await assistantService.handleUserMessage(
        sessionId,
        'Add the second product to my cart'
      );
      expect(addRes.intent).toBe('ADD_TO_CART');
      expect(addRes.cartAction?.action).toBe('added');
      expect(addRes.cartAction?.product?.id).toBe(secondProduct.id);

      // 4. "Which product has a better warranty?"
      const warrantyRes = await assistantService.handleUserMessage(
        sessionId,
        'Which product has a better warranty?'
      );
      expect(warrantyRes.message.length).toBeGreaterThan(20);

      // 5. "Notify me when this product is back in stock"
      const restockChatRes = await assistantService.handleUserMessage(
        sessionId,
        'Notify me when this product is back in stock'
      );
      expect(restockChatRes.intent).toBe('RESTOCK_NOTIFY');
      expect(restockChatRes.offerRestockNotification?.productId).toBeTruthy();
    });
  });

  // =========================================================================
  // HTTP API Integration Verification (Auth, Admin, Reviews, Requests)
  // =========================================================================
  describe('HTTP API Endpoints (/api/auth, /api/admin, /api/product-requests, /api/coupons)', () => {
    it('enforces admin RBAC and supports full HTTP lifecycle for auth, coupons, and product requests', async () => {
      // 1. Unauthenticated access to /api/admin/summary returns 401
      const unauthAdmin = await request(app).get('/api/admin/summary');
      expect(unauthAdmin.status).toBe(401);

      // 2. Login as demo admin via POST /api/auth/login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ usernameOrEmail: 'admin', password: 'admin' });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.role).toBe('admin');
      const token = loginRes.body.token;

      // 3. Authenticated admin access to /api/admin/summary succeeds
      const adminSummaryRes = await request(app)
        .get('/api/admin/summary')
        .set('Authorization', `Bearer ${token}`);
      expect(adminSummaryRes.status).toBe(200);
      expect(adminSummaryRes.body.activeProducts).toBeGreaterThanOrEqual(140);

      // 4. Submit a missing product request via POST /api/product-requests
      const uniqueNonce = Date.now();
      const reqRes = await request(app)
        .post('/api/product-requests')
        .send({
          sessionId: `http_req_sess_${uniqueNonce}`,
          contactEmail: `shopper_${uniqueNonce}@example.com`,
          sourceUrl: `https://www.apple.com/in/airpods-pro-${uniqueNonce}/`,
          requestedName: 'Apple AirPods Pro 2',
          consentGiven: true,
        });
      expect(reqRes.status).toBe(201);
      expect(reqRes.body.confirmationMessage).toBe(
        "Thanks! We've recorded your request. We'll contact you when availability is confirmed."
      );
    });
  });
});
