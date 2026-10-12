import { SEED_PRODUCTS } from '../db/seed-data.js';

console.log('--- AUDITING ALL 150 PRODUCTS BY NAME VS TYPE ---');

for (const p of SEED_PRODUCTS) {
  const n = p.name.toLowerCase();
  const t = p.product_type || '';
  
  // Check if type makes no sense with category or name
  if (p.category === 'power-accessories' && t !== 'power-bank' && t !== 'wall-charger' && t !== 'charging-station') {
    console.log(`❌ MISMATCH in power-accessories: [${p.id}] ${p.name} -> type: ${t}`);
  }
  if (p.category === 'gifts' && (n.includes('perfume') || n.includes('parfum')) && t !== 'perfume') {
    console.log(`❌ MISMATCH in gifts: [${p.id}] ${p.name} -> type: ${t}`);
  }
  if (p.category === 'sports-fitness' && (n.includes('duffle') || n.includes('bag')) && t !== 'gym-bag') {
    console.log(`❌ MISMATCH in sports-fitness: [${p.id}] ${p.name} -> type: ${t}`);
  }
  if (p.category === 'furniture' && n.includes('bookshelf') && t !== 'bookshelf') {
    console.log(`❌ MISMATCH in furniture: [${p.id}] ${p.name} -> type: ${t}`);
  }
  if (p.category === 'furniture' && (n.includes('chair')) && t !== 'office-chair') {
    console.log(`❌ MISMATCH in furniture: [${p.id}] ${p.name} -> type: ${t}`);
  }
  if (p.category === 'automotive' && n.includes('dash cam') && t !== 'dash-cam') {
    console.log(`❌ MISMATCH in automotive: [${p.id}] ${p.name} -> type: ${t}`);
  }
  if (p.category === 'automotive' && n.includes('helmet') && t !== 'helmet') {
    console.log(`❌ MISMATCH in automotive: [${p.id}] ${p.name} -> type: ${t}`);
  }
  if (p.category === 'footwear' && t !== 'running-shoes' && t !== 'training-shoes' && t !== 'sneakers' && t !== 'boots') {
    console.log(`❌ MISMATCH in footwear: [${p.id}] ${p.name} -> type: ${t}`);
  }
  if (p.category === 'fashion' && t !== 'hoodie' && t !== 'jacket' && t !== 't-shirt' && t !== 'kurta') {
    console.log(`❌ MISMATCH in fashion: [${p.id}] ${p.name} -> type: ${t}`);
  }
  if (p.category === 'kitchen-appliances' && t !== 'pressure-cooker' && t !== 'air-fryer' && t !== 'mixer-grinder' && t !== 'induction-cooktop' && t !== 'cookware-set') {
    console.log(`❌ MISMATCH in kitchen: [${p.id}] ${p.name} -> type: ${t}`);
  }
}
