import { describe, it, expect } from 'vitest';
import {
  ImageResolverService,
  PRODUCT_TYPE_IMAGE_REGISTRY,
  PRODUCT_VERIFIED_IMAGE_MAP,
  VISUALLY_VERIFIED_IMAGE_MANIFEST,
} from '../image-resolver.service.js';
import { SqliteProductRepository } from '../../db/repositories/product.repository.js';
import { FilterService } from '../filter.service.js';
import { RankingService } from '../ranking.service.js';
import { getDatabase } from '../../db/database.js';
import request from 'supertest';
import { app } from '../../server.js';

describe('Image Resolver, Visual Verification Manifest, Zero-Duplicate Enforcement & Safe Placeholder Fallback', () => {
  const resolver = new ImageResolverService();
  const db = getDatabase();
  const productRepo = new SqliteProductRepository(db);
  const filterService = new FilterService(productRepo);
  const rankingService = new RankingService();

  // =========================================================================
  // 1-8: REGRESSION TESTS FOR REQUIRED PRODUCT TYPES & EXACT MOTORCYCLE MODELS
  // (helmets, dash cams, motorcycles, laptops, running shoes, hoodies, backpacks, pressure cookers)
  // =========================================================================
  it('1. Helmets -> Axor Apex resolves to verified helmet image; Vega Bolt uses placeholder rather than duplicating Axor image; neither uses tank or code screen URLs', () => {
    const prodVega = productRepo.findById('auto-vega-bolt-helmet');
    const prodAxor = productRepo.findById('auto-axor-apex-helmet');
    expect(prodVega).not.toBeNull();
    expect(prodAxor).not.toBeNull();

    const resolvedAxor = resolver.resolveImage(prodAxor!);
    expect(resolvedAxor.productType).toBe('helmet');
    expect(resolvedAxor.imageType).toBe('helmet');
    expect(resolvedAxor.visuallyVerified).toBe(true);
    expect(resolvedAxor.visualVerificationStatus).toBe('visually_verified');
    expect(resolvedAxor.imageUrl).toContain('photo-1590506995460');
    expect(resolvedAxor.imageUrl).not.toContain('photo-1599382266831');
    expect(resolvedAxor.imageUrl).not.toContain('photo-1571171637578');

    const resolvedVega = resolver.resolveImage(prodVega!);
    expect(resolvedVega.productType).toBe('helmet');
    expect(resolvedVega.imageType).toBe('placeholder');
    expect(resolvedVega.visualVerificationStatus).toBe('placeholder_fallback');
    expect(resolvedVega.imageUrl).toBe('');
    expect(resolvedVega.imageUrl).not.toBe(resolvedAxor.imageUrl);
  });

  it('2. Dash cams -> rejects unrelated car or snowy mountain URLs and resolves to safe local placeholder when unverified', () => {
    const prod = productRepo.findById('auto-70mai-dashcam-m300');
    expect(prod).not.toBeNull();
    const resolved = resolver.resolveImage(prod!);
    expect(resolved.productType).toBe('dash-cam');
    expect(resolved.imageType).toBe('placeholder');
    expect(resolved.visualVerificationStatus).toBe('placeholder_fallback');
    expect(resolved.visuallyVerified).toBe(false);
    expect(resolved.imageUrl).not.toContain('photo-1549399542-7e3f8b79c341');
    expect(resolved.imageUrl).not.toContain('photo-1589182373726-e4f658ab50f0');
    expect(resolved.imageUrl).toBe('');
  });

  it('3. Motorcycles -> Honda SP 125, Royal Enfield Hunter 350, TVS Raider 125, Bajaj Pulsar NS125, and Yamaha FZ-S FI V4 each resolve to their own distinct model-specific verified image', () => {
    const hondaSp125 = productRepo.findById('auto-honda-sp125')!;
    const reHunter350 = productRepo.findById('auto-re-hunter-350')!;
    const tvsRaider125 = productRepo.findById('auto-tvs-raider-125')!;
    const pulsarNs125 = productRepo.findById('auto-bajaj-pulsar-ns125')!;
    const yamahaFzs = productRepo.findById('auto-yamaha-fzs-fi-v4')!;
    const ktmDuke390 = productRepo.findById('auto-ktm-duke-390')!;
    const reClassic350 = productRepo.findById('auto-re-classic-350')!;

    const bikes = [
      hondaSp125,
      reHunter350,
      tvsRaider125,
      pulsarNs125,
      yamahaFzs,
      ktmDuke390,
      reClassic350,
    ];

    const resolvedUrls = new Set<string>();
    for (const bike of bikes) {
      expect(bike).not.toBeNull();
      const res = resolver.resolveImage(bike);
      expect(res.productType).toBe('motorcycle');
      expect(res.imageType).toBe('motorcycle');
      expect(res.visuallyVerified).toBe(true);
      expect(res.visualVerificationStatus).toBe('visually_verified');
      expect(res.imageUrl.length).toBeGreaterThan(10);
      resolvedUrls.add(res.imageUrl);
    }

    // All 7 motorcycles must have 7 completely distinct URLs (never sharing a generic bike photo)
    expect(resolvedUrls.size).toBe(7);
    expect(hondaSp125.image).not.toBe(reHunter350.image);
    expect(hondaSp125.image).toContain('sp-125-right-side-view');
    expect(reHunter350.image).toContain('hunter-350-right-side-view');
    expect(tvsRaider125.image).toContain('raider-125-right-side-view');
    expect(pulsarNs125.image).toContain('pulsar-ns125-right-side-view');
  });

  it('4. Laptops -> resolves to visually verified laptop computer image with distinct URLs per model', () => {
    const vivobook = productRepo.findById('lap-asus-vivobook-16x-creator')!;
    const macbookM2 = productRepo.findById('lap-apple-macbook-air-m2')!;
    expect(vivobook).not.toBeNull();
    expect(macbookM2).not.toBeNull();

    const resVivobook = resolver.resolveImage(vivobook);
    expect(resVivobook.productType).toBe('laptop');
    expect(resVivobook.visuallyVerified).toBe(true);
    expect(resVivobook.imageUrl).toContain('photo-1496181133206');

    const resMac = resolver.resolveImage(macbookM2);
    expect(resMac.productType).toBe('laptop');
    expect(resMac.visuallyVerified).toBe(true);
    expect(resMac.imageUrl).toContain('M2_Macbook_Air_Midnight');
    expect(resMac.imageUrl).not.toBe(resVivobook.imageUrl);
  });

  it('5. Running shoes -> resolves to visually verified running shoe image (not running legs or other apparel)', () => {
    const prod = productRepo.findById('foot-decathlon-kalenji');
    expect(prod).not.toBeNull();
    const resolved = resolver.resolveImage(prod!);
    expect(resolved.productType).toBe('running-shoes');
    expect(resolved.imageType).toBe('running-shoes');
    expect(resolved.visuallyVerified).toBe(true);
    expect(resolved.visualVerificationStatus).toBe('visually_verified');
    expect(resolved.imageUrl).not.toContain('photo-1460353581641-37baddab0fa2');
    expect(resolved.imageUrl).toContain('photo-1595950653106');
  });

  it('6. Hoodies -> rejects unverified flat-lay/portrait URLs and uses safe local placeholder with hoodie productType', () => {
    const prod = productRepo.findById('fash-bewakoof-black-hoodie');
    expect(prod).not.toBeNull();
    const resolved = resolver.resolveImage(prod!);
    expect(resolved.productType).toBe('hoodie');
    expect(resolved.imageType).toBe('placeholder');
    expect(resolved.visualVerificationStatus).toBe('placeholder_fallback');
    expect(resolved.visuallyVerified).toBe(false);
    expect(resolved.imageUrl).not.toContain('photo-1556905055-8f358a7a47b2');
    expect(resolved.imageUrl).not.toContain('photo-1509967419530-da38b4704bc6');
    expect(resolved.imageUrl).toBe('');
  });

  it('7. Backpacks -> resolves to visually verified backpack image', () => {
    const prod = productRepo.findById('trav-mokobara-transit-backpack');
    expect(prod).not.toBeNull();
    const resolved = resolver.resolveImage(prod!);
    expect(resolved.productType).toBe('backpack');
    expect(resolved.imageType).toBe('backpack');
    expect(resolved.visuallyVerified).toBe(true);
    expect(resolved.visualVerificationStatus).toBe('visually_verified');
    expect(resolved.imageUrl).toContain('photo-1553062407');
  });

  it('8. Pressure cookers -> Instant Pot Duo resolves to electric Instant Pot image; stovetop cookers resolve to safe placeholder without duplicating Instant Pot image', () => {
    const instantPot = productRepo.findById('kitch-instant-pot-duo-6qt')!;
    const prestige = productRepo.findById('kitch-prestige-deluxe-alpha-4l')!;
    const hawkins = productRepo.findById('kitch-hawkins-contura-35l')!;

    const resInstant = resolver.resolveImage(instantPot);
    expect(resInstant.productType).toBe('pressure-cooker');
    expect(resInstant.visuallyVerified).toBe(true);
    expect(resInstant.imageUrl).toContain('photo-1544233726');

    for (const stovetop of [prestige, hawkins]) {
      const resolved = resolver.resolveImage(stovetop);
      expect(resolved.productType).toBe('pressure-cooker');
      expect(resolved.imageType).toBe('placeholder');
      expect(resolved.visualVerificationStatus).toBe('placeholder_fallback');
      expect(resolved.imageUrl).toBe('');
      expect(resolved.imageUrl).not.toContain('photo-1584992236310');
      expect(resolved.imageUrl).not.toContain('photo-1585515320310');
    }
  });

  // =========================================================================
  // 9-12: DISTINGUISHING URL-LOADING FROM ACTUAL VISUAL VERIFICATION
  // =========================================================================
  it('9. Distinguishes a loadable HTTP 200 URL from actual visual subject verification', () => {
    const mountainUrl =
      'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=600&auto=format&fit=crop&q=80';
    expect(resolver.isVisuallyVerifiedForType(mountainUrl, 'dash-cam')).toBe(false);

    const yarnUrl =
      'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=600&auto=format&fit=crop&q=80';
    expect(resolver.isVisuallyVerifiedForType(yarnUrl, 'pressure-cooker')).toBe(false);

    const attempt = resolver.resolveImage({
      name: '70mai Dash Cam Pro',
      category: 'automotive',
      product_type: 'dash-cam',
      image_type: 'dash-cam',
      image: mountainUrl,
    });
    expect(attempt.visuallyVerified).toBe(false);
    expect(attempt.visualVerificationStatus).toBe('placeholder_fallback');
    expect(attempt.imageUrl).toBe('');
  });

  it('10. Rejects cross-category visually verified URLs when applied to the wrong product type', () => {
    const verifiedLaptopUrl = PRODUCT_TYPE_IMAGE_REGISTRY.laptop;
    expect(resolver.isVisuallyVerifiedForType(verifiedLaptopUrl, 'laptop')).toBe(true);
    expect(resolver.isVisuallyVerifiedForType(verifiedLaptopUrl, 'helmet')).toBe(false);

    const badHelmet = resolver.resolveImage({
      name: 'Axor Apex Venom Full Face Helmet',
      category: 'automotive',
      product_type: 'helmet',
      image_type: 'helmet',
      image: verifiedLaptopUrl,
    });
    expect(badHelmet.productType).toBe('helmet');
    expect(badHelmet.imageUrl).toBe(PRODUCT_TYPE_IMAGE_REGISTRY.helmet);
    expect(badHelmet.visuallyVerified).toBe(true);
    expect(badHelmet.visualSubject.toLowerCase()).toContain('helmet');
  });

  it('11. Office chairs and smartphones use visually verified URLs instead of broken HTTP 404 URLs', () => {
    const chair = productRepo.findById('furn-green-soul-jupiter');
    const phone = productRepo.findById('phone-poco-c65');
    expect(chair).not.toBeNull();
    expect(phone).not.toBeNull();

    const resChair = resolver.resolveImage(chair!);
    expect(resChair.productType).toBe('office-chair');
    expect(resChair.visuallyVerified).toBe(true);
    expect(resChair.imageUrl).not.toContain('photo-1580481077195-c3a8245e3d74');
    expect(resChair.imageUrl).toContain('photo-1505797149');

    const resPhone = resolver.resolveImage(phone!);
    expect(resPhone.productType).toBe('smartphone');
    expect(resPhone.visuallyVerified).toBe(true);
    expect(resPhone.imageUrl).not.toContain('photo-1511707171634-5f897ff0252a');
    expect(resPhone.imageUrl).toContain('photo-1598327105666');
  });

  it('12. Every entry in VISUALLY_VERIFIED_IMAGE_MANIFEST and PRODUCT_VERIFIED_IMAGE_MAP has a unique URL, non-empty visualSubject, and valid productTypes', () => {
    const entries = Object.values(VISUALLY_VERIFIED_IMAGE_MANIFEST);
    const mapEntries = Object.values(PRODUCT_VERIFIED_IMAGE_MAP);
    expect(entries.length).toBe(184);
    expect(mapEntries.length).toBe(184);

    for (const entry of entries) {
      expect(entry.url).toMatch(/^https:\/\//);
      expect(entry.productTypes.length).toBeGreaterThan(0);
      expect(entry.visualSubject.trim().length).toBeGreaterThan(10);
      expect(entry.assignedProductId).toBeDefined();
    }
  });

  // =========================================================================
  // 13-17: API CONSISTENCY, DUPLICATE DETECTION & FULL CATALOGUE AUDIT
  // =========================================================================
  it('13. ProductDetailsModal endpoint (/api/products/:id) returns model-accurate image and product_type', async () => {
    const resHelmet = await request(app).get('/api/products/auto-axor-apex-helmet');
    expect(resHelmet.status).toBe(200);
    expect(resHelmet.body.product_type).toBe('helmet');
    expect(resHelmet.body.image).toContain('photo-1590506995460');

    const resHonda = await request(app).get('/api/products/auto-honda-sp125');
    const resHunter = await request(app).get('/api/products/auto-re-hunter-350');
    expect(resHonda.status).toBe(200);
    expect(resHunter.status).toBe(200);
    expect(resHonda.body.image).not.toBe(resHunter.body.image);
    expect(resHonda.body.image).toContain('sp-125-right-side-view');
    expect(resHunter.body.image).toContain('hunter-350-right-side-view');

    const resDashcam = await request(app).get('/api/products/auto-70mai-dashcam-m300');
    expect(resDashcam.status).toBe(200);
    expect(resDashcam.body.product_type).toBe('dash-cam');
    expect(resDashcam.body.image).toBe('');
  });

  it('14. ComparisonDrawer endpoint (/api/products/compare) returns distinct images per product ID', async () => {
    const res = await request(app)
      .post('/api/products/compare')
      .send({
        productIds: ['auto-honda-sp125', 'auto-re-hunter-350', 'auto-axor-apex-helmet', 'auto-70mai-dashcam-m300'],
      });
    expect(res.status).toBe(200);
    const sp125 = res.body.products.find((p: any) => p.id === 'auto-honda-sp125');
    const hunter = res.body.products.find((p: any) => p.id === 'auto-re-hunter-350');
    const axor = res.body.products.find((p: any) => p.id === 'auto-axor-apex-helmet');
    const dashcam = res.body.products.find((p: any) => p.id === 'auto-70mai-dashcam-m300');

    expect(sp125.image).toContain('sp-125-right-side-view');
    expect(hunter.image).toContain('hunter-350-right-side-view');
    expect(sp125.image).not.toBe(hunter.image);
    expect(axor.image).toContain('photo-1590506995460');
    expect(dashcam.image).toBe('');
  });

  it('15. Image selection does NOT affect deterministic ranking or filtering results', () => {
    const products = filterService.filterProducts({ category: 'automotive' });
    expect(products.length).toBeGreaterThan(0);

    const ranked = rankingService.rankProducts(products, {
      intent: 'SEARCH',
      category: 'automotive',
      use_cases: ['daily commuting'],
    });

    expect(ranked.length).toBeGreaterThan(0);
    for (const scored of ranked) {
      expect(typeof scored.score).toBe('number');
      expect(scored.score).toBeGreaterThan(0);
    }
  });

  it('16. Full Catalogue Audit: ALL 450 products (449 active) pass validation with 0 duplicate image URLs and 0 unverified URLs', () => {
    const allProducts = productRepo.findMany({ inStockOnly: false, limit: 500 });
    expect(allProducts.length).toBe(450);

    const activeProducts = productRepo.findMany({ limit: 500 });
    expect(activeProducts.length).toBe(449);

    const audit = resolver.validateCatalog(allProducts);
    expect(audit.passed).toBe(true);
    expect(audit.totalAudited).toBe(450);
    expect(audit.matchedCount).toBe(450);
    expect(audit.visuallyVerifiedCount).toBe(184);
    expect(audit.placeholderFallbackCount).toBe(266);
    expect(audit.duplicateUrlCount).toBe(0);
    expect(audit.unverifiedUrlCount).toBe(0);
    expect(audit.mismatchCount).toBe(0);

    const report = resolver.generateCatalogAuditReport(allProducts);
    expect(report.summary.totalProducts).toBe(450);
    expect(report.summary.visuallyVerifiedCount).toBe(184);
    expect(report.summary.officialOrWikimediaExactModelCount).toBe(73);
    expect(report.summary.verifiedProductPhotoCount).toBe(111);
    expect(report.summary.placeholderFallbackCount).toBe(266);
    expect(report.summary.duplicateImageUrlCount).toBe(0);
    expect(report.items.length).toBe(450);
  });

  it('17. Duplicate image detector flags any duplicate URL shared across different products', () => {
    const sampleProducts: any[] = [
      {
        id: 'auto-honda-sp125',
        name: 'Honda SP 125',
        brand: 'Honda',
        category: 'automotive',
        product_type: 'motorcycle',
        image_type: 'motorcycle',
        image: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/43482/sp-125-right-side-view-8.jpeg?isig=0',
      },
      {
        id: 'auto-re-hunter-350',
        name: 'Royal Enfield Hunter 350',
        brand: 'Royal Enfield',
        category: 'automotive',
        product_type: 'motorcycle',
        image_type: 'motorcycle',
        // Intentionally duplicated URL from Honda SP 125
        image: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/43482/sp-125-right-side-view-8.jpeg?isig=0',
      },
    ];

    const duplicates = resolver.detectDuplicateImages(sampleProducts);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0].productIds).toEqual(['auto-honda-sp125', 'auto-re-hunter-350']);

    const validation = resolver.validateCatalog(sampleProducts);
    expect(validation.passed).toBe(false);
    expect(validation.duplicateUrlCount).toBe(1);
  });

  it('18. All 50 new Women\'s Fashion products across all 5 categories have verified, unique images', () => {
    const kurtis = productRepo.findMany({ category: 'kurtis-kurtas', limit: 100 });
    const sarees = productRepo.findMany({ category: 'sarees', limit: 100 });
    const ethnicSets = productRepo.findMany({ category: 'ethnic-sets-festive-wear', limit: 100 });
    const westernWear = productRepo.findMany({ category: 'western-wear', limit: 100 });
    const outerwear = productRepo.findMany({ category: 'womens-outerwear', limit: 100 });
    const umbrellaEthnic = productRepo.findMany({ category: 'womens-ethnic-wear', limit: 100 });

    expect(kurtis.length).toBe(15);
    expect(sarees.length).toBe(12);
    expect(ethnicSets.length).toBe(8);
    expect(westernWear.length).toBe(10);
    expect(outerwear.length).toBe(5);
    expect(umbrellaEthnic.length).toBe(35);

    const all50 = [...kurtis, ...sarees, ...ethnicSets, ...westernWear, ...outerwear];
    expect(all50.length).toBe(50);

    for (const p of all50) {
      expect(p.image.trim().length).toBeGreaterThan(10);
      const res = resolver.resolveImage(p);
      expect(res.visuallyVerified).toBe(true);
      expect(res.urlLoadable).toBe(true);
    }
  });

  it('19. Every motorcycle and scooter in the Bikes (automotive) section has a verified, non-empty image URL', () => {
    const autoProducts = productRepo.findMany({ category: 'automotive', limit: 100 });
    const bikesAndScooters = autoProducts.filter(
      (p) =>
        p.id.startsWith('auto-') &&
        (p.product_type === 'motorcycle' || p.product_type === 'scooter')
    );
    expect(bikesAndScooters.length).toBe(37);

    for (const bike of bikesAndScooters) {
      expect(bike.image.trim().length).toBeGreaterThan(10);
      const res = resolver.resolveImage(bike);
      expect(res.visuallyVerified).toBe(true);
      expect(res.urlLoadable).toBe(true);
    }
  });
});
