import { getDatabase } from '../db/database.js';
import { SqliteProductRepository } from '../db/repositories/product.repository.js';
import { FilterService } from '../services/filter.service.js';
import { RankingService } from '../services/ranking.service.js';
import { RelaxationService } from '../services/relaxation.service.js';
import { ImageResolverService } from '../services/image-resolver.service.js';

interface QueryVerification {
  query: string;
  category?: string;
  maxPrice?: number;
  useCases?: string[];
  expectedProductType: string;
  prohibitedTypes: string[];
}

const testQueries: QueryVerification[] = [
  {
    query: 'I need a bike under 1.5 lakh for daily commuting',
    category: 'vehicles',
    maxPrice: 150000,
    useCases: ['commuting'],
    expectedProductType: 'motorcycle',
    prohibitedTypes: ['car', 'helmet', 'jacket', 'dash_cam']
  },
  {
    query: 'I need a dash cam for my car',
    category: 'automotive',
    useCases: ['dash cam', 'recording', 'safety'],
    expectedProductType: 'dash_cam',
    prohibitedTypes: ['car', 'motorcycle', 'helmet']
  },
  {
    query: 'I need a black hoodie under ₹1500',
    category: 'clothing',
    maxPrice: 1500,
    expectedProductType: 'hoodie',
    prohibitedTypes: ['running_shoes', 'shoes', 'backpack', 'watch']
  },
  {
    query: 'Suggest running shoes for beginners under ₹5000',
    category: 'footwear',
    maxPrice: 5000,
    useCases: ['running', 'workout'],
    expectedProductType: 'running_shoes',
    prohibitedTypes: ['dumbbells', 'clothing', 'headphones']
  },
  {
    query: 'Suggest a good office chair under ₹10000',
    category: 'furniture',
    maxPrice: 10000,
    useCases: ['office', 'ergonomic', 'study'],
    expectedProductType: 'office_chair',
    prohibitedTypes: ['desk', 'sofa', 'table', 'book', 'scooter']
  },
  {
    query: 'Best sunscreen for oily skin under ₹800',
    category: 'beauty',
    maxPrice: 800,
    expectedProductType: 'sunscreen',
    prohibitedTypes: ['shampoo', 'serum', 'perfume']
  },
  {
    query: 'I need a pressure cooker for a family of 4',
    category: 'kitchen',
    expectedProductType: 'pressure_cooker',
    prohibitedTypes: ['kitchen_interior', 'cabinets', 'air_fryer', 'mixer_grinder']
  },
  {
    query: 'I need a laptop for coding under ₹70000',
    category: 'laptops',
    maxPrice: 70000,
    useCases: ['coding', 'programming'],
    expectedProductType: 'laptop',
    prohibitedTypes: ['smartphone', 'tablet', 'book']
  }
];

async function runVerification() {
  const db = getDatabase();
  const repo = new SqliteProductRepository(db);
  const filterService = new FilterService(repo);
  const rankingService = new RankingService();
  const relaxationService = new RelaxationService(filterService, rankingService);

  console.log('====================================================');
  console.log('LIVE QUERY VERIFICATION: SEMANTIC PRODUCT IMAGE ACCURACY');
  console.log('====================================================\n');

  const imageResolver = new ImageResolverService();
  let allPassed = true;

  for (let i = 0; i < testQueries.length; i++) {
    const q = testQueries[i];
    console.log(`[Query ${i + 1}] "${q.query}"`);
    console.log(`Expected Product Type: ${q.expectedProductType}`);

    const result = relaxationService.searchWithRelaxation({
      category: q.category,
      maxPrice: q.maxPrice,
      useCases: q.useCases
    });

    const recommendations = result.products.slice(0, 3);
    if (recommendations.length === 0) {
      console.log('❌ FAILED: No products returned');
      allPassed = false;
      continue;
    }

    console.log(`Returned ${recommendations.length} recommendations:`);
    for (const item of recommendations) {
      const prod = item.product;
      const resolved = imageResolver.resolveImage(prod);
      const isExpected = prod.product_type === q.expectedProductType || 
                         (q.expectedProductType === 'pressure_cooker' && (prod.product_type === 'pressure-cooker' || prod.product_type === 'instant-pot'));
      const isProhibited = q.prohibitedTypes.includes(prod.product_type || '') ||
                           q.prohibitedTypes.includes(prod.image_type || '');

      const matchOk = prod.product_type === prod.image_type;
      console.log(`  - Product: "${prod.name}" (ID: ${prod.id})`);
      console.log(`    Price: ₹${prod.price} | Category: ${prod.category}`);
      console.log(`    Product Type: ${prod.product_type} | Image Type: ${prod.image_type} (Match: ${matchOk ? '✅' : '❌'})`);
      console.log(`    Resolved Image: ${resolved.imageUrl.substring(0, 70)}...`);
      console.log(`    Resolution Exact: ${resolved.isExactType ? 'Yes' : 'No'}`);

      if (!isExpected || isProhibited || !matchOk) {
        console.log(`    ❌ Semantic Mismatch Detected!`);
        allPassed = false;
      } else {
        console.log(`    ✅ Semantically Accurate`);
      }
    }
    console.log('----------------------------------------------------\n');
  }

  console.log(`Summary: All 8 live queries ${allPassed ? 'PASSED ✅' : 'FAILED ❌'}`);
  process.exit(allPassed ? 0 : 1);
}

runVerification().catch(err => {
  console.error(err);
  process.exit(1);
});
