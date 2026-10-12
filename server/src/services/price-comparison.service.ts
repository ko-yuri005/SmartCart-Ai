import { env } from '../config/env.js';
import {
  IOfferRepository,
  RetailerOfferRecord,
} from '../db/repositories/offer.repository.js';
import { IProductRepository } from '../db/repositories/product.repository.js';
import {
  OfferAvailabilityStatus,
  OfferLinkType,
  OfferMatchType,
  OfferVerificationStatus,
  Product,
  ProductPriceComparisonResult,
  ProductPurchaseLinksSummary,
  RetailerOffer,
} from '../types/index.js';

export interface RetailerDefinition {
  id: string;
  name: string;
  allowedDomains: string[];
  buildSearchUrl: (encodedQuery: string) => string;
  categories: string[];
}

export const RETAILER_CATALOG: Record<string, RetailerDefinition> = {
  'amazon-in': {
    id: 'amazon-in',
    name: 'Amazon India',
    allowedDomains: ['amazon.in', 'www.amazon.in'],
    buildSearchUrl: (q) => `https://www.amazon.in/s?k=${q}`,
    categories: ['*'],
  },
  flipkart: {
    id: 'flipkart',
    name: 'Flipkart',
    allowedDomains: ['flipkart.com', 'www.flipkart.com'],
    buildSearchUrl: (q) => `https://www.flipkart.com/search?q=${q}`,
    categories: ['*'],
  },
  croma: {
    id: 'croma',
    name: 'Croma',
    allowedDomains: ['croma.com', 'www.croma.com'],
    buildSearchUrl: (q) => `https://www.croma.com/searchB?q=${q}%3Arelevance`,
    categories: [
      'headphones',
      'smartphones',
      'smartwatches',
      'laptops',
      'keyboards-mice',
      'power-accessories',
      'kitchen-appliances',
    ],
  },
  'reliance-digital': {
    id: 'reliance-digital',
    name: 'Reliance Digital',
    allowedDomains: ['reliancedigital.in', 'www.reliancedigital.in'],
    buildSearchUrl: (q) =>
      `https://www.reliancedigital.in/search?q=${q}:relevance`,
    categories: [
      'headphones',
      'smartphones',
      'smartwatches',
      'laptops',
      'keyboards-mice',
      'power-accessories',
      'kitchen-appliances',
    ],
  },
  'vijay-sales': {
    id: 'vijay-sales',
    name: 'Vijay Sales',
    allowedDomains: ['vijaysales.com', 'www.vijaysales.com'],
    buildSearchUrl: (q) => `https://www.vijaysales.com/search/${q}`,
    categories: [
      'headphones',
      'smartphones',
      'smartwatches',
      'laptops',
      'kitchen-appliances',
    ],
  },
  myntra: {
    id: 'myntra',
    name: 'Myntra',
    allowedDomains: ['myntra.com', 'www.myntra.com'],
    buildSearchUrl: (q) => `https://www.myntra.com/${q}`,
    categories: [
      'fashion',
      'footwear',
      'beauty-personal-care',
      'travel-luggage',
      'gifts',
      'smartwatches',
    ],
  },
  ajio: {
    id: 'ajio',
    name: 'Ajio',
    allowedDomains: ['ajio.com', 'www.ajio.com'],
    buildSearchUrl: (q) => `https://www.ajio.com/search/?text=${q}`,
    categories: ['fashion', 'footwear', 'travel-luggage', 'gifts'],
  },
  nykaa: {
    id: 'nykaa',
    name: 'Nykaa',
    allowedDomains: ['nykaa.com', 'www.nykaa.com'],
    buildSearchUrl: (q) => `https://www.nykaa.com/search/result/?q=${q}`,
    categories: ['beauty-personal-care', 'gifts'],
  },
  decathlon: {
    id: 'decathlon',
    name: 'Decathlon India',
    allowedDomains: ['decathlon.in', 'www.decathlon.in'],
    buildSearchUrl: (q) => `https://www.decathlon.in/search?query=${q}`,
    categories: ['sports-fitness', 'footwear', 'travel-luggage'],
  },
  pepperfry: {
    id: 'pepperfry',
    name: 'Pepperfry',
    allowedDomains: ['pepperfry.com', 'www.pepperfry.com'],
    buildSearchUrl: (q) =>
      `https://www.pepperfry.com/site_product/search?q=${q}`,
    categories: ['furniture', 'kitchen-appliances'],
  },
  'urban-ladder': {
    id: 'urban-ladder',
    name: 'Urban Ladder',
    allowedDomains: ['urbanladder.com', 'www.urbanladder.com'],
    buildSearchUrl: (q) =>
      `https://www.urbanladder.com/products/search?utf8=%E2%9C%93&keywords=${q}`,
    categories: ['furniture'],
  },
  bookswagon: {
    id: 'bookswagon',
    name: 'Bookswagon',
    allowedDomains: ['bookswagon.com', 'www.bookswagon.com'],
    buildSearchUrl: (q) => `https://www.bookswagon.com/search-books/${q}`,
    categories: ['books'],
  },
  bikewale: {
    id: 'bikewale',
    name: 'BikeWale',
    allowedDomains: ['bikewale.com', 'www.bikewale.com'],
    buildSearchUrl: (q) => `https://www.bikewale.com/m/search/?q=${q}`,
    categories: ['automotive'],
  },
  tatacliq: {
    id: 'tatacliq',
    name: 'Tata CLiQ',
    allowedDomains: ['tatacliq.com', 'www.tatacliq.com'],
    buildSearchUrl: (q) =>
      `https://www.tatacliq.com/search/?searchCategory=all&text=${q}`,
    categories: [
      'fashion',
      'footwear',
      'smartwatches',
      'travel-luggage',
      'gifts',
    ],
  },
};

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  retailerId?: string;
  retailerName?: string;
  detectedLinkType?: OfferLinkType;
  reason?: string;
}

export interface RawProviderOfferCandidate {
  retailerId?: string;
  retailerName: string;
  externalListingId?: string;
  listingTitle: string;
  listingUrl: string;
  price?: number | null;
  originalPrice?: number | null;
  currency?: string;
  shippingCost?: number | null;
  shippingKnown?: boolean;
  availability?: OfferAvailabilityStatus;
}

export interface IRetailerOfferProvider {
  readonly providerName: string;
  isConfigured(): boolean;
  fetchOffersForProduct(product: Product): Promise<RawProviderOfferCandidate[]>;
}

/**
 * Authorised SerpApi Google Shopping Provider Adapter (India region `gl=in`).
 * Only active when SERPAPI_API_KEY is configured in environment variables.
 */
export class SerpApiGoogleShoppingProvider implements IRetailerOfferProvider {
  public readonly providerName = 'serpapi_google_shopping';

  constructor(
    private apiKey = env.SERPAPI_API_KEY,
    private timeoutMs = env.OFFER_PROVIDER_TIMEOUT_MS,
    private maxRetries = env.OFFER_PROVIDER_MAX_RETRIES,
    private fetchFn: typeof fetch = globalThis.fetch
  ) {}

