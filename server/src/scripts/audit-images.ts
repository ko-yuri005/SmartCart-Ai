import { SEED_PRODUCTS } from '../db/seed-data.js';

interface AuditItem {
  id: string;
  name: string;
  category: string;
  image: string;
}

console.log(`Auditing ${SEED_PRODUCTS.length} products...`);

// Group by category
const byCategory = new Map<string, typeof SEED_PRODUCTS>();
for (const p of SEED_PRODUCTS) {
  if (!byCategory.has(p.category)) {
    byCategory.set(p.category, []);
  }
  byCategory.get(p.category)!.push(p);
}

for (const [cat, prods] of byCategory.entries()) {
  console.log(`\n========================================`);
  console.log(`CATEGORY: ${cat} (${prods.length} products)`);
  console.log(`========================================`);
  for (const p of prods) {
    // Extract unsplash photo ID if present
    const photoIdMatch = p.image.match(/photo-([0-9a-fA-F-]+)/);
    const photoId = photoIdMatch ? photoIdMatch[1] : p.image.slice(0, 40);
    console.log(`[${p.id}] "${p.name.slice(0, 50)}" -> photo: ${photoId}`);
  }
}
