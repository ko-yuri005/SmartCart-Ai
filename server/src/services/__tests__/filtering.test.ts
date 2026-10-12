import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteProductRepository } from '../../db/repositories/product.repository.js';
import { FilterService } from '../filter.service.js';
import { SEED_PRODUCTS } from '../../db/seed-data.js';

describe('FilterService', () => {
  let db: Database.Database;
  let repo: SqliteProductRepository;
  let filterService: FilterService;

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
  });

  afterAll(() => {
    db.close();
  });

  it('should filter exact category', () => {
    const products = filterService.filterProducts({ category: 'headphones' });
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p) => p.category === 'headphones')).toBe(true);
  });

  it('should normalize category variations correctly', () => {
    const fromEarbuds = filterService.filterProducts({ category: 'earbuds' });
    const fromWireless = filterService.filterProducts({ category: 'wireless headphones' });
    const fromTws = filterService.filterProducts({ category: 'tws' });

    expect(fromEarbuds.length).toBeGreaterThan(0);
    expect(fromEarbuds.every((p) => p.category === 'headphones')).toBe(true);
    expect(fromWireless.length).toBe(fromEarbuds.length);
    expect(fromTws.length).toBe(fromEarbuds.length);

    // Other categories
    expect(filterService.normalizeCategory('phone')).toBe('smartphones');
    expect(filterService.normalizeCategory('fitness band')).toBe('smartwatches');
    expect(filterService.normalizeCategory('macbook')).toBe('laptops');
    expect(filterService.normalizeCategory('keyboard')).toBe('keyboards-mice');
    expect(filterService.normalizeCategory('powerbank')).toBe('power-accessories');
  });

  it('should filter by maximum price constraint', () => {
    const maxPrice = 3000;
    const products = filterService.filterProducts({ category: 'headphones', maxPrice });
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p) => p.price <= maxPrice)).toBe(true);
  });

  it('should filter by minimum price constraint', () => {
    const minPrice = 50000;
    const products = filterService.filterProducts({ category: 'smartphones', minPrice });
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p) => p.price >= minPrice)).toBe(true);
  });

  it('should filter by combined price range (min and max)', () => {
    const products = filterService.filterProducts({
      category: 'smartphones',
      minPrice: 20000,
      maxPrice: 40000,
    });
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p) => p.price >= 20000 && p.price <= 40000)).toBe(true);
  });

  it('should filter by brand in a normalized, case-insensitive way', () => {
    const boatLower = filterService.filterProducts({ brand: 'boat' });
    const boatUpper = filterService.filterProducts({ brand: 'boAt' });
    expect(boatLower.length).toBeGreaterThan(0);
    expect(boatLower.length).toBe(boatUpper.length);
    expect(boatLower.every((p) => p.brand.toLowerCase() === 'boat')).toBe(true);
  });

  it('should filter by inStock availability (exclude out of stock by default)', () => {
    const inStockProducts = filterService.filterProducts({});
    expect(inStockProducts.every((p) => p.availability === true)).toBe(true);
    // Boult Audio Z40 Pro was seeded as availability = false
    expect(inStockProducts.some((p) => p.id === 'hp-boult-audio-z40-pro')).toBe(false);

    // Explicitly allow out of stock
    const allProducts = filterService.filterProducts({ inStockOnly: false });
    expect(allProducts.some((p) => p.id === 'hp-boult-audio-z40-pro')).toBe(true);
  });

  it('should filter by required features (e.g. ANC)', () => {
    const ancProducts = filterService.filterProducts({
      category: 'headphones',
      features: ['anc'],
    });
    expect(ancProducts.length).toBeGreaterThan(0);
    expect(
      ancProducts.every((p) =>
        filterService.matchesAllFeatures(p, ['anc'])
      )
    ).toBe(true);
  });

  it('should filter by use case (e.g. gym)', () => {
    const gymProducts = filterService.filterProducts({
      category: 'headphones',
      useCases: ['gym'],
    });
    expect(gymProducts.length).toBeGreaterThan(0);
    expect(gymProducts.every((p) => p.use_cases.some((u) => u.toLowerCase().includes('gym')))).toBe(
      true
    );
  });

  it('should handle combined complex filters', () => {
    const results = filterService.filterProducts({
      category: 'headphones',
      maxPrice: 3000,
      useCases: ['gym'],
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.category === 'headphones')).toBe(true);
    expect(results.every((p) => p.price <= 3000)).toBe(true);
    expect(results.every((p) => p.use_cases.some((u) => u.toLowerCase().includes('gym')))).toBe(
      true
    );
  });
});
