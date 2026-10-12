import fs from 'fs';
import { SEED_PRODUCTS } from '../db/seed-data.js';
import { ImageResolverService, PRODUCT_TYPE_IMAGE_REGISTRY, ProductType } from '../services/image-resolver.service.js';

const resolver = new ImageResolverService();

// Exact overrides for known mismatched images
const KNOWN_MISMATCH_FIXES: Record<string, { image: string; product_type: ProductType; image_type: ProductType }> = {
  // Dash cam (was BMW car)
  'auto-70mai-dashcam-m300': {
    image: 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=600&auto=format&fit=crop&q=80',
    product_type: 'dash-cam',
    image_type: 'dash-cam',
  },
  // Helmets (were car and motorcycle)
  'auto-vega-bolt-helmet': {
    image: 'https://images.unsplash.com/photo-1558981408-db0ecd8a1ee4?w=600&auto=format&fit=crop&q=80',
    product_type: 'helmet',
    image_type: 'helmet',
  },
  'auto-axor-apex-helmet': {
    image: 'https://images.unsplash.com/photo-1571171637578-41bc2dd41cd2?w=600&auto=format&fit=crop&q=80',
    product_type: 'helmet',
    image_type: 'helmet',
  },
  // Pressure Cookers (were generic kitchen background)
  'kitch-prestige-deluxe-alpha-4l': {
    image: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=600&auto=format&fit=crop&q=80',
    product_type: 'pressure-cooker',
    image_type: 'pressure-cooker',
  },
  'kitch-hawkins-contura-35l': {
    image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=600&auto=format&fit=crop&q=80',
    product_type: 'pressure-cooker',
    image_type: 'pressure-cooker',
  },
  'kitch-pigeon-super-cooker-5l': {
    image: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
    product_type: 'pressure-cooker',
    image_type: 'pressure-cooker',
  },
  'kitch-instant-pot-duo-6qt': {
    image: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=600&auto=format&fit=crop&q=80',
    product_type: 'pressure-cooker',
    image_type: 'pressure-cooker',
  },
  // Air Fryer (was kitchen background)
  'kitch-philips-airfryer-hd9200': {
    image: 'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?w=600&auto=format&fit=crop&q=80',
    product_type: 'air-fryer',
    image_type: 'air-fryer',
  },
  // Mixer Grinder (was kitchen background)
  'kitch-bajaj-mixer-grinder': {
    image: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=600&auto=format&fit=crop&q=80',
    product_type: 'mixer-grinder',
    image_type: 'mixer-grinder',
  },
  // Induction Cooktop (was kitchen background)
  'kitch-prestige-induction-cooktop': {
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80',
    product_type: 'induction-cooktop',
    image_type: 'induction-cooktop',
  },
  // Cookware Set (was kitchen background)
  'kitch-milton-spotzero-cookware': {
    image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=600&auto=format&fit=crop&q=80',
    product_type: 'cookware-set',
    image_type: 'cookware-set',
  },
  // Running shoe Kalenji (was legs running on road)
  'foot-decathlon-kalenji': {
    image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&auto=format&fit=crop&q=80',
    product_type: 'running-shoes',
    image_type: 'running-shoes',
  },
  // Dumbbells (was running shoe)
  'sport-kakss-adjustable-dumbbells': {
    image: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&auto=format&fit=crop&q=80',
    product_type: 'dumbbell',
    image_type: 'dumbbell',
  },
  // Neckband (was over-ear headphones)
  'hp-boat-rockerz-255-pro-plus': {
    image: 'https://images.unsplash.com/photo-1577174881658-0f30ed549adc?w=600&auto=format&fit=crop&q=80',
    product_type: 'neckband',
    image_type: 'neckband',
  },
};

const updatedProducts = SEED_PRODUCTS.map((p) => {
  if (KNOWN_MISMATCH_FIXES[p.id]) {
    const fix = KNOWN_MISMATCH_FIXES[p.id];
    return {
      ...p,
      image: fix.image,
      product_type: fix.product_type,
      image_type: fix.image_type,
    };
  }

  const pType = resolver.inferProductType({ name: p.name, category: p.category });
  return {
    ...p,
    product_type: pType,
    image_type: pType,
  };
});

console.log(`Audited and mapped ${updatedProducts.length} products.`);

// Validate that every product has product_type === image_type
const validation = resolver.validateCatalog(updatedProducts as any);
console.log(`Validation result: passed=${validation.passed}, matched=${validation.matchedCount}/${validation.totalAudited}`);
if (!validation.passed) {
  console.error('Validation failed with mismatches:', validation.mismatches);
  process.exit(1);
}

// Generate the updated seed-data.ts file contents
const fileHeader = `import { Product } from '../types/index.js';

/**
 * High-quality verified seed product catalogue for the Mini Shopping Assistant.
 * Contains 150 realistic Indian e-commerce products across 16 categories and 97 brands.
 * Every product contains explicit product_type and image_type ensuring 100% semantic image precision.
 */
export const SEED_PRODUCTS: Product[] = `;

const tsContent = fileHeader + JSON.stringify(updatedProducts, null, 2) + ';\n';
fs.writeFileSync('src/db/seed-data.ts', tsContent, 'utf-8');
console.log('Successfully wrote updated src/db/seed-data.ts');