  public isConfigured(): boolean {
    return Boolean(
      this.apiKey &&
        this.apiKey.trim().length > 0 &&
        this.apiKey !== 'your_serpapi_api_key_here'
    );
  }

  public async fetchOffersForProduct(
    product: Product
  ): Promise<RawProviderOfferCandidate[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const query = `${product.brand} ${product.name}`.trim();
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google_shopping');
    url.searchParams.set('gl', 'in');
    url.searchParams.set('hl', 'en');
    url.searchParams.set('q', query);
    url.searchParams.set('api_key', this.apiKey);

    let lastError: any;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await this.fetchFn(url.toString(), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (res.status === 429) {
          const rateErr: any = new Error(
            'SerpApi rate limit exceeded (HTTP 429)'
          );
          rateErr.status = 429;
          throw rateErr;
        }

        if (!res.ok) {
          throw new Error(`SerpApi HTTP error ${res.status}`);
        }

        const data: any = await res.json();
        const shoppingResults: any[] = Array.isArray(data?.shopping_results)
          ? data.shopping_results
          : [];

        const candidates: RawProviderOfferCandidate[] = [];
        for (const item of shoppingResults) {
          const link = item.product_link || item.link;
          const title = item.title;
          const source = item.source || '';
          const extractedPrice =
            typeof item.extracted_price === 'number'
              ? item.extracted_price
              : null;
          const extractedOldPrice =
            typeof item.extracted_old_price === 'number'
              ? item.extracted_old_price
              : null;

          if (!link || !title) continue;

          let shippingCost: number | null = null;
          let shippingKnown = false;
          const deliveryStr = String(item.delivery || '').toLowerCase();
          if (deliveryStr.includes('free')) {
            shippingCost = 0;
            shippingKnown = true;
          } else {
            const shipMatch = deliveryStr.match(/(?:₹|rs\.?)\s*(\d+(?:\.\d+)?)/i);
            if (shipMatch) {
              shippingCost = parseFloat(shipMatch[1]);
              shippingKnown = true;
            }
          }

          candidates.push({
            retailerName: source,
            externalListingId: item.product_id ? String(item.product_id) : undefined,
            listingTitle: String(title),
            listingUrl: String(link),
            price: extractedPrice,
            originalPrice: extractedOldPrice,
            currency: 'INR',
            shippingCost,
            shippingKnown,
            availability: 'in_stock',
          });
        }
        return candidates;
      } catch (err: any) {
        lastError = err;
        if (err?.status === 429 || String(err?.message).includes('429')) {
          throw err;
        }
        if (attempt >= this.maxRetries) {
          throw lastError;
        }
      }
    }

    return [];
  }
}

/**
 * Authorised RapidAPI Real-Time Product Search Provider Adapter.
 * Only active when RAPIDAPI_PRODUCT_SEARCH_KEY is configured in environment variables.
 */
export class RapidApiProductSearchProvider implements IRetailerOfferProvider {
  public readonly providerName = 'rapidapi_product_search';

  constructor(
    private apiKey = env.RAPIDAPI_PRODUCT_SEARCH_KEY,
    private apiHost = env.RAPIDAPI_PRODUCT_SEARCH_HOST,
    private timeoutMs = env.OFFER_PROVIDER_TIMEOUT_MS,
    private maxRetries = env.OFFER_PROVIDER_MAX_RETRIES,
    private fetchFn: typeof fetch = globalThis.fetch
  ) {}

  public isConfigured(): boolean {
    return Boolean(
      this.apiKey &&
        this.apiKey.trim().length > 0 &&
        this.apiKey !== 'your_rapidapi_product_search_key_here'
    );
  }

  public async fetchOffersForProduct(
    product: Product
  ): Promise<RawProviderOfferCandidate[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const query = `${product.brand} ${product.name}`.trim();
    const url = new URL(`https://${this.apiHost}/search-v2`);
    url.searchParams.set('q', query);
    url.searchParams.set('country', 'in');
    url.searchParams.set('language', 'en');

    let lastError: any;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await this.fetchFn(url.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'x-rapidapi-key': this.apiKey,
            'x-rapidapi-host': this.apiHost,
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (res.status === 429) {
          const rateErr: any = new Error(
            'RapidAPI Product Search rate limit exceeded (HTTP 429)'
          );
          rateErr.status = 429;
          throw rateErr;
        }

        if (!res.ok) {
          throw new Error(`RapidAPI HTTP error ${res.status}`);
        }

        const body: any = await res.json();
        const products: any[] = Array.isArray(body?.data?.products)
          ? body.data.products
          : [];

        const candidates: RawProviderOfferCandidate[] = [];
        for (const p of products) {
          const pTitle = p.product_title || '';
          const offers: any[] = Array.isArray(p.offers)
            ? p.offers
            : p.offer
              ? [p.offer]
              : [];

          for (const off of offers) {
            const link = off.offer_page_url || p.product_page_url;
            const storeName = off.store_name || '';
            if (!link || !pTitle) continue;

            const rawPriceStr = String(off.price || '').replace(/[^0-9.]/g, '');
            const price = rawPriceStr ? parseFloat(rawPriceStr) : null;

            const rawOrigStr = String(off.original_price || '').replace(
              /[^0-9.]/g,
              ''
            );
            const originalPrice = rawOrigStr ? parseFloat(rawOrigStr) : null;

            let shippingCost: number | null = null;
            let shippingKnown = false;
            const shipText = String(off.shipping || '').toLowerCase();
            if (shipText.includes('free')) {
              shippingCost = 0;
              shippingKnown = true;
            } else {
              const shipMatch = shipText.match(/(?:₹|rs\.?)\s*(\d+(?:\.\d+)?)/i);
              if (shipMatch) {
                shippingCost = parseFloat(shipMatch[1]);
                shippingKnown = true;
              }
            }

            candidates.push({
              retailerName: storeName,
              externalListingId: off.offer_id || p.product_id,
              listingTitle: String(pTitle),
              listingUrl: String(link),
              price: Number.isFinite(price) ? price : null,
              originalPrice: Number.isFinite(originalPrice)
                ? originalPrice
                : null,
              currency: 'INR',
              shippingCost,
              shippingKnown,
              availability:
                off.on_sale !== undefined || price ? 'in_stock' : 'unknown',
            });
          }
        }
        return candidates;
      } catch (err: any) {
        lastError = err;
        if (err?.status === 429 || String(err?.message).includes('429')) {
          throw err;
        }
        if (attempt >= this.maxRetries) {
          throw lastError;
        }
      }
    }

    return [];
  }
}

export interface PriceComparisonConfig {
  cacheTtlMs?: number;
  refreshCooldownMs?: number;
  affiliateDisclosure?: string;
}

export class PriceComparisonService {
  private cacheTtlMs: number;
  private refreshCooldownMs: number;
  private affiliateDisclosure: string;
  private providers: IRetailerOfferProvider[];
  private lastRefreshByProductId = new Map<string, number>();

