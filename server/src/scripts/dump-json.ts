import { SEED_PRODUCTS } from '../db/seed-data.js';
import fs from 'fs';

const simplified = SEED_PRODUCTS.map((p, idx) => ({
  index: idx + 1,
  id: p.id,
  category: p.category,
  name: p.name,
  image: p.image,
}));

fs.writeFileSync('products_dump.json', JSON.stringify(simplified, null, 2), 'utf-8');
console.log('Saved', simplified.length, 'products to products_dump.json');
