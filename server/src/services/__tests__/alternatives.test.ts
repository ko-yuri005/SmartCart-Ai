import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteProductRepository } from '../../db/repositories/product.repository.js';
import { FilterService } from '../filter.service.js';
import { AlternativesService } from '../alternatives.service.js';
import { SEED_PRODUCTS } from '../../db/seed-data.js';

describe('AlternativesService', () => {
  let db: Database.Database;
  let repo: SqliteProductRepository;
  let filterService: FilterService;
  let alternativesService: AlternativesService;

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
    alternativesService = new AlternativesService(repo, filterService);
  });

  afterAll(() => {
    db.close();
  });

  it('MUST exclude the original product from alternatives', () => {
    const targetId = 'hp-oneplus-nord-buds-2r';
    const result = alternativesService.findAlternatives(targetId, 4);

    expect(result).not.toBeNull();
    expect(result?.targetProduct.id).toBe(targetId);
    expect(result?.alternatives.length).toBeGreaterThan(0);
    // Crucial: original product must NOT be in alternatives!
    expect(result?.alternatives.some((alt) => alt.product.id === targetId)).toBe(false);
  });

  it('MUST respect category of the target product', () => {
    const targetId = 'phone-oneplus-nord-ce-4';
    const result = alternativesService.findAlternatives(targetId, 4);

    expect(result).not.toBeNull();
    expect(
      result?.alternatives.every((alt) => alt.product.category === 'smartphones')
    ).toBe(true);
  });

  it('MUST return only available products', () => {
    const targetId = 'hp-boat-airdopes-141';
    const result = alternativesService.findAlternatives(targetId, 5);

    expect(result).not.toBeNull();
    expect(result?.alternatives.every((alt) => alt.product.availability === true)).toBe(true);
  });

  it('should rank alternatives by similarity and provide similarity reason', () => {
    const targetId = 'hp-boat-airdopes-141';
    const result = alternativesService.findAlternatives(targetId, 3);

    expect(result).not.toBeNull();
    for (const alt of result!.alternatives) {
      expect(alt.similarityScore).toBeGreaterThan(0);
      expect(alt.similarityReason).toBeDefined();
      expect(typeof alt.priceDifference).toBe('number');
    }
  });

  it('should return null for non-existent product ID', () => {
    const result = alternativesService.findAlternatives('non-existent-product-id');
    expect(result).toBeNull();
  });
});
