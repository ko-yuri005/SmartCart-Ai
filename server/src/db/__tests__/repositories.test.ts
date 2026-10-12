import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteProductRepository } from '../repositories/product.repository.js';
import { SqliteSessionRepository } from '../repositories/session.repository.js';
import { SEED_PRODUCTS } from '../seed-data.js';

describe('SqliteProductRepository', () => {
  let db: Database.Database;
  let productRepo: SqliteProductRepository;

  beforeAll(() => {
    // In-memory test database
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
    productRepo = new SqliteProductRepository(db);
    productRepo.upsertMany(SEED_PRODUCTS);
  });

  afterAll(() => {
    db.close();
  });

  it('should seed and count all products', () => {
    expect(productRepo.count()).toBe(SEED_PRODUCTS.length);
  });

  it('should find product by ID', () => {
    const p = productRepo.findById('hp-boat-airdopes-141');
    expect(p).not.toBeNull();
    expect(p?.brand).toBe('boAt');
    expect(p?.category).toBe('headphones');
    expect(p?.price).toBe(1299);
    expect(Array.isArray(p?.features)).toBe(true);
    expect(Array.isArray(p?.use_cases)).toBe(true);
    expect(p?.use_cases).toContain('gym');
    expect(p?.use_cases).toContain('calls');
  });

  it('should find products by multiple IDs', () => {
    const ids = ['hp-boat-airdopes-141', 'phone-poco-c65'];
    const products = productRepo.findByIds(ids);
    expect(products.length).toBe(2);
  });

  it('should filter products by category', () => {
    const headphones = productRepo.findMany({ category: 'headphones' });
    expect(headphones.length).toBeGreaterThanOrEqual(15);
    expect(headphones.every((h) => h.category === 'headphones')).toBe(true);
  });

  it('should filter products by max price constraint', () => {
    const under3000 = productRepo.findMany({ category: 'headphones', maxPrice: 3000 });
    expect(under3000.length).toBeGreaterThan(0);
    expect(under3000.every((h) => h.price <= 3000)).toBe(true);
  });

  it('should filter in-stock products by default', () => {
    const inStock = productRepo.findMany();
    expect(inStock.every((p) => p.availability === true)).toBe(true);
  });

  it('should retrieve distinct categories and brands', () => {
    const categories = productRepo.getAllCategories();
    expect(categories).toContain('headphones');
    expect(categories).toContain('smartphones');
    expect(categories).toContain('smartwatches');
    expect(categories).toContain('laptops');
    expect(categories).toContain('keyboards-mice');
    expect(categories).toContain('power-accessories');

    const brands = productRepo.getAllBrands();
    expect(brands).toContain('Apple');
    expect(brands).toContain('Sony');
    expect(brands).toContain('boAt');
  });
});

describe('SqliteSessionRepository', () => {
  let db: Database.Database;
  let sessionRepo: SqliteSessionRepository;

  beforeAll(() => {
    db = new Database(':memory:');
    db.exec(`
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
    `);
    sessionRepo = new SqliteSessionRepository(db);
  });

  afterAll(() => {
    db.close();
  });

  it('should create and retrieve a session', () => {
    const session = sessionRepo.getOrCreateSession('test-sess-1');
    expect(session.id).toBe('test-sess-1');
  });

  it('should append messages and track recommended products', () => {
    sessionRepo.addMessage({
      sessionId: 'test-sess-1',
      role: 'user',
      content: 'I need wireless headphones under ₹3000 for gym and calls',
    });

    sessionRepo.addMessage({
      sessionId: 'test-sess-1',
      role: 'assistant',
      content: 'Here are the best headphones for gym and calls under ₹3000:',
      recommendedProductIds: ['hp-oneplus-nord-buds-2r', 'hp-realme-buds-t300'],
      extractedRequirements: {
        intent: 'SEARCH',
        category: 'headphones',
        max_price: 3000,
        use_cases: ['gym', 'calls'],
      },
    });

    const messages = sessionRepo.getMessages('test-sess-1');
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');

    const lastProducts = sessionRepo.getLastRecommendedProducts('test-sess-1');
    expect(lastProducts).toEqual(['hp-oneplus-nord-buds-2r', 'hp-realme-buds-t300']);

    const lastReqs = sessionRepo.getLastRequirements('test-sess-1');
    expect(lastReqs?.category).toBe('headphones');
    expect(lastReqs?.max_price).toBe(3000);
  });
});
