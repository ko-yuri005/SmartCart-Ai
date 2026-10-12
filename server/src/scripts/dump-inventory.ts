import { SEED_PRODUCTS } from '../db/seed-data.js';

console.log('--- ALL PRODUCTS IMAGE & TYPE INVENTORY ---');

for (const p of SEED_PRODUCTS) {
  console.log(`${p.id.padEnd(35)} | ${p.category.padEnd(20)} | ${(p.product_type || '').padEnd(20)} | ${p.image}`);
}
