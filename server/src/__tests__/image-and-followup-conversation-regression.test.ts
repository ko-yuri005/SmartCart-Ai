import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '../db/database.js';
import { SqliteProductRepository } from '../db/repositories/product.repository.js';
import { SqliteSessionRepository } from '../db/repositories/session.repository.js';
import { SqliteOfferRepository } from '../db/repositories/offer.repository.js';
import { FilterService } from '../services/filter.service.js';
import { RankingService } from '../services/ranking.service.js';
import { RelaxationService } from '../services/relaxation.service.js';
import { ComparisonService } from '../services/comparison.service.js';
import { AlternativesService } from '../services/alternatives.service.js';
import { ContextService } from '../services/context.service.js';
import { SecurityService } from '../services/security.service.js';
import { GeminiService } from '../services/gemini.service.js';
import { PriceComparisonService } from '../services/price-comparison.service.js';
import { ShoppingAssistantService } from '../services/shopping-assistant.service.js';
import { ImageResolverService } from '../services/image-resolver.service.js';

describe('Product Image Propagation & 4-Turn Follow-Up Conversation Regression Suite', () => {
  const db = getDatabase();
  const productRepo = new SqliteProductRepository(db);
  const sessionRepo = new SqliteSessionRepository(db);
  const offerRepo = new SqliteOfferRepository(db);
  const filterService = new FilterService(productRepo);
  const rankingService = new RankingService();
  const relaxationService = new RelaxationService(filterService, rankingService);
  const alternativesService = new AlternativesService(productRepo, filterService);
  const comparisonService = new ComparisonService(productRepo);
  const securityService = new SecurityService();
  // Deterministic offline mode so tests never depend on external API keys
  const geminiService = new GeminiService(null);
  const contextService = new ContextService(productRepo);
  const priceComparisonService = new PriceComparisonService(productRepo, offerRepo);

  let assistantService: ShoppingAssistantService;

  beforeEach(() => {
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
      priceComparisonService
    );
  });

  describe('1. Product Image Field Propagation & Missing-Image Placeholder Fallback', () => {
    it('verifies boAt Rockerz 255 Pro+ catalogue record uses a clean placeholder without fabricating or misassigning an unrelated image', () => {
      const resolver = new ImageResolverService();
      const boatNeckband = productRepo.findById('hp-boat-rockerz-255-pro-plus');
      expect(boatNeckband).not.toBeNull();
      expect(boatNeckband!.name).toBe(
        'boAt Rockerz 255 Pro+ Bluetooth Wireless In-Ear Neckband'
      );
      expect(boatNeckband!.category).toBe('headphones');
      expect(boatNeckband!.product_type).toBe('neckband');
      // Because no visually verified neckband photo exists in the registry, it must resolve cleanly to placeholder
      expect(boatNeckband!.image).toBe('');
      expect(boatNeckband!.image_type).toBe('placeholder');

      const resolution = resolver.resolveImage(boatNeckband!);
      expect(resolution.productType).toBe('neckband');
      expect(resolution.imageUrl).toBe('');
      expect(resolution.imageType).toBe('placeholder');
    });

    it('propagates verified image URLs and product_type fields across initial recommendations and follow-up responses', async () => {
      const sessionId = `test_img_propagation_session_${Date.now()}`;

      // Initial recommendation
      const r1 = await assistantService.handleUserMessage(
        sessionId,
        'Wireless headphones under ₹3000 for gym'
      );
      expect(r1.products.length).toBeGreaterThanOrEqual(3);

      const seenNonEmptyUrls = new Set<string>();
      for (const prod of r1.products) {
        expect(typeof prod.image).toBe('string');
        expect(typeof prod.product_type).toBe('string');
        expect(prod.product_type!.length).toBeGreaterThan(0);
        expect(typeof prod.image_type).toBe('string');

        if (prod.image === '') {
          expect(prod.image_type).toBe('placeholder');
        } else {
          expect(prod.image).toMatch(/^https:\/\//);
          expect(prod.image_type).toBe(prod.product_type);
          expect(seenNonEmptyUrls.has(prod.image)).toBe(false);
          seenNonEmptyUrls.add(prod.image);
        }
      }

      // Follow-up purchase detail on second product (which has a verified image)
      const secondProdId = r1.products[1].id;
      const r2 = await assistantService.handleUserMessage(
        sessionId,
        'Where can I buy the second one?'
      );
      expect(r2.targetProduct?.id).toBe(secondProdId);
      expect(r2.products).toHaveLength(1);
      expect(r2.products[0].id).toBe(secondProdId);
      if (r2.products[0].image) {
        expect(r2.products[0].image).toMatch(/^https:\/\//);
      }
      expect(r2.products[0].product_type).toBeDefined();
      expect(r2.products[0].purchaseLinks).toBeDefined();
    });
  });

  describe('2. Exact 4-Turn Follow-Up Conversation Flow', () => {
    it('correctly handles: (1) Wireless headphones under ₹3000 for gym -> (2) Where can I buy the first one? -> (3) Compare this on Amazon and Flipkart -> (4) Show me an alternative to this', async () => {
      const sessionId = `test_exact_4_turn_session_${Date.now()}`;

      // Turn 1: "Wireless headphones under ₹3000 for gym"
      const r1 = await assistantService.handleUserMessage(
        sessionId,
        'Wireless headphones under ₹3000 for gym'
      );
      expect(r1.products.length).toBeGreaterThanOrEqual(2);
      expect(r1.activeRequirements.category).toBe('headphones');
      expect(r1.activeRequirements.max_price).toBe(3000);
      expect(r1.activeRequirements.use_cases).toContain('gym');
      for (const p of r1.products) {
        expect(p.category).toBe('headphones');
        expect(p.price).toBeLessThanOrEqual(3000);
      }

      const firstProduct = r1.products[0];
      expect(['hp-boat-rockerz-550', 'hp-boat-rockerz-255-pro-plus']).toContain(
        firstProduct.id
      );

      // Turn 2: "Where can I buy the first one?"
      const r2 = await assistantService.handleUserMessage(
        sessionId,
        'Where can I buy the first one?'
      );
      expect(r2.targetProduct).toBeDefined();
      expect(r2.targetProduct!.id).toBe(firstProduct.id);
      expect(r2.products).toHaveLength(1);
      expect(r2.products[0].id).toBe(firstProduct.id);
      expect(r2.priceComparison).toBeDefined();
      expect(r2.priceComparison!.productId).toBe(firstProduct.id);
      expect(r2.message).toContain(firstProduct.name);
      // Context must preserve original budget and use case
      expect(r2.activeRequirements.category).toBe('headphones');
      expect(r2.activeRequirements.max_price).toBe(3000);
      expect(r2.activeRequirements.use_cases).toContain('gym');

      // Turn 3: "Compare this on Amazon and Flipkart"
      const r3 = await assistantService.handleUserMessage(
        sessionId,
        'Compare this on Amazon and Flipkart'
      );
      // Must resolve "this" to the product being discussed (firstProduct)
      expect(r3.targetProduct).toBeDefined();
      expect(r3.targetProduct!.id).toBe(firstProduct.id);
      expect(r3.products).toHaveLength(1);
      expect(r3.products[0].id).toBe(firstProduct.id);
      expect(r3.priceComparison).toBeDefined();
      expect(r3.priceComparison!.productId).toBe(firstProduct.id);
      // Must specifically address Amazon India and Flipkart, state honestly that live verified prices are unavailable, and provide their search links
      expect(r3.message).toContain(firstProduct.name);
      expect(r3.message).toMatch(/Amazon India/i);
      expect(r3.message).toMatch(/Flipkart/i);
      expect(r3.message).toMatch(/unavailable/i);
      expect(r3.message).toContain('https://www.amazon.in/s?k=');
      expect(r3.message).toContain('https://www.flipkart.com/search?q=');
      // Must NOT repeat the generic 4-retailer header or claim search links are verified listings
      expect(r3.message).not.toBe(r2.message);
      expect(r3.message).toMatch(/unverified/i);
      // Must preserve conversation context for Turn 4
      expect(r3.activeRequirements.category).toBe('headphones');
      expect(r3.activeRequirements.max_price).toBe(3000);
      expect(r3.activeRequirements.use_cases).toContain('gym');

      // Turn 4: "Show me an alternative to this"
      const r4 = await assistantService.handleUserMessage(
        sessionId,
        'Show me an alternative to this'
      );
      expect(r4.intent).toBe('ALTERNATIVES');
      expect(r4.alternatives).toBeDefined();
      expect(r4.alternatives!.targetProduct.id).toBe(firstProduct.id);
      expect(r4.products.length).toBeGreaterThanOrEqual(2);

      for (const altProd of r4.products) {
        // Must be genuinely different products
        expect(altProd.id).not.toBe(firstProduct.id);
        // Must stay in the same category and within original ₹3000 budget
        expect(altProd.category).toBe('headphones');
        expect(altProd.price).toBeLessThanOrEqual(3000);
        // Must match the gym use case
        expect(
          altProd.use_cases.map((u) => u.toLowerCase())
        ).toContain('gym');
        // Must include image fields and purchase links for product cards
        expect(altProd.product_type).toBeDefined();
        expect(altProd.purchaseLinks).toBeDefined();
      }
    });

    it('shows real source-backed offers when comparing on Amazon and Flipkart for a product with verified listings', async () => {
      const sessionId = `test_verified_amazon_flipkart_${Date.now()}`;

      // Seeded product with verified Amazon India and Flipkart offers: hp-sony-wh1000xm5
      const r1 = await assistantService.handleUserMessage(
        sessionId,
        'Sony WH-1000XM5 headphones'
      );
      expect(r1.products.length).toBeGreaterThan(0);
      const sonyXm5 =
        r1.products.find((p) => p.id === 'hp-sony-wh1000xm5') || r1.products[0];

      // Focus on Sony WH-1000XM5
      const r2 = await assistantService.handleUserMessage(
        sessionId,
        'Where can I buy the first one?'
      );
      expect(r2.targetProduct?.id).toBe(sonyXm5.id);

      // Compare on Amazon and Flipkart
      const r3 = await assistantService.handleUserMessage(
        sessionId,
        'Compare this on Amazon and Flipkart'
      );
      expect(r3.targetProduct?.id).toBe(sonyXm5.id);
      expect(r3.message).toMatch(/Amazon India/i);
      expect(r3.message).toMatch(/Flipkart/i);
      // Should show verified prices and direct listing links for Sony WH-1000XM5
      if (sonyXm5.id === 'hp-sony-wh1000xm5') {
        expect(r3.message).toMatch(/Verified/i);
        expect(r3.message).toContain('https://www.amazon.in/dp/');
        expect(r3.message).toContain('https://www.flipkart.com/');
      }
    });
  });

  describe('3. Post-Processing Guardrails & Suggestion-Chip Separation', () => {
    it('strips context-leaked brand, category, and ordinal index from pronoun follow-ups in postProcessExtractedRequirements', () => {
      // Simulate Gemini LLM leaking context fields on "Compare this on Amazon and Flipkart"
      const rawComp = geminiService.postProcessExtractedRequirements(
        {
          intent: 'COMPARE',
          category: 'headphones',
          brand: 'boAt',
          referenced_index: 1,
        },
        'Compare this on Amazon and Flipkart',
        [
          {
            id: 'm1',
            session_id: 's1',
            role: 'user',
            content: 'Where can I buy the first one?',
            created_at: new Date().toISOString(),
          },
        ]
      );
      expect(rawComp.intent).toBe('QUESTION_ON_PREVIOUS');
      expect(rawComp.category).toBeUndefined();
      expect(rawComp.brand).toBeUndefined();
      expect(rawComp.referenced_index).toBeUndefined();

      // Simulate Gemini LLM misclassifying "Show me an alternative to this" as QUESTION_ON_PREVIOUS with leaked brand
      const rawAlt = geminiService.postProcessExtractedRequirements(
        {
          intent: 'QUESTION_ON_PREVIOUS',
          category: 'headphones',
          brand: 'boAt',
          referenced_index: 1,
        },
        'Show me an alternative to this',
        []
      );
      expect(rawAlt.intent).toBe('ALTERNATIVES');
      expect(rawAlt.category).toBeUndefined();
      expect(rawAlt.brand).toBeUndefined();
      expect(rawAlt.referenced_index).toBeUndefined();
    });

    it('never appends suggestion-chip text into the assistant message prose', async () => {
      const sessionId = `test_suggestion_separation_${Date.now()}`;
      const r1 = await assistantService.handleUserMessage(
        sessionId,
        'Wireless headphones under ₹3000 for gym'
      );
      const r2 = await assistantService.handleUserMessage(
        sessionId,
        'Where can I buy the first one?'
      );

      expect(Array.isArray(r2.suggestions)).toBe(true);
      expect(r2.suggestions!.length).toBeGreaterThan(0);
      for (const suggestion of r2.suggestions!) {
        expect(r2.message).not.toContain(suggestion);
      }
    });
  });
});
