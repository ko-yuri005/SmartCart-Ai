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
import { ProductRequestService } from '../services/product-request.service.js';

describe('SmartCart AI — Conversation, Product Discovery, Comparison & Context Suite', () => {
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
  // Deterministic offline mode so tests validate real catalogue resolution & fallback logic
  const geminiService = new GeminiService(null);
  const contextService = new ContextService(productRepo);
  const priceComparisonService = new PriceComparisonService(productRepo, offerRepo);
  const productRequestService = new ProductRequestService(productRepo, db);

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

  describe('Case A: Direct Product Comparison (Motorcycles)', () => {
    it('resolves "Compare Royal Enfield Hunter 350 vs Triumph Speed 400" from the catalogue on Turn 1 without requiring prior session products', async () => {
      const sessionId = `test_case_a_moto_compare_${Date.now()}`;
      const res = await assistantService.handleUserMessage(
        sessionId,
        'Compare Royal Enfield Hunter 350 vs Triumph Speed 400'
      );

      expect(res.intent).toBe('COMPARE');
      expect(res.diagnostics?.structuredIntent).toBe('PRODUCT_COMPARISON');
      expect(res.message).not.toContain('No matching products were returned in my previous response');

      expect(res.products).toHaveLength(2);
      const ids = res.products.map((p) => p.id);
      expect(ids).toContain('auto-re-hunter-350');
      expect(ids).toContain('auto-triumph-speed-400-phantom-black');

      expect(res.comparison).toBeDefined();
      expect(res.comparison!.products).toHaveLength(2);
      expect(res.comparison!.categoryGroup).toBe('sports_automotive_other');

      const specificLabels = (res.comparison!.categorySpecificMatrix || []).map(
        (r) => r.label
      );
      expect(specificLabels).toContain('Manufacturer & Model');
      expect(specificLabels).toContain('Ex-Showroom Price');
      expect(specificLabels).toContain('Engine Capacity / Displacement');
      expect(specificLabels).toContain('Power & Torque');
      expect(specificLabels).toContain('Transmission / Gearbox');
      expect(specificLabels).toContain('Weight / Kerb Weight');
      expect(specificLabels).toContain('Seat Height');
      expect(specificLabels).toContain('Braking / ABS / Safety Features');
      expect(specificLabels).toContain('Intended Riding Use');
      expect(specificLabels).toContain('Warranty / Service Info');
      expect(specificLabels).toContain('Verification & Fulfillment Status');

      // Missing attributes (such as Seat Height or Warranty) must be marked honestly as "Not specified in catalogue"
      const seatHeightRow = res.comparison!.categorySpecificMatrix!.find(
        (r) => r.key === 'seat_height'
      );
      expect(seatHeightRow).toBeDefined();
      expect(seatHeightRow!.values['auto-re-hunter-350']).toBe(
        'Not specified in catalogue'
      );

      // Response message must mention Ex-Showroom pricing and both motorcycles
      expect(res.message).toContain('Royal Enfield Hunter 350');
      expect(res.message).toContain('Triumph Speed 400');
      expect(res.message).toMatch(/Ex-Showroom/i);
    });
  });

  describe('Case B: Partial Product Comparison (1 Found, 1 Missing)', () => {
    it('handles "Compare Royal Enfield Hunter 350 vs Kawasaki Ninja 300" by showing the found motorcycle and honestly explaining the missing one', async () => {
      const sessionId = `test_case_b_partial_compare_${Date.now()}`;
      const res = await assistantService.handleUserMessage(
        sessionId,
        'Compare Royal Enfield Hunter 350 vs Kawasaki Ninja 300'
      );

      expect(res.intent).toBe('COMPARE');
      expect(res.products).toHaveLength(1);
      expect(res.products[0].id).toBe('auto-re-hunter-350');
      expect(res.message).toContain('Royal Enfield Hunter 350');
      expect(res.message).toMatch(/Kawasaki Ninja 300/i);
      expect(res.message).toMatch(/not currently in our internal catalogue/i);
    });

    it('does not falsely match "Royal Enfield Classic 500" to "Royal Enfield Classic 350"', async () => {
      const sessionId = `test_case_b_model_num_guard_${Date.now()}`;
      const res = await assistantService.handleUserMessage(
        sessionId,
        'Compare Royal Enfield Classic 500 vs Triumph Speed 400'
      );

      expect(res.intent).toBe('COMPARE');
      expect(res.products).toHaveLength(1);
      expect(res.products[0].id).toBe('auto-triumph-speed-400-phantom-black');
      expect(res.message).toMatch(/Royal Enfield Classic 500/i);
      expect(res.message).toMatch(/not currently in our internal catalogue/i);
    });
  });

  describe('Case C: Product Discovery ("Wireless headphones under ₹3000 for gym")', () => {
    it('returns wireless over-ear headphones under ₹3000 first and groups wireless earbuds/neckbands under Related alternatives', async () => {
      const sessionId = `test_case_c_headphones_${Date.now()}`;
      const res = await assistantService.handleUserMessage(
        sessionId,
        'Wireless headphones under ₹3000 for gym'
      );

      expect(res.diagnostics?.structuredIntent).toBe('PRODUCT_SEARCH');
      expect(res.products.length).toBeGreaterThanOrEqual(4);
      expect(res.offerProductRequestForm).toBeUndefined();

      // Exact wireless over-ear headphone under ₹3000 must be ranked first
      expect(res.products[0].id).toBe('hp-boat-rockerz-550');
      expect(res.products[0].price).toBeLessThanOrEqual(3000);
      expect(res.products[0].product_type).toBe('headphones');
      expect(res.scoredProducts?.[0]?.isRelatedAlternative).toBeFalsy();

      // Related wireless earbuds/neckbands under ₹3000 for gym must be tagged as related alternatives
      const relatedScored = (res.scoredProducts || []).filter(
        (sp) => sp.isRelatedAlternative
      );
      expect(relatedScored.length).toBeGreaterThanOrEqual(3);
      for (const sp of relatedScored) {
        expect(sp.product.price).toBeLessThanOrEqual(3000);
        expect(['earbuds', 'neckband']).toContain(sp.product.product_type);
        expect(sp.alternativeSectionLabel).toContain('Related alternatives');
      }

      // Grounded message should clearly present Related alternatives
      expect(res.message).toContain('boAt Rockerz 550');
      expect(res.message).toMatch(/Related alternatives/i);
    });
  });

  describe('Case D: Multi-Turn Conversation Context Isolation & Follow-Up Resolution', () => {
    it('executes Turn 1 (Motorcycle Compare) -> Turn 2 (Headphones Search) -> Turn 3 ("Compare the first two") -> Turn 4 ("Best phones under ₹25000") without context pollution', async () => {
      const sessionId = `test_case_d_multiturn_${Date.now()}`;

      // Turn 1: Compare Royal Enfield Hunter 350 vs Triumph Speed 400
      const t1 = await assistantService.handleUserMessage(
        sessionId,
        'Compare Royal Enfield Hunter 350 vs Triumph Speed 400'
      );
      expect(t1.intent).toBe('COMPARE');
      expect(t1.products.map((p) => p.id)).toContain('auto-re-hunter-350');
      expect(t1.products.map((p) => p.id)).toContain('auto-triumph-speed-400-phantom-black');

      // Turn 2: Wireless headphones under ₹3000 for gym (New topic — must NOT inherit Royal Enfield brand or automotive category)
      const t2 = await assistantService.handleUserMessage(
        sessionId,
        'Wireless headphones under ₹3000 for gym'
      );
      expect(t2.activeRequirements.category).toBe('headphones');
      expect(t2.activeRequirements.brand).toBeUndefined();
      expect(t2.products.length).toBeGreaterThanOrEqual(4);
      expect(t2.products[0].id).toBe('hp-boat-rockerz-550');

      // Turn 3: Compare the first two (Follow-up reference — must compare the first two products from Turn 2)
      const expectedFirstTwoIds = [t2.products[0].id, t2.products[1].id];
      const t3 = await assistantService.handleUserMessage(
        sessionId,
        'Compare the first two'
      );
      expect(t3.intent).toBe('COMPARE');
      expect(t3.diagnostics?.structuredIntent).toBe('FOLLOW_UP_REFERENCE');
      expect(t3.products).toHaveLength(2);
      expect(t3.products.map((p) => p.id)).toEqual(expectedFirstTwoIds);
      expect(t3.comparison).toBeDefined();

      // Turn 4: Best phones under ₹25000 (New topic — must start fresh search in smartphones category under ₹25000)
      const t4 = await assistantService.handleUserMessage(
        sessionId,
        'Best phones under ₹25000'
      );
      expect(t4.activeRequirements.category).toBe('smartphones');
      expect(t4.activeRequirements.max_price).toBe(25000);
      expect(t4.activeRequirements.brand).toBeUndefined();
      expect(t4.products.length).toBeGreaterThan(0);
      for (const phone of t4.products) {
        expect(phone.category).toBe('smartphones');
        expect(phone.price).toBeLessThanOrEqual(25000);
      }
    });
  });

  describe('Case E: Missing Product & Retailer Search Link Formatting', () => {
    it('handles "Gaming console under ₹40000" honestly with properly labelled retailer search links and never uses generic "Search Link" text', async () => {
      const sessionId = `test_case_e_missing_console_${Date.now()}`;
      const res = await assistantService.handleUserMessage(
        sessionId,
        'Gaming console under ₹40000'
      );

      expect(res.products).toHaveLength(0);
      expect(res.offerProductRequestForm).toBeDefined();
      expect(res.offerProductRequestForm!.suggestedName.toLowerCase()).toContain(
        'gaming console'
      );

      // Must contain explicit retailer search labels and never "[Search Link]"
      expect(res.message).not.toContain('[Search Link]');
      expect(res.message).toContain('[Search on Amazon India]');
      expect(res.message).toContain('[Search on Flipkart]');
    });

    it('allows submitting a missing-product request with just the product name and email (optional URL) and returns honest request log confirmation', () => {
      const created = productRequestService.createProductRequest({
        requestedName: 'Sony PlayStation 5 Slim Console',
        categoryHint: 'electronics',
        descriptionNotes: 'Under ₹45000',
        sessionId: `req_session_${Date.now()}`,
        contactEmail: `console_buyer_${Date.now()}@example.com`,
        consentGiven: true,
      });

      expect(created.id).toMatch(/^preq_/);
      expect(created.requestedName).toBe('Sony PlayStation 5 Slim Console');
      expect(created.sourceUrl).toContain('https://www.amazon.in/s?k=');
      expect(created.confirmationMessage).toContain(
        'Your product request has been saved in the request log for review.'
      );
    });
  });
});
