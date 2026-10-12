import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteProductRepository } from '../../db/repositories/product.repository.js';
import { ComparisonService } from '../comparison.service.js';
import { SEED_PRODUCTS } from '../../db/seed-data.js';

describe('ComparisonService', () => {
  let db: Database.Database;
  let repo: SqliteProductRepository;
  let comparisonService: ComparisonService;

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
    comparisonService = new ComparisonService(repo);
  });

  afterAll(() => {
    db.close();
  });

  it('should generate structured comparison for 2 products', () => {
    const ids = ['hp-boat-airdopes-141', 'hp-oneplus-nord-buds-2r'];
    const res = comparisonService.compareProducts(ids);

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.products.length).toBe(2);
    expect(res.data.indicators.cheapestProductId).toBe('hp-boat-airdopes-141');
    expect(res.data.indicators.highestRatedProductId).toBe('hp-oneplus-nord-buds-2r');
    expect(res.data.indicators.priceSpread).toBe(2199 - 1299);
    expect(res.data.specMatrix.length).toBeGreaterThan(0);
    expect(Array.isArray(res.data.sharedFeatures)).toBe(true);
  });

  it('should generate structured comparison for 3 to 4 products', () => {
    const ids = [
      'hp-boat-airdopes-141',
      'hp-oneplus-nord-buds-2r',
      'hp-realme-buds-t300',
      'hp-noise-buds-vs104-pro',
    ];
    const res = comparisonService.compareProducts(ids);

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.products.length).toBe(4);
    expect(res.data.indicators.cheapestProductId).toBe('hp-boat-airdopes-141');
    expect(res.data.specMatrix.length).toBeGreaterThan(0);
  });

  it('should identify strongest use case match if requested', () => {
    const ids = ['hp-boat-airdopes-141', 'hp-oneplus-nord-buds-2r'];
    const res = comparisonService.compareProducts(ids, ['workout', 'running']);

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.indicators.strongestUseCaseMatchId).toBe('hp-oneplus-nord-buds-2r');
  });

  it('should reject invalid / non-existent product IDs', () => {
    const ids = ['hp-boat-airdopes-141', 'invalid-fake-id-123'];
    const res = comparisonService.compareProducts(ids);

    expect(res.success).toBe(false);
    if (res.success) return;

    expect(res.error).toMatch(/Could not find product/i);
    expect(res.invalidIds).toContain('invalid-fake-id-123');
  });

  it('should reject requests with fewer than 2 products or more than 4 products', () => {
    const oneId = comparisonService.compareProducts(['hp-boat-airdopes-141']);
    expect(oneId.success).toBe(false);

    const fiveIds = comparisonService.compareProducts([
      'hp-boat-airdopes-141',
      'hp-oneplus-nord-buds-2r',
      'hp-realme-buds-t300',
      'hp-noise-buds-vs104-pro',
      'hp-sony-wf-c500',
    ]);
    expect(fiveIds.success).toBe(false);
  });
});
