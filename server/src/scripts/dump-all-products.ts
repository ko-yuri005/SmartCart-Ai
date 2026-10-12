import { SEED_PRODUCTS } from '../db/seed-data.js';

console.log('Total products in catalogue:', SEED_PRODUCTS.length);

for (const p of SEED_PRODUCTS) {
  console.log(`ID: ${p.id} | Cat: ${p.category} | Name: ${p.name}`);
  console.log(`   Img: ${p.image}`);
}