  constructor(
    private productRepo: IProductRepository,
    private offerRepo: IOfferRepository,
    providers?: IRetailerOfferProvider[],
    config: PriceComparisonConfig = {}
  ) {
    this.cacheTtlMs = Math.max(0, config.cacheTtlMs ?? env.OFFER_CACHE_TTL_MS);
    this.refreshCooldownMs = Math.max(
      0,
      config.refreshCooldownMs ?? env.OFFER_REFRESH_COOLDOWN_MS
    );
    this.affiliateDisclosure =
      config.affiliateDisclosure ?? env.AFFILIATE_DISCLOSURE_TEXT;
    this.providers = providers ?? [
      new SerpApiGoogleShoppingProvider(),
      new RapidApiProductSearchProvider(),
    ];
  }

  public getConfiguredProviders(): IRetailerOfferProvider[] {
    return this.providers.filter((p) => p.isConfigured());
  }

  /**
   * Validates an external retailer URL against SSRF, dangerous protocols,
   * and the allowed retailer domain registry. Also detects whether a URL
   * is a search query link versus a direct product listing link.
   */
  public validateRetailerUrl(
    rawUrl: string | null | undefined,
    expectedRetailerId?: string
  ): UrlValidationResult {
    if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
      return { valid: false, reason: 'URL is empty or missing' };
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      return { valid: false, reason: 'Malformed URL syntax' };
    }

    if (parsed.protocol !== 'https:') {
      return {
        valid: false,
        reason: `Disallowed URL protocol '${parsed.protocol}'. Only 'https:' is permitted.`,
      };
    }

    if (parsed.username || parsed.password) {
      return {
        valid: false,
        reason: 'Credentials in URL are not permitted (SSRF protection)',
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // SSRF & private network checks
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
      hostname.includes(':')
    ) {
      return {
        valid: false,
        reason: `Blocked private, loopback, or IP-literal host '${hostname}' (SSRF protection)`,
      };
    }

    // Match against allowed retailer domain registry
    let matchedRetailer: RetailerDefinition | undefined;
    for (const def of Object.values(RETAILER_CATALOG)) {
      if (def.allowedDomains.includes(hostname)) {
        matchedRetailer = def;
        break;
      }
    }

    if (!matchedRetailer) {
      return {
        valid: false,
        reason: `Domain '${hostname}' is not in the allowed retailer registry`,
      };
    }

    if (
      expectedRetailerId &&
      matchedRetailer.id !== expectedRetailerId &&
      RETAILER_CATALOG[expectedRetailerId]
    ) {
      return {
        valid: false,
        reason: `URL domain '${hostname}' (${matchedRetailer.id}) does not match expected retailer '${expectedRetailerId}'`,
      };
    }

    const isSearchLink = this.isSearchUrlPattern(parsed);
    return {
      valid: true,
      normalizedUrl: parsed.toString(),
      retailerId: matchedRetailer.id,
      retailerName: matchedRetailer.name,
      detectedLinkType: isSearchLink ? 'search_link' : 'direct_listing',
    };
  }

