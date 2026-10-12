import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteProductRepository } from '../../db/repositories/product.repository.js';
import { FilterService } from '../filter.service.js';
import { RankingService } from '../ranking.service.js';
import { RelaxationService } from '../relaxation.service.js';
import { SEED_PRODUCTS } from '../../db/seed-data.js';

describe('RelaxationService (Zero-Match Handling)', () => {
  let db: Database.Database;
  let repo: SqliteProductRepository;
  let filterService: FilterService;
  let rankingService: RankingService;
  let relaxationService: RelaxationService;

  beforeAll(() => {
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
        availability INTEGER NOT NULL DEFAULT 1,
        product_type TEXT,
        image_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    repo = new SqliteProductRepository(db);
    repo.upsertMany(SEED_PRODUCTS);
    filterService = new FilterService(repo);
    rankingService = new RankingService();
    relaxationService = new RelaxationService(filterService, rankingService);
  });

  afterAll(() => {
    db.close();
  });

  it('should return exact matches when criteria are met without relaxation', () => {
    const result = relaxationService.searchWithRelaxation({
      category: 'headphones',
      maxPrice: 3000,
      useCases: ['gym'],
    });

    expect(result.isRelaxed).toBe(false);
    expect(result.relaxedFields.length).toBe(0);
    expect(result.products.length).toBeGreaterThan(0);
  });

  it('should relax budget constraint when no headphone exists under an unrealistically low price with ANC', () => {
    // In our database, the cheapest ANC headphone is Realme Buds T300 at ₹2,299
    // Searching under ₹1,000 for ANC headphone will produce 0 exact matches.
    const result = relaxationService.searchWithRelaxation({
      category: 'headphones',
      maxPrice: 1000,
      features: ['anc'],
    });

    // It must detect zero exact matches and relax safely
    expect(result.isRelaxed).toBe(true);
    expect(result.relaxedFields.length).toBeGreaterThan(0);
    expect(result.explanation).toBeDefined();
    // Must NOT claim exact match
    expect(result.explanation).toMatch(/no exact matches/i);
  });

  it('should never silently relax constraints without flagging isRelaxed: true', () => {
    // Impossible feature constraint
    const result = relaxationService.searchWithRelaxation({
      category: 'smartphones',
      maxPrice: 10000,
      features: ['nonexistent_alien_quantum_processor'],
    });

    if (result.products.length > 0) {
      expect(result.isRelaxed).toBe(true);
      expect(result.relaxedFields).toContain('features');
      expect(result.explanation).toBeDefined();
    }
  });

  it('should return empty results with explanation if criteria cannot be met even after max relaxation', () => {
    const result = relaxationService.searchWithRelaxation({
      category: 'laptops',
      maxPrice: 2000, // No laptop exists under ₹2,000 even with 35% relaxation
    });

    expect(result.products.length).toBe(0);
    expect(result.explanation).toBeDefined();
  });
});
