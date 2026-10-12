import { SEED_PRODUCTS } from '../db/seed-data.js';

console.log('--- DETAILED SCAN OF POTENTIAL MISMATCHES ---');

for (const p of SEED_PRODUCTS) {
  // Check laptop with power-bank image
  if (p.image.includes('1609592424109')) {
    console.log(`[PowerBank Image Match] ID: ${p.id}, Name: ${p.name}, Category: ${p.category}, Type: ${p.product_type}`);
  }
  // Check study-table with wall-charger image
  if (p.image.includes('1583863788434')) {
    console.log(`[WallCharger Image Match] ID: ${p.id}, Name: ${p.name}, Category: ${p.category}, Type: ${p.product_type}`);
  }
  // Check 1553062407-98eeb64c6a62 image
  if (p.image.includes('1553062407-98eeb64c6a62')) {
    console.log(`[Bag/Shoe Image Match] ID: ${p.id}, Name: ${p.name}, Category: ${p.category}, Type: ${p.product_type}`);
  }
  // Check perfume with necklace type
  if (p.id === 'gift-titan-skinn-perfume-duo' || p.name.toLowerCase().includes('perfume')) {
    console.log(`[Perfume Match] ID: ${p.id}, Name: ${p.name}, Category: ${p.category}, Type: ${p.product_type}, ImgType: ${p.image_type}`);
  }
  // Check gym bag with running-shoes type
  if (p.id.includes('bag') || p.name.toLowerCase().includes('bag')) {
    console.log(`[Bag Match] ID: ${p.id}, Name: ${p.name}, Category: ${p.category}, Type: ${p.product_type}, ImgType: ${p.image_type}`);
  }
  // Check helmets
  if (p.name.toLowerCase().includes('helmet')) {
    console.log(`[Helmet Match] ID: ${p.id}, Name: ${p.name}, Category: ${p.category}, Type: ${p.product_type}, Img: ${p.image}`);
  }
}
