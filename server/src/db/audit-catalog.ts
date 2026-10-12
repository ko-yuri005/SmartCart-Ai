import fs from 'fs';
import path from 'path';
import { SEED_PRODUCTS } from './seed-data.js';
import {
  imageResolverService,
  PRODUCT_VERIFIED_IMAGE_MAP,
  VISUALLY_VERIFIED_IMAGE_MANIFEST,
} from '../services/image-resolver.service.js';
import { getDatabase, closeDatabase } from './database.js';
import { SqliteProductRepository } from './repositories/product.repository.js';

export function syncCatalogImages() {
  let updatedCount = 0;
  for (const p of SEED_PRODUCTS) {
    const mapped = PRODUCT_VERIFIED_IMAGE_MAP[p.id];
    if (mapped) {
      if (p.image !== mapped.url || p.product_type !== mapped.productType) {
        p.image = mapped.url;
        p.product_type = mapped.productType;
        p.image_type = mapped.productType;
        p.image_verified = true;
        updatedCount++;
      }
    } else if (p.image !== '') {
      p.image = '';
      p.image_verified = false;
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    const seedPath = path.resolve(process.cwd(), 'src/db/seed-data.ts');
    const header = `import { Product } from '../types/index.js';\n\n/**\n * High-quality verified seed product catalogue for SmartCart AI.\n * Contains 400 realistic Indian e-commerce products across 16 categories.\n * Every product contains explicit product_type and a unique visually verified image (0 duplicates)\n * or a safe local placeholder.\n */\nexport const SEED_PRODUCTS: Product[] = `;
    fs.writeFileSync(seedPath, `${header}${JSON.stringify(SEED_PRODUCTS, null, 2)};\n`, 'utf-8');
    console.log(`[Sync] Updated ${updatedCount} products in src/db/seed-data.ts`);
  }

  const db = getDatabase();
  const repo = new SqliteProductRepository(db);
  repo.upsertMany(SEED_PRODUCTS);
  closeDatabase();
  console.log(`[Sync] Synchronized ${SEED_PRODUCTS.length} products into SQLite database.`);
}

export function runCatalogImageAudit() {
  if (process.argv.includes('--sync')) {
    syncCatalogImages();
  }
  const mapEntries = Object.values(PRODUCT_VERIFIED_IMAGE_MAP);
  const manifestEntries = Object.values(VISUALLY_VERIFIED_IMAGE_MANIFEST);
  const report = imageResolverService.generateCatalogAuditReport(SEED_PRODUCTS);
  const validation = imageResolverService.validateCatalog(SEED_PRODUCTS);

  const reportPath = path.resolve(process.cwd(), 'audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log('=== CATALOGUE IMAGE AUDIT SUMMARY ===');
  console.log(`Total Catalogue Products       : ${report.summary.totalProducts}`);
  console.log(`Product Verified Map Entries   : ${mapEntries.length}`);
  console.log(`Unique Manifest URLs           : ${manifestEntries.length}`);
  console.log(`Visually Verified Images       : ${report.summary.visuallyVerifiedCount}`);
  console.log(`  - Exact Model Studio/Wiki    : ${report.summary.officialOrWikimediaExactModelCount}`);
  console.log(`  - Verified Product Photos    : ${report.summary.verifiedProductPhotoCount}`);
  console.log(`Safe Neutral Placeholders      : ${report.summary.placeholderFallbackCount}`);
  console.log(`Duplicate Image URLs           : ${report.summary.duplicateImageUrlCount}`);
  console.log(`Unverified Image URLs          : ${report.summary.unverifiedUrlCount}`);
  console.log(`Mismatches                     : ${report.summary.mismatchCount}`);
  console.log(`Validation Passed              : ${validation.passed}`);
  console.log(`Report written to              : ${reportPath}`);

  if (!validation.passed) {
    console.error('Mismatches:', JSON.stringify(validation.mismatches, null, 2));
    console.error('Duplicates:', JSON.stringify(validation.duplicateUrls, null, 2));
    process.exitCode = 1;
  }

  return { report, validation };
}

if (process.argv[1]?.endsWith('audit-catalog.ts') || process.argv[1]?.endsWith('audit-catalog.js')) {
  runCatalogImageAudit();
}