  /**
   * Detects if a URL points to a retailer's search results page rather than a direct product page.
   */
  public isSearchUrlPattern(parsed: URL): boolean {
    const pathLower = parsed.pathname.toLowerCase();
    const searchParams = parsed.searchParams;

    if (
      pathLower === '/s' ||
      pathLower.startsWith('/s/') ||
      pathLower.startsWith('/search') ||
      pathLower.includes('/searchb') ||
      pathLower.includes('/site_product/search') ||
      pathLower.includes('/products/search') ||
      pathLower.includes('/search-books/') ||
      pathLower.includes('/m/search')
    ) {
      return true;
    }

    if (
      searchParams.has('k') ||
      searchParams.has('q') ||
      searchParams.has('query') ||
      searchParams.has('keywords') ||
      searchParams.has('searchCategory')
    ) {
      return true;
    }

    // Myntra search URL pattern: https://www.myntra.com/<search-slug> without numeric product ID at end
    if (
      parsed.hostname.endsWith('myntra.com') &&
      !/\/\d+\/buy\/?$/i.test(pathLower) &&
      !/\/p\/[a-z0-9-]+/i.test(pathLower)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Selects relevant online retailers for a product based on its category and product_type.
   */
  public getRetailersForProduct(product: Product): RetailerDefinition[] {
    const category = (product.category || '').toLowerCase().trim();
    const productType = (product.product_type || '').toLowerCase().trim();

    if (
      category === 'automotive' &&
      (productType === 'motorcycle' || productType === 'scooter')
    ) {
      return [
        RETAILER_CATALOG['bikewale'],
        RETAILER_CATALOG['amazon-in'],
        RETAILER_CATALOG['flipkart'],
      ];
    }

    if (category === 'automotive') {
      return [
        RETAILER_CATALOG['amazon-in'],
        RETAILER_CATALOG['flipkart'],
        RETAILER_CATALOG['croma'],
      ];
    }

    if (category === 'fashion') {
      return [
        RETAILER_CATALOG['myntra'],
        RETAILER_CATALOG['ajio'],
        RETAILER_CATALOG['amazon-in'],
        RETAILER_CATALOG['flipkart'],
      ];
    }

    if (category === 'footwear') {
      const list = [
        RETAILER_CATALOG['myntra'],
        RETAILER_CATALOG['ajio'],
        RETAILER_CATALOG['amazon-in'],
        RETAILER_CATALOG['flipkart'],
      ];
      if (productType === 'running-shoes') {
        list.splice(2, 0, RETAILER_CATALOG['decathlon']);
      }
      return list;
    }

    if (category === 'beauty-personal-care') {
      return [
        RETAILER_CATALOG['nykaa'],
        RETAILER_CATALOG['amazon-in'],
        RETAILER_CATALOG['flipkart'],
        RETAILER_CATALOG['myntra'],
      ];
    }

    if (category === 'furniture') {
      return [
        RETAILER_CATALOG['pepperfry'],
        RETAILER_CATALOG['urban-ladder'],
        RETAILER_CATALOG['amazon-in'],
        RETAILER_CATALOG['flipkart'],
      ];
    }

    if (category === 'books') {
      return [
        RETAILER_CATALOG['amazon-in'],
        RETAILER_CATALOG['flipkart'],
        RETAILER_CATALOG['bookswagon'],
      ];
    }

    if (category === 'sports-fitness') {
      return [
        RETAILER_CATALOG['decathlon'],
        RETAILER_CATALOG['amazon-in'],
        RETAILER_CATALOG['flipkart'],
      ];
    }

    if (category === 'travel-luggage') {
      return [
        RETAILER_CATALOG['amazon-in'],
        RETAILER_CATALOG['flipkart'],
        RETAILER_CATALOG['myntra'],
        RETAILER_CATALOG['tatacliq'],
      ];
    }

    if (category === 'gifts') {
      return [
        RETAILER_CATALOG['amazon-in'],
        RETAILER_CATALOG['flipkart'],
        RETAILER_CATALOG['myntra'],
        RETAILER_CATALOG['nykaa'],
      ];
    }

    // Electronics & Kitchen Appliances default
    return [
      RETAILER_CATALOG['amazon-in'],
      RETAILER_CATALOG['flipkart'],
      RETAILER_CATALOG['croma'],
      RETAILER_CATALOG['reliance-digital'],
    ];
  }

  /**
   * Builds a clean, safely encoded search query from the product's brand, model, and key specs.
   */
  public buildSafeSearchQuery(product: Product): string {
    const brand = (product.brand || '').trim();
    const name = (product.name || '').trim();

    const baseQuery = name.toLowerCase().startsWith(brand.toLowerCase())
      ? name
      : `${brand} ${name}`.trim();

    return encodeURIComponent(baseQuery.replace(/\s+/g, ' ').trim());
  }

  /**
   * Generates clearly labelled retailer search links for a product.
   */
  public generateRetailerSearchLinks(
    product: Product
  ): ProductPurchaseLinksSummary['retailerSearchLinks'] {
    const encodedQuery = this.buildSafeSearchQuery(product);
    const retailers = this.getRetailersForProduct(product);

    return retailers.map((ret) => ({
      retailerId: ret.id,
      retailerName: ret.name,
      searchUrl: ret.buildSearchUrl(encodedQuery),
      categoryFit: product.category,
    }));
  }

  /**
   * Generates clearly labelled external retailer search links for a free-text query or uncatalogued accessory.
   * Never claims external results or prices exist unless returned by a configured provider.
   */
  public generateQuerySearchLinks(
    rawQuery: string,
    categoryHint = 'electronics'
  ): ProductPurchaseLinksSummary['retailerSearchLinks'] {
    const cleanQuery = (rawQuery || '')
      .replace(
        /^(?:please\s+|can\s+you\s+|could\s+you\s+)?(?:suggest|recommend|find|show|search\s+for|looking\s+for|i\s+need|i\s+want|buy|get)\s+(?:me\s+)?(?:a\s+|an\s+|some\s+|good\s+|best\s+)?/i,
        ''
      )
      .replace(/\s+/g, ' ')
      .trim();

    const finalQuery = cleanQuery || rawQuery.trim() || 'shopping';
    const encodedQuery = encodeURIComponent(finalQuery);
    const dummyProduct: Product = {
      id: 'query-search',
      name: finalQuery,
      brand: '',
      category: categoryHint,
      price: 0,
      currency: 'INR',
      rating: 0,
      review_count: 0,
      description: '',
      features: [],
      specifications: {},
      use_cases: [],
      image: '',
      availability: true,
    };

    const retailers = this.getRetailersForProduct(dummyProduct);
    return retailers.map((ret) => ({
      retailerId: ret.id,
      retailerName: ret.name,
      searchUrl: ret.buildSearchUrl(encodedQuery),
      categoryFit: categoryHint,
    }));
  }

  /**
   * Extracts structured variant tokens (RAM, storage, volume/capacity, engine cc, wattage,
   * screen size, model tier/generation, apparel/shoe size) so different variants are never
   * compared as identical products.
   */
  public extractVariantSignature(
    title: string,
    specs: Record<string, string | number> = {}
  ): {
    storageAndRam: string[];
    capacities: string[];
    generationsAndTiers: string[];
    sizes: string[];
  } {
    const combinedText = `${title} ${Object.entries(specs)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ')}`.toLowerCase();

    // 1. Storage & RAM tokens (e.g. 8gb, 16gb, 128gb, 256gb, 512gb, 1tb)
    const storageMatches =
      combinedText.match(/\b(\d+)\s*(gb|tb)\b/g)?.map((m) => m.replace(/\s+/g, '')) ||
      [];
    const storageAndRam = Array.from(new Set(storageMatches)).sort();

    // 2. Volume / Capacity / Displacement / Wattage / Battery tokens (e.g. 3.5l, 5l, 149cc, 65w, 20000mah)
    const rawCapMatches =
      combinedText.match(
        /\b(\d+(?:\.\d+)?)\s*(litres?|liters?|ltrs?|l\b|ml\b|cc\b|mah\b|watts?|w\b|inch(?:es)?|kg\b)/g
      ) || [];
    const capacities = Array.from(
      new Set(
        rawCapMatches.map((m) =>
          m
            .replace(/\s+/g, '')
            .replace(/litres?|liters?|ltrs?/g, 'l')
            .replace(/watts?/g, 'w')
            .replace(/inches/g, 'inch')
        )
      )
    ).sort();

    // 3. Model tier & generation markers (pro, max, ultra, plus, lite, fe, v2, v3, v4, gen2, gen3, xm4, xm5, m1, m2, m3, 5g, 4g)
    const tierMatches =
      combinedText.match(
        /(?:\b|\d)(pro|max|ultra|plus|lite|fe|xm3|xm4|xm5|v2|v3|v4|gen\s*2|gen\s*3|gen\s*4|m1|m2|m3|5g|4g)\b/g
      ) || [];
    const generationsAndTiers = Array.from(
      new Set(
        tierMatches.map((m) =>
          m.replace(/^\d+(?=[a-z])/, '').replace(/\s+/g, '')
        )
      )
    ).sort();

    // 4. Apparel / Footwear sizes (e.g. size s, size m, size l, size xl, uk 8, uk 9)
    const sizeMatches =
      combinedText.match(/\b(size\s*[smlx]{1,3}|uk\s*\d+|us\s*\d+)\b/g) || [];
    const sizes = Array.from(
      new Set(sizeMatches.map((m) => m.replace(/\s+/g, '')))
    ).sort();

    return {
      storageAndRam,
      capacities,
      generationsAndTiers,
      sizes,
    };
  }

  /**
   * Deterministically evaluates whether a candidate external listing is:
   * - 'exact': Same brand, same core model, and no conflicting variant/capacity/tier tokens.
   * - 'variant_mismatch': Same brand and core model family, but different storage/RAM, capacity, size, or generation/tier.
   * - 'similar_alternative': Same brand or category with overlapping tokens, but a different product model.
   * - 'unrelated': Insufficient overlap or wrong brand/category.
   */
  public evaluateListingMatch(
    product: Product,
    candidateTitle: string,
    candidateSpecs: Record<string, string | number> = {}
  ): {
    matchType: OfferMatchType | 'unrelated';
    confidence: number;
    matchedVariantSummary?: string;
  } {
    const normCandidate = (candidateTitle || '').toLowerCase().trim();
    if (!normCandidate) {
      return { matchType: 'unrelated', confidence: 0 };
    }

    const brandLower = (product.brand || '').toLowerCase().trim();
    const brandTokens = brandLower.split(/\s+/).filter((t) => t.length >= 2);
    const hasBrand =
      brandTokens.length === 0 ||
      brandTokens.every((bt) => normCandidate.includes(bt));

    // Extract core model words from product.name (excluding generic stop words & brand)
    const stopWords = new Set([
      'with',
      'for',
      'and',
      'the',
      'pack',
      'of',
      'in',
      'on',
      'by',
      'set',
      'edition',
      'series',
      'certified',
      'dual',
      'full',
      'face',
      'men',
      'women',
      'unisex',
      'black',
      'white',
      'blue',
      'grey',
      'gray',
      'silver',
      ...brandTokens,
    ]);

    const nameWords = product.name
      .toLowerCase()
      .replace(/[()[\],/-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !stopWords.has(w));

    // Take the first 3 distinctive tokens after brand as primary model identifiers
    const primaryModelTokens = nameWords.slice(0, 3);
    const matchedPrimaryCount = primaryModelTokens.filter((t) =>
      normCandidate.includes(t)
    ).length;
    const matchedTotalCount = nameWords.filter((t) =>
      normCandidate.includes(t)
    ).length;
    const overlapRatio =
      nameWords.length > 0 ? matchedTotalCount / nameWords.length : 0;

    if (!hasBrand && overlapRatio < 0.5) {
      return { matchType: 'unrelated', confidence: 0.1 };
    }

    if (hasBrand && matchedPrimaryCount === 0 && overlapRatio < 0.35) {
      return {
        matchType: 'similar_alternative',
        confidence: 0.45,
        matchedVariantSummary: `Similar ${product.brand} alternative`,
      };
    }

    // Compare variant signatures
    const prodSig = this.extractVariantSignature(product.name, {});
    const candSig = this.extractVariantSignature(candidateTitle, candidateSpecs);

    const conflicts: string[] = [];

    // Check storage/RAM conflict if candidate specifies storage/RAM that differs from product
    if (prodSig.storageAndRam.length > 0 && candSig.storageAndRam.length > 0) {
      const missingInCand = prodSig.storageAndRam.filter(
        (tok) => !candSig.storageAndRam.includes(tok)
      );
      const extraInCand = candSig.storageAndRam.filter(
        (tok) => !prodSig.storageAndRam.includes(tok)
      );
      if (missingInCand.length > 0 || extraInCand.length > 0) {
        conflicts.push(
          `Memory/Storage differs (${candSig.storageAndRam.join('/')} vs ${prodSig.storageAndRam.join('/')})`
        );
      }
    }

    // Check capacity/volume/displacement/wattage conflict
    if (prodSig.capacities.length > 0 && candSig.capacities.length > 0) {
      const prodPrimaryCap = prodSig.capacities[0];
      if (!candSig.capacities.includes(prodPrimaryCap)) {
        conflicts.push(
          `Capacity/Spec differs (${candSig.capacities.join(', ')} vs ${prodSig.capacities.join(', ')})`
        );
      }
    }

    // Check tier/generation conflict (e.g. Pro vs non-Pro, XM4 vs XM5, V3 vs V4)
    if (
      prodSig.generationsAndTiers.length > 0 ||
      candSig.generationsAndTiers.length > 0
    ) {
      const pTiers = prodSig.generationsAndTiers.join(',');
      const cTiers = candSig.generationsAndTiers.join(',');
      if (pTiers !== cTiers) {
        // Specifically check mutually exclusive model tiers
        const exclusiveTiers = [
          'pro',
          'max',
          'ultra',
          'plus',
          'lite',
          'fe',
          'xm3',
          'xm4',
          'xm5',
          'v2',
          'v3',
          'v4',
          'm1',
          'm2',
          'm3',
        ];
        const pEx = prodSig.generationsAndTiers.filter((t) =>
          exclusiveTiers.includes(t)
        );
        const cEx = candSig.generationsAndTiers.filter((t) =>
          exclusiveTiers.includes(t)
        );
        if (pEx.join(',') !== cEx.join(',')) {
          conflicts.push(
            `Model tier/generation differs (${cEx.join(' ') || 'standard'} vs ${pEx.join(' ') || 'standard'})`
          );
        }
      }
    }

    // Check apparel/shoe size conflict
    if (prodSig.sizes.length > 0 && candSig.sizes.length > 0) {
      if (prodSig.sizes.join(',') !== candSig.sizes.join(',')) {
        conflicts.push(
          `Size differs (${candSig.sizes.join(', ')} vs ${prodSig.sizes.join(', ')})`
        );
      }
    }

    if (conflicts.length > 0) {
      return {
        matchType: 'variant_mismatch',
        confidence: 0.65,
        matchedVariantSummary: conflicts.join('; '),
      };
    }

    // Check if primary model tokens match strongly
    if (
      hasBrand &&
      (matchedPrimaryCount >= Math.min(2, primaryModelTokens.length) ||
        overlapRatio >= 0.6)
    ) {
      const variantDetails = [
        ...prodSig.storageAndRam,
        ...prodSig.capacities,
        ...prodSig.generationsAndTiers,
      ]
        .map((s) => s.toUpperCase())
        .join(' • ');
      return {
        matchType: 'exact',
        confidence: Math.min(1, Number((0.75 + overlapRatio * 0.25).toFixed(2))),
        matchedVariantSummary: variantDetails || 'Exact model match',
      };
    }

    return {
      matchType: 'similar_alternative',
      confidence: Number((0.45 + overlapRatio * 0.3).toFixed(2)),
      matchedVariantSummary: 'Similar product listing',
    };
  }

  /**
   * Normalizes a database or provider offer record, enforces freshness/staleness rules,
   * validates URLs, and computes total price (item price + known shipping) without ever
   * assuming free shipping when shipping is unknown.
   */
  public normalizeOfferRecord(
    product: Product,
    record: RetailerOfferRecord,
    nowMs = Date.now()
  ): RetailerOffer | null {
    // 1. Validate searchUrl (fallback to safe generated search URL if invalid)
    const defaultRetailer =
      RETAILER_CATALOG[record.retailerId] || RETAILER_CATALOG['amazon-in'];
    const safeQuery = this.buildSafeSearchQuery(product);
    let validSearchUrl = defaultRetailer.buildSearchUrl(safeQuery);
    const searchCheck = this.validateRetailerUrl(
      record.searchUrl,
      record.retailerId
    );
    if (searchCheck.valid && searchCheck.normalizedUrl) {
      validSearchUrl = searchCheck.normalizedUrl;
    }

    // 2. Validate direct listingUrl if present
    let validListingUrl: string | null = null;
    let effectiveLinkType: OfferLinkType = record.linkType;

    if (record.listingUrl) {
      const urlCheck = this.validateRetailerUrl(
        record.listingUrl,
        record.retailerId
      );
      if (!urlCheck.valid || !urlCheck.normalizedUrl) {
        // Reject invalid/unsafe URLs completely
        return null;
      }
      // Never allow a search URL to pretend to be a direct listing
      if (urlCheck.detectedLinkType === 'search_link') {
        effectiveLinkType = 'search_link';
        validListingUrl = null;
        validSearchUrl = urlCheck.normalizedUrl;
      } else {
        validListingUrl = urlCheck.normalizedUrl;
      }
    } else {
      effectiveLinkType = 'search_link';
    }

    // 3. Determine verificationStatus & staleness
    let verificationStatus: OfferVerificationStatus = record.verificationStatus;
    let statusMessage: string | undefined;

    if (
      effectiveLinkType === 'search_link' ||
      verificationStatus === 'unverified_search'
    ) {
      verificationStatus = 'unverified_search';
      statusMessage =
        "Live price unavailable — check the retailer's listing.";
    } else if (
      verificationStatus === 'live_verified' ||
      verificationStatus === 'cached_verified'
    ) {
      const expiresMs = record.expiresAt ? Date.parse(record.expiresAt) : NaN;
      const checkedMs = record.lastCheckedAt
        ? Date.parse(record.lastCheckedAt)
        : NaN;

      const isExpiredByTimestamp =
        !Number.isNaN(expiresMs) && expiresMs < nowMs;
      const isExpiredByTtl =
        Number.isNaN(expiresMs) &&
        !Number.isNaN(checkedMs) &&
        nowMs - checkedMs > this.cacheTtlMs;

      if (isExpiredByTimestamp || isExpiredByTtl || Number.isNaN(checkedMs)) {
        verificationStatus = 'stale_cached';
        statusMessage =
          'Cached price has expired — verify current price on the retailer listing.';
      }
    }

    // 4. Price & shipping calculations (never invent prices for search links)
    const hasValidPrice =
      effectiveLinkType === 'direct_listing' &&
      verificationStatus !== 'unverified_search' &&
      verificationStatus !== 'unavailable' &&
      typeof record.price === 'number' &&
      Number.isFinite(record.price) &&
      record.price > 0;

    const price = hasValidPrice ? Math.round(record.price! * 100) / 100 : null;

    let originalPrice: number | null = null;
    let discountPercent: number | null = null;
    if (
      price !== null &&
      typeof record.originalPrice === 'number' &&
      Number.isFinite(record.originalPrice) &&
      record.originalPrice > price
    ) {
      originalPrice = Math.round(record.originalPrice * 100) / 100;
      discountPercent = Math.round(
        ((originalPrice - price) / originalPrice) * 100
      );
    }

    const shippingKnown = Boolean(
      price !== null &&
        record.shippingKnown &&
        typeof record.shippingCost === 'number' &&
        Number.isFinite(record.shippingCost) &&
        record.shippingCost >= 0
    );

    const shippingCost = shippingKnown
      ? Math.round(record.shippingCost! * 100) / 100
      : null;

    // Total price is ONLY computed when both item price and shipping charges are known
    const totalPrice =
      price !== null && shippingKnown && shippingCost !== null
        ? Math.round((price + shippingCost) * 100) / 100
        : null;

    const totalIsIncomplete = Boolean(price !== null && !shippingKnown);
    if (totalIsIncomplete && !statusMessage) {
      statusMessage =
        'Shipping charges unknown — total price is incomplete (item price only).';
    }

    return {
      id: record.id,
      productId: product.id,
      retailerId: record.retailerId,
      retailerName: record.retailerName,
      externalListingId: record.externalListingId ?? null,
      listingTitle: record.listingTitle || product.name,
      listingUrl: validListingUrl,
      searchUrl: validSearchUrl,
      linkType: effectiveLinkType,
      matchType: record.matchType,
      matchConfidence: record.matchConfidence,
      matchedVariantSummary: record.matchedVariantSummary,
      price,
      originalPrice,
      discountPercent,
      currency: record.currency || 'INR',
      shippingCost,
      shippingKnown,
      totalPrice,
      totalIsIncomplete,
      availability:
        effectiveLinkType === 'search_link' ? 'unknown' : record.availability,
      verificationStatus,
      sourceProvider: record.sourceProvider,
      lastCheckedAt: record.lastCheckedAt,
      expiresAt: record.expiresAt ?? null,
      statusMessage,
      affiliateDisclosure: this.affiliateDisclosure,
    };
  }

  /**
   * Deterministic offer sorting:
   * 1. Fresh verified exact offers in stock with known total price (sorted by totalPrice asc)
   * 2. Fresh verified exact offers in stock with unknown shipping (sorted by item price asc)
   * 3. Stale cached exact offers (sorted by totalPrice ?? price asc)
   * 4. Out-of-stock verified offers
   * 5. Unverified search links
   */
  public sortOffersDeterministically(offers: RetailerOffer[]): RetailerOffer[] {
    const getTier = (o: RetailerOffer): number => {
      const isFreshVerified =
        o.verificationStatus === 'live_verified' ||
        o.verificationStatus === 'cached_verified';
      const isInStock =
        o.availability === 'in_stock' || o.availability === 'limited';

      if (
        o.linkType === 'direct_listing' &&
        isFreshVerified &&
        isInStock &&
        o.totalPrice !== null
      ) {
        return 1;
      }
      if (
        o.linkType === 'direct_listing' &&
        isFreshVerified &&
        isInStock &&
        o.price !== null
      ) {
        return 2;
      }
      if (
        o.linkType === 'direct_listing' &&
        o.verificationStatus === 'stale_cached' &&
        o.price !== null
      ) {
        return 3;
      }
      if (o.linkType === 'direct_listing' && o.price !== null) {
        return 4;
      }
      return 5;
    };

    return [...offers].sort((a, b) => {
      const tierA = getTier(a);
      const tierB = getTier(b);
      if (tierA !== tierB) return tierA - tierB;

      const priceA = a.totalPrice ?? a.price ?? Number.POSITIVE_INFINITY;
      const priceB = b.totalPrice ?? b.price ?? Number.POSITIVE_INFINITY;
      if (priceA !== priceB) return priceA - priceB;

      return a.retailerName.localeCompare(b.retailerName);
    });
  }

  /**
   * Computes the lowest verified total price offer among comparable exact offers.
   * Requires:
   * - matchType === 'exact'
   * - linkType === 'direct_listing'
   * - verificationStatus in ('live_verified', 'cached_verified') (never stale or search links)
   * - availability in ('in_stock', 'limited')
   * - shippingKnown === true and totalPrice !== null
   */
  public findLowestVerifiedOffer(offers: RetailerOffer[]): {
    lowestVerifiedOffer: RetailerOffer | null;
    comparableOffersCount: number;
  } {
    const comparable = offers.filter(
      (o) =>
        o.matchType === 'exact' &&
        o.linkType === 'direct_listing' &&
        (o.verificationStatus === 'live_verified' ||
          o.verificationStatus === 'cached_verified') &&
        (o.availability === 'in_stock' || o.availability === 'limited') &&
        o.shippingKnown &&
        o.totalPrice !== null &&
        o.totalPrice > 0
    );

    if (comparable.length === 0) {
      return { lowestVerifiedOffer: null, comparableOffersCount: 0 };
    }

    const sorted = [...comparable].sort(
      (a, b) => a.totalPrice! - b.totalPrice!
    );
    return {
      lowestVerifiedOffer: sorted[0],
      comparableOffersCount: comparable.length,
    };
  }

  /**
   * Builds the ProductPurchaseLinksSummary for a product, using the best verified direct listing
   * when available, or falling back honestly to a clearly labelled "Search this product" link.
   */
  public getPurchaseLinksForProduct(
    product: Product,
    precomputedOffers?: RetailerOffer[],
    lowestVerified?: RetailerOffer | null
  ): ProductPurchaseLinksSummary {
    const searchLinks = this.generateRetailerSearchLinks(product);

    let exactOffers = precomputedOffers;
    if (!exactOffers) {
      const dbRecords = this.offerRepo.findByProductId(product.id);
      const normalized = dbRecords
        .map((r) => this.normalizeOfferRecord(product, r))
        .filter((o): o is RetailerOffer => o !== null && o.matchType === 'exact');
      exactOffers = this.sortOffersDeterministically(normalized);
    }

    const bestVerified =
      lowestVerified !== undefined
        ? lowestVerified
        : this.findLowestVerifiedOffer(exactOffers).lowestVerifiedOffer;

    // Find any direct_listing exact offer (even if shipping is unknown or stale) for "View product"
    const firstDirectOffer =
      bestVerified ||
      exactOffers.find(
        (o) =>
          o.matchType === 'exact' &&
          o.linkType === 'direct_listing' &&
          Boolean(o.listingUrl)
      );

    if (firstDirectOffer && firstDirectOffer.listingUrl) {
      const isFreshInStock =
        (firstDirectOffer.verificationStatus === 'live_verified' ||
          firstDirectOffer.verificationStatus === 'cached_verified') &&
        (firstDirectOffer.availability === 'in_stock' ||
          firstDirectOffer.availability === 'limited');

      return {
        productId: product.id,
        primaryLink: {
          retailerId: firstDirectOffer.retailerId,
          retailerName: firstDirectOffer.retailerName,
          title: firstDirectOffer.listingTitle,
          url: firstDirectOffer.listingUrl,
          linkType: 'direct_listing',
          actionLabel: isFreshInStock ? 'Buy now' : 'View product',
          verificationStatus: firstDirectOffer.verificationStatus,
          price: firstDirectOffer.price,
          shippingCost: firstDirectOffer.shippingCost,
          shippingKnown: firstDirectOffer.shippingKnown,
          totalPrice: firstDirectOffer.totalPrice,
          totalIsIncomplete: firstDirectOffer.totalIsIncomplete,
        },
        hasVerifiedDirectListing: true,
        lowestVerifiedOffer: bestVerified,
        retailerSearchLinks: searchLinks,
      };
    }

    const primaryRetailerSearch = searchLinks[0] || {
      retailerId: 'amazon-in',
      retailerName: 'Amazon India',
      searchUrl: RETAILER_CATALOG['amazon-in'].buildSearchUrl(
        this.buildSafeSearchQuery(product)
      ),
      categoryFit: product.category,
    };

    return {
      productId: product.id,
      primaryLink: {
        retailerId: primaryRetailerSearch.retailerId,
        retailerName: primaryRetailerSearch.retailerName,
        title: `Search "${product.name}" on ${primaryRetailerSearch.retailerName}`,
        url: primaryRetailerSearch.searchUrl,
        linkType: 'search_link',
        actionLabel: 'Search this product',
        verificationStatus: 'unverified_search',
        price: null,
        shippingCost: null,
        shippingKnown: false,
        totalPrice: null,
        totalIsIncomplete: false,
      },
      hasVerifiedDirectListing: false,
      lowestVerifiedOffer: null,
      retailerSearchLinks: searchLinks,
    };
  }

  /**
   * Attaches purchaseLinks summary to a Product or array of Products without mutating DB state.
   */
  public enrichProductWithPurchaseLinks(product: Product): Product {
    return {
      ...product,
      purchaseLinks: this.getPurchaseLinksForProduct(product),
    };
  }

  public enrichProductsWithPurchaseLinks(products: Product[]): Product[] {
    return products.map((p) => this.enrichProductWithPurchaseLinks(p));
  }

  /**
   * Retrieves cross-website price comparison offers for a product.
   * - Uses cached verified offers from SQLite when fresh.
   * - Optionally refreshes from configured external providers when `forceRefresh` is true (respecting cooldown).
   * - Fills in remaining category-relevant retailers with clearly labelled search fallback links (`price: null`).
   */
  public async getProductPriceComparison(
    productId: string,
    options: { forceRefresh?: boolean; nowMs?: number } = {}
  ): Promise<ProductPriceComparisonResult | null> {
    const product = this.productRepo.findById(productId);
    if (!product) {
      return null;
    }

    const nowMs = options.nowMs ?? Date.now();
    const configuredProviders = this.getConfiguredProviders();
    let rateLimited = false;
    let cooldownRemainingMs: number | undefined;
    let providerError: string | undefined;
    let activeProvider =
      configuredProviders.length > 0
        ? configuredProviders[0].providerName
        : 'retailer_search_fallback';

    if (options.forceRefresh) {
      const lastRefresh = this.lastRefreshByProductId.get(product.id);
      if (
        lastRefresh !== undefined &&
        this.refreshCooldownMs > 0 &&
        nowMs - lastRefresh < this.refreshCooldownMs
      ) {
        rateLimited = true;
        cooldownRemainingMs = this.refreshCooldownMs - (nowMs - lastRefresh);
      } else if (configuredProviders.length > 0) {
        this.lastRefreshByProductId.set(product.id, nowMs);
        try {
          await this.fetchAndCacheFromProviders(
            product,
            configuredProviders,
            nowMs
          );
        } catch (err: any) {
          providerError =
            err?.message || 'External shopping provider failed to respond';
          if (err?.status === 429 || String(err?.message).includes('429')) {
            rateLimited = true;
          }
        }
      } else {
        this.lastRefreshByProductId.set(product.id, nowMs);
      }
    }

    // Load stored offers from SQLite
    const dbRecords = this.offerRepo.findByProductId(product.id);
    const exactOffers: RetailerOffer[] = [];
    const similarAlternativeOffers: RetailerOffer[] = [];
    const coveredRetailerIds = new Set<string>();

    for (const rec of dbRecords) {
      // Re-verify title match against product so variant mismatches are never mixed with exact matches
      const matchEval = this.evaluateListingMatch(product, rec.listingTitle);
      if (matchEval.matchType === 'unrelated') {
        continue;
      }

      const effectiveMatchType: OfferMatchType =
        rec.matchType !== 'exact' ? rec.matchType : matchEval.matchType;

      const normalized = this.normalizeOfferRecord(
        product,
        {
          ...rec,
          matchType: effectiveMatchType,
          matchConfidence: matchEval.confidence,
          matchedVariantSummary:
            rec.matchedVariantSummary || matchEval.matchedVariantSummary,
        },
        nowMs
      );

      if (!normalized) continue;

      if (normalized.matchType === 'exact') {
        exactOffers.push(normalized);
        if (normalized.linkType === 'direct_listing') {
          coveredRetailerIds.add(normalized.retailerId);
        }
      } else {
        similarAlternativeOffers.push(normalized);
      }
    }

    // Generate category-relevant retailer search fallback offers for any retailer without a direct listing
    const searchLinks = this.generateRetailerSearchLinks(product);
    for (const sLink of searchLinks) {
      if (coveredRetailerIds.has(sLink.retailerId)) continue;
      // Also avoid duplicate search link if already in exactOffers
      if (exactOffers.some((o) => o.retailerId === sLink.retailerId)) continue;

      exactOffers.push({
        id: `search_${product.id}_${sLink.retailerId}`,
        productId: product.id,
        retailerId: sLink.retailerId,
        retailerName: sLink.retailerName,
        externalListingId: null,
        listingTitle: `Search "${product.name}" on ${sLink.retailerName}`,
        listingUrl: null,
        searchUrl: sLink.searchUrl,
        linkType: 'search_link',
        matchType: 'exact',
        matchConfidence: 1.0,
        matchedVariantSummary: 'Retailer search query',
        price: null,
        originalPrice: null,
        discountPercent: null,
        currency: 'INR',
        shippingCost: null,
        shippingKnown: false,
        totalPrice: null,
        totalIsIncomplete: false,
        availability: 'unknown',
        verificationStatus: 'unverified_search',
        sourceProvider: 'retailer_search_fallback',
        lastCheckedAt: null,
        expiresAt: null,
        statusMessage:
          "Live price unavailable — check the retailer's listing.",
        affiliateDisclosure: this.affiliateDisclosure,
      });
    }

    const sortedExactOffers = this.sortOffersDeterministically(exactOffers);
    const sortedSimilarOffers = this.sortOffersDeterministically(
      similarAlternativeOffers
    );

    const { lowestVerifiedOffer, comparableOffersCount } =
      this.findLowestVerifiedOffer(sortedExactOffers);

    const hasVerifiedDirect = sortedExactOffers.some(
      (o) => o.linkType === 'direct_listing'
    );
    if (hasVerifiedDirect && configuredProviders.length === 0) {
      activeProvider = 'catalogue_verified';
    }

    let honestStatusMessage =
      "Live price unavailable — check the retailer's listing.";
    if (providerError) {
      honestStatusMessage = `Live provider unavailable (${providerError}) — showing cached or retailer search links.`;
    } else if (rateLimited) {
      honestStatusMessage =
        'Price refresh rate limit active — showing cached or retailer search links.';
    } else if (lowestVerifiedOffer) {
      honestStatusMessage = `Lowest verified total price is ₹${lowestVerifiedOffer.totalPrice!.toLocaleString('en-IN')} at ${lowestVerifiedOffer.retailerName}.`;
    } else if (hasVerifiedDirect) {
      honestStatusMessage =
        'Verified retailer listings found, but comparable live total prices (including shipping) are incomplete or stale.';
    }

    const purchaseLinks = this.getPurchaseLinksForProduct(
      product,
      sortedExactOffers,
      lowestVerifiedOffer
    );

    return {
      productId: product.id,
      productName: product.name,
      brand: product.brand,
      category: product.category,
      cataloguePrice: product.price,
      currency: product.currency || 'INR',
      lowestVerifiedOffer,
      comparableOffersCount,
      hasComparableVerifiedPrices: comparableOffersCount > 0,
      offers: sortedExactOffers,
      similarAlternativeOffers: sortedSimilarOffers,
      purchaseLinks,
      providerStatus: {
        liveProviderConfigured: configuredProviders.length > 0,
        configuredProviders: configuredProviders.map((p) => p.providerName),
        activeProvider,
        rateLimited: rateLimited || undefined,
        cooldownRemainingMs,
        providerError,
        honestStatusMessage,
      },
      affiliateDisclosure: this.affiliateDisclosure,
      lastUpdatedAt: new Date(nowMs).toISOString(),
    };
  }

  /**
   * Fetches candidate listings from configured external providers, validates URLs against
   * the retailer allowlist & SSRF checks, evaluates product/variant match, and persists
   * verified offers in SQLite.
   */
  private async fetchAndCacheFromProviders(
    product: Product,
    providers: IRetailerOfferProvider[],
    nowMs: number
  ): Promise<void> {
    const checkedIso = new Date(nowMs).toISOString();
    const expiresIso = new Date(nowMs + this.cacheTtlMs).toISOString();

    for (const provider of providers) {
      const candidates = await provider.fetchOffersForProduct(product);
      const recordsToSave: RetailerOfferRecord[] = [];

      for (const cand of candidates) {
        const urlCheck = this.validateRetailerUrl(
          cand.listingUrl,
          cand.retailerId
        );
        if (!urlCheck.valid || !urlCheck.normalizedUrl || !urlCheck.retailerId) {
          continue;
        }

        const matchEval = this.evaluateListingMatch(product, cand.listingTitle);
        if (matchEval.matchType === 'unrelated') {
          continue;
        }

        const retailerDef = RETAILER_CATALOG[urlCheck.retailerId];
        const safeSearchUrl = retailerDef.buildSearchUrl(
          this.buildSafeSearchQuery(product)
        );
        const isDirect = urlCheck.detectedLinkType === 'direct_listing';

        recordsToSave.push({
          id: `${provider.providerName}_${product.id}_${urlCheck.retailerId}_${matchEval.matchType}`,
          productId: product.id,
          retailerId: urlCheck.retailerId,
          retailerName: urlCheck.retailerName || retailerDef.name,
          externalListingId: cand.externalListingId ?? null,
          listingTitle: cand.listingTitle,
          listingUrl: isDirect ? urlCheck.normalizedUrl : null,
          searchUrl: isDirect ? safeSearchUrl : urlCheck.normalizedUrl,
          linkType: isDirect ? 'direct_listing' : 'search_link',
          matchType: matchEval.matchType,
          matchConfidence: matchEval.confidence,
          matchedVariantSummary: matchEval.matchedVariantSummary,
          price: isDirect && typeof cand.price === 'number' ? cand.price : null,
          originalPrice:
            isDirect && typeof cand.originalPrice === 'number'
              ? cand.originalPrice
              : null,
          discountPercent: null,
          currency: cand.currency || 'INR',
          shippingCost:
            isDirect && typeof cand.shippingCost === 'number'
              ? cand.shippingCost
              : null,
          shippingKnown: Boolean(isDirect && cand.shippingKnown),
          availability: cand.availability || 'in_stock',
          verificationStatus:
            isDirect && typeof cand.price === 'number' && cand.price > 0
              ? 'live_verified'
              : 'unverified_search',
          sourceProvider: provider.providerName,
          lastCheckedAt: checkedIso,
          expiresAt: expiresIso,
        });
      }

      if (recordsToSave.length > 0) {
        this.offerRepo.deleteByProductIdAndSource(
          product.id,
          provider.providerName
        );
        this.offerRepo.upsertMany(recordsToSave);
      }
    }
  }
}
