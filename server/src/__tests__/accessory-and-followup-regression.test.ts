import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '../db/database.js';
import { SqliteProductRepository } from '../db/repositories/product.repository.js';
import { SqliteSessionRepository } from '../db/repositories/session.repository.js';
import { SqliteOfferRepository } from '../db/repositories/offer.repository.js';
import { FilterService } from '../services/filter.service.js';
import { RankingService } from '../services/ranking.service.js';
import { RelaxationService } from '../services/relaxation.service.js';
import { AlternativesService } from '../services/alternatives.service.js';
import { ComparisonService } from '../services/comparison.service.js';
import { SecurityService } from '../services/security.service.js';
import { GeminiService } from '../services/gemini.service.js';
import { ContextService } from '../services/context.service.js';
import { PriceComparisonService } from '../services/price-comparison.service.js';
import { ShoppingAssistantService } from '../services/shopping-assistant.service.js';

describe('Accessory vs. Parent-Category Matching & Multi-Turn Follow-Up Regression Suite', () => {
  const db = getDatabase();
  const productRepo = new SqliteProductRepository(db);
  const sessionRepo = new SqliteSessionRepository(db);
  const offerRepo = new SqliteOfferRepository(db);
  const filterService = new FilterService(productRepo);
  const rankingService = new RankingService();
  const relaxationService = new RelaxationService(filterService, rankingService);
  const alternativesService = new AlternativesService(productRepo);
  const comparisonService = new ComparisonService(productRepo);
  const securityService = new SecurityService();
  // Offline/mock GeminiService guarantees zero external network calls
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

  // =========================================================================
  // 1. ACCESSORY VS. PARENT-CATEGORY MATCHING
  // =========================================================================
  describe('1. Accessory vs. Parent-Category Matching', () => {
    it('1.1 "suggest laptop cooling pads" never returns laptops as direct or relaxed matches', async () => {
      const extraction = await geminiService.extractWithTelemetry(
        'suggest laptop cooling pads',
        []
      );

      // Must NOT classify laptop cooling pad as category: "laptops"
      expect(extraction.requirements.category).not.toBe('laptops');
      expect(extraction.requirements.requested_subtype).toBe('laptop-cooling-pad');
      expect(extraction.requirements.excluded_product_types).toContain('laptop');

      // Even if a live LLM response misclassified "suggest laptop cooling pads" as category: "laptops", features: ["cooling pads"],
      // postProcessExtractedRequirements must override the parent category and lock the accessory subtype:
      const simulatedMisclassifiedLlm = geminiService.postProcessExtractedRequirements(
        {
          intent: 'SEARCH',
          category: 'laptops',
          features: ['cooling pads'],
        },
        'suggest laptop cooling pads'
      );
      expect(simulatedMisclassifiedLlm.category).toBeUndefined();
      expect(simulatedMisclassifiedLlm.requested_subtype).toBe('laptop-cooling-pad');
      expect(simulatedMisclassifiedLlm.excluded_product_types).toContain('laptop');

      // Filter and relaxation must NOT return laptop devices
      const { mergedCriteria } = contextService.mergeRequirements(
        extraction.requirements,
        null,
        [],
        'suggest laptop cooling pads'
      );
      const normalized = filterService.normalizeCriteria(mergedCriteria);
      expect(normalized.category).not.toBe('laptops');
      expect(normalized.excludedProductTypes).toContain('laptop');
      expect(normalized.requiredKeywords).toBeDefined();
      expect(normalized.requiredKeywords!.length).toBeGreaterThan(0);

      const relaxationResult = relaxationService.searchWithRelaxation(mergedCriteria);
      const returnedLaptops = relaxationResult.products.filter(
        (sp) => sp.product.product_type === 'laptop' || sp.product.category === 'laptops'
      );
      expect(returnedLaptops).toHaveLength(0);
      expect(relaxationResult.products).toHaveLength(0);
      expect(relaxationResult.explanation.toLowerCase()).toContain('laptop cooling pad');

      // End-to-end chat turn
      const chatRes = await assistantService.handleUserMessage(
        undefined,
        'suggest laptop cooling pads'
      );
      expect(chatRes.products).toHaveLength(0);
      expect(chatRes.message.toLowerCase()).toContain('laptop cooling pad');
      expect(chatRes.message.toLowerCase()).toContain('catalogue');
      // Must provide external retailer search links without claiming live external results exist
      expect(chatRes.message).toContain('https://www.amazon.in/s?k=');
      expect(chatRes.message).toContain('https://www.flipkart.com/search?q=');
      expect(chatRes.message.toLowerCase()).toMatch(/similar.*accessories/);
    });

    it('1.2 Generalizes across accessory/parent-product pairs and never substitutes parent devices', async () => {
      const accessoryQueries: Array<{
        query: string;
        expectedSubtype: string;
        forbiddenParentCategories: string[];
        forbiddenParentProductTypes: string[];
      }> = [
        {
          query: 'suggest a laptop stand for desk',
          expectedSubtype: 'laptop-stand',
          forbiddenParentCategories: ['laptops'],
          forbiddenParentProductTypes: ['laptop'],
        },
        {
          query: 'I need a 15 inch laptop sleeve',
          expectedSubtype: 'laptop-sleeve',
          forbiddenParentCategories: ['laptops'],
          forbiddenParentProductTypes: ['laptop'],
        },
        {
          query: 'suggest a phone case under ₹1000',
          expectedSubtype: 'phone-case',
          forbiddenParentCategories: ['smartphones'],
          forbiddenParentProductTypes: ['smartphone'],
        },
        {
          query: 'tempered glass screen protector for phone',
          expectedSubtype: 'screen-protector',
          forbiddenParentCategories: ['smartphones', 'tablets', 'laptops'],
          forbiddenParentProductTypes: ['smartphone', 'tablet', 'laptop'],
        },
        {
          query: 'camera tripod for vlogging under ₹3000',
          expectedSubtype: 'camera-tripod',
          forbiddenParentCategories: ['smartphones'],
          forbiddenParentProductTypes: ['smartphone'],
        },
        {
          query: 'tinted helmet visor replacement',
          expectedSubtype: 'helmet-visor',
          forbiddenParentCategories: ['helmets', 'two-wheelers'],
          forbiddenParentProductTypes: ['helmet', 'motorcycle', 'scooter'],
        },
        {
          query: 'waterproof bike cover for motorcycle',
          expectedSubtype: 'bike-accessory',
          forbiddenParentCategories: ['two-wheelers', 'bicycles'],
          forbiddenParentProductTypes: ['motorcycle', 'scooter', 'electric_scooter', 'bicycle'],
        },
        {
          query: 'silicone watch strap 22mm',
          expectedSubtype: 'watch-strap',
          forbiddenParentCategories: ['smartwatches'],
          forbiddenParentProductTypes: ['smartwatch', 'analog_watch'],
        },
      ];

      for (const testCase of accessoryQueries) {
        const res = await assistantService.handleUserMessage(undefined, testCase.query);
        expect(res.activeRequirements?.requested_subtype).toBe(testCase.expectedSubtype);

        for (const prod of res.products) {
          expect(testCase.forbiddenParentCategories).not.toContain(prod.category);
          if (prod.product_type) {
            expect(testCase.forbiddenParentProductTypes).not.toContain(prod.product_type);
          }
        }
      }
    });
  });

  // =========================================================================
  // 2. MULTI-TURN CONVERSATIONAL FOLLOW-UPS WHEN PRODUCTS ARE RETURNED
  // =========================================================================
  describe('2. Multi-Turn Follow-Ups When Products Are Returned', () => {
    it('2.1 Resolves "Where can I buy the first one?", "Compare the first two", and "Is this cheaper anywhere else?" against the active recommendation list', async () => {
      // Turn 1: User asks for coding laptops under ₹70000
      const turn1 = await assistantService.handleUserMessage(
        undefined,
        'I need a laptop for coding under ₹70000'
      );
      const sessionId = turn1.sessionId;
      expect(turn1.products.length).toBeGreaterThanOrEqual(2);
      const firstProduct = turn1.products[0];
      const secondProduct = turn1.products[1];

      // Turn 2: "Where can I buy the first one?"
      const turn2 = await assistantService.handleUserMessage(
        sessionId,
        'Where can I buy the first one?'
      );
      expect(turn2.products).toHaveLength(1);
      expect(turn2.products[0].id).toBe(firstProduct.id);
      expect(turn2.priceComparison).toBeDefined();
      expect(turn2.priceComparison?.productId).toBe(firstProduct.id);
      expect(turn2.message).toContain(firstProduct.name);
      // Must include either verified buy links or retailer search links
      expect(
        (turn2.priceComparison?.offers.length ?? 0) +
          (turn2.priceComparison?.purchaseLinks.retailerSearchLinks.length ?? 0)
      ).toBeGreaterThan(0);

      // Turn 3: "Compare the first two"
      // Even though Turn 2 focused on the 1st product, the full recommendation list from Turn 1 is preserved in session state!
      const turn3 = await assistantService.handleUserMessage(
        sessionId,
        'Compare the first two'
      );
      expect(turn3.intent).toBe('COMPARE');
      expect(turn3.comparison).toBeDefined();
      expect(turn3.comparison?.products).toHaveLength(2);
      expect(turn3.comparison?.products[0].id).toBe(firstProduct.id);
      expect(turn3.comparison?.products[1].id).toBe(secondProduct.id);
      expect(turn3.comparison?.specMatrix.length).toBeGreaterThan(0);

      // Turn 4: "Is this cheaper anywhere else?"
      // Resolves to the first/focused product and runs cross-website price comparison
      const turn4 = await assistantService.handleUserMessage(
        sessionId,
        'Is this cheaper anywhere else?'
      );
      expect(turn4.products).toHaveLength(1);
      expect(turn4.products[0].id).toBe(firstProduct.id);
      expect(turn4.priceComparison).toBeDefined();
      expect(turn4.priceComparison?.productId).toBe(firstProduct.id);
      expect(turn4.message).toContain(firstProduct.name);
      expect(turn4.message).toContain(`₹${firstProduct.price.toLocaleString('en-IN')}`);
    });
  });

  // =========================================================================
  // 3. MULTI-TURN CONVERSATIONAL FOLLOW-UPS WHEN NO PRODUCTS WERE RETURNED
  // =========================================================================
  describe('3. Multi-Turn Follow-Ups When No Products Were Returned', () => {
    it('3.1 Honestly explains that no products were returned when asked "Where can I buy the first one?", "Compare the first two", or "Is this cheaper anywhere else?" after a 0-match query', async () => {
      // Turn 1: User asks for an uncatalogued accessory ("suggest laptop cooling pads")
      const turn1 = await assistantService.handleUserMessage(
        undefined,
        'suggest laptop cooling pads'
      );
      const sessionId = turn1.sessionId;
      expect(turn1.products).toHaveLength(0);

      // Turn 2: "Where can I buy the first one?"
      const turn2 = await assistantService.handleUserMessage(
        sessionId,
        'Where can I buy the first one?'
      );
      expect(turn2.products).toHaveLength(0);
      expect(turn2.comparison).toBeUndefined();
      expect(turn2.priceComparison).toBeUndefined();
      expect(turn2.message.toLowerCase()).toContain('no matching product');
      // Also includes external retailer search links for the uncatalogued item in context
      expect(turn2.message).toContain('https://www.amazon.in/s?k=');

      // Turn 3: "Compare the first two"
      const turn3 = await assistantService.handleUserMessage(
        sessionId,
        'Compare the first two'
      );
      expect(turn3.products).toHaveLength(0);
      expect(turn3.comparison).toBeUndefined();
      expect(turn3.message.toLowerCase()).toContain('no matching product');

      // Turn 4: "Is this cheaper anywhere else?"
      const turn4 = await assistantService.handleUserMessage(
        sessionId,
        'Is this cheaper anywhere else?'
      );
      expect(turn4.products).toHaveLength(0);
      expect(turn4.priceComparison).toBeUndefined();
      expect(turn4.message.toLowerCase()).toContain('no matching product');
    });
  });
});
