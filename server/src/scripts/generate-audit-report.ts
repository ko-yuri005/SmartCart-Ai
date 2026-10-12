import { SEED_PRODUCTS } from '../db/seed-data.js';
import { ImageResolverService, PRODUCT_TYPE_IMAGE_REGISTRY } from '../services/image-resolver.service.js';
import * as fs from 'fs';

interface ProductAuditRecord {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  product_type: string;
  image_type: string;
  image: string;
  resolved_image: string;
  is_exact_type: boolean;
  status: 'VERIFIED' | 'MISMATCH' | 'MISSING_IMAGE' | 'UNREGISTERED_TYPE';
  notes?: string;
}

const resolver = new ImageResolverService();
const auditList: ProductAuditRecord[] = [];

for (const p of SEED_PRODUCTS) {
  const resolved = resolver.resolveImage(p);
  const inferred = resolver.inferProductType(p);
  
  let status: 'VERIFIED' | 'MISMATCH' | 'MISSING_IMAGE' | 'UNREGISTERED_TYPE' = 'VERIFIED';
  let notes = '';

  if (!p.image || p.image.trim().length === 0) {
    status = 'MISSING_IMAGE';
    notes = 'Product has no image URL';
  } else if (!p.product_type || !(p.product_type in PRODUCT_TYPE_IMAGE_REGISTRY)) {
    status = 'UNREGISTERED_TYPE';
    notes = `Product type '${p.product_type}' is not registered`;
  } else if (p.product_type !== p.image_type) {
    status = 'MISMATCH';
    notes = `product_type (${p.product_type}) does not match image_type (${p.image_type})`;
  } else if (p.product_type !== inferred) {
    status = 'MISMATCH';
    notes = `product_type (${p.product_type}) does not match inferred type (${inferred})`;
  }

  auditList.push({
    id: p.id,
    name: p.name,
    category: p.category,
    brand: p.brand,
    price: p.price,
    product_type: p.product_type || 'unknown',
    image_type: p.image_type || 'unknown',
    image: p.image,
    resolved_image: resolved.imageUrl,
    is_exact_type: resolved.isExactType,
    status,
    notes: notes || undefined
  });
}

fs.writeFileSync('audit-report.json', JSON.stringify(auditList, null, 2));

const mismatches = auditList.filter(a => a.status !== 'VERIFIED');
console.log(`\n======================================================`);
console.log(`CATALOGUE IMAGE AUDIT SUMMARY`);
console.log(`======================================================`);
console.log(`Total Products Audited: ${auditList.length}`);
console.log(`Verified & Semantically Matched: ${auditList.filter(a => a.status === 'VERIFIED').length} / ${auditList.length}`);
console.log(`Mismatches Found: ${mismatches.length}`);

if (mismatches.length > 0) {
  console.log('\nRemaining Mismatches:');
  for (const m of mismatches) {
    console.log(`❌ [${m.id}] ${m.name}: ${m.notes}`);
  }
} else {
  console.log(`\n✅ 100% of products are verified and semantically matched!`);
}
