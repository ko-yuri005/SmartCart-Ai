import { getDatabase, closeDatabase } from './database.js';
import { SqliteProductRepository } from './repositories/product.repository.js';
import { SEED_PRODUCTS } from './seed-data.js';

export function runSeed(verbose = true): number {
  const db = getDatabase();
  const repo = new SqliteProductRepository(db);

  if (verbose) {
    console.log(`[Seed] Seeding ${SEED_PRODUCTS.length} products into SQLite database...`);
  }

  repo.upsertMany(SEED_PRODUCTS);
  repo.seedMarketplaceCatalogueEnhancements();

  const total = repo.count();
  const categories = repo.getAllCategories();
  const brands = repo.getAllBrands();

  if (verbose) {
    console.log(`[Seed] Successfully seeded ${total} products!`);
    console.log(`[Seed] Categories (${categories.length}):`, categories.join(', '));
    console.log(`[Seed] Brands (${brands.length}):`, brands.slice(0, 10).join(', ') + '...');
  }

  return total;
}

// If executed directly
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  try {
    runSeed(true);
    closeDatabase();
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error during seeding:', err);
    process.exit(1);
  }
}
