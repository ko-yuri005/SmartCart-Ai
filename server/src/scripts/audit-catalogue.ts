import { SEED_PRODUCTS } from '../db/seed-data.js';
import { PRODUCT_TYPE_IMAGE_REGISTRY, ImageResolverService } from '../services/image-resolver.service.js';

interface AuditItem {
  id: string;
  name: string;
  category: string;
  product_type?: string;
  image_type?: string;
  image: string;
  inferred_type: string;
  typeMatch: boolean;
  isRegisteredType: boolean;
}

const resolver = new ImageResolverService();

console.log('--- AUDITING ALL 150 PRODUCTS ---');
console.log(`Total products: ${SEED_PRODUCTS.length}`);

const items: AuditItem[] = SEED_PRODUCTS.map(p => {
  const inferred = resolver.inferProductType(p);
  const typeMatch = (p.product_type === p.image_type) && (p.product_type === inferred);
  const isRegisteredType = !!p.product_type && p.product_type in PRODUCT_TYPE_IMAGE_REGISTRY;
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    product_type: p.product_type,
    image_type: p.image_type,
    image: p.image,
    inferred_type: inferred,
    typeMatch,
    isRegisteredType
  };
});

// Group by category
const byCat = new Map<string, AuditItem[]>();
for (const item of items) {
  const cat = item.category;
  if (!byCat.has(cat)) byCat.set(cat, []);
  byCat.get(cat)!.push(item);
}

for (const [cat, prods] of byCat.entries()) {
  console.log(`\nCategory: [${cat}] (${prods.length} products)`);
  for (const p of prods) {
    const status = p.typeMatch ? '✅' : '⚠️';
    console.log(`  ${status} [${p.id}] ${p.name.slice(0, 40)}...`);
    console.log(`     Type: ${p.product_type} | ImageType: ${p.image_type} | Inferred: ${p.inferred_type}`);
    console.log(`     Image: ${p.image.slice(0, 60)}...`);
  }
}

// Check duplicates or reused images across different product types
const imageToTypes = new Map<string, Set<string>>();
for (const p of SEED_PRODUCTS) {
  const imgBase = p.image.split('?')[0];
  if (!imageToTypes.has(imgBase)) imageToTypes.set(imgBase, new Set());
  imageToTypes.get(imgBase)!.add(p.product_type || 'unknown');
}

console.log('\n--- CHECKING FOR CROSS-TYPE IMAGE REUSE ---');
let crossTypeReuses = 0;
for (const [img, types] of imageToTypes.entries()) {
  if (types.size > 1) {
    console.log(`⚠️ Image reused across multiple types: ${img} -> types: ${Array.from(types).join(', ')}`);
    crossTypeReuses++;
  }
}
if (crossTypeReuses === 0) {
  console.log('✅ No images reused across different product types.');
}
