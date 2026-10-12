import { Product, ProductFilters } from '../types/index.js';
import { IProductRepository } from '../db/repositories/product.repository.js';

export interface NormalizedCriteria {
  category?: string;
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  features?: string[];
  useCases?: string[];
  attributes?: Record<string, string | number>;
  inStockOnly?: boolean;
  searchQuery?: string;
  sortPreference?: 'price_asc' | 'price_desc' | 'rating' | 'relevance';
  requestedSubtype?: string;
  requestedSubtypeLabel?: string;
  requestedProductType?: string;
  requiredKeywords?: string[];
  excludedProductTypes?: string[];
  retailerCategoryHint?: string;
  relatedCategoryDescription?: string;
}

export interface AccessorySubtypeRule {
  subtypeId: string;
  displayName: string;
  searchQueryLabel: string;
  triggerRegex: RegExp;
  matchKeywords: string[];
  parentCategoriesToOverride: string[];
  excludedProductTypes: string[];
  retailerCategoryHint: string;
  relatedCatalogueCategories: string[];
  relatedCategoryDescription: string;
}

export const ACCESSORY_SUBTYPE_RULES: AccessorySubtypeRule[] = [
  {
    subtypeId: 'laptop-cooling-pad',
    displayName: 'laptop cooling pads',
    searchQueryLabel: 'laptop cooling pad',
    triggerRegex:
      /\b(cooling\s+pads?|laptop\s+coolers?|cooling\s+stands?|notebook\s+coolers?|cooler\s+pads?|laptop\s+cooling(?:\s+fan|\s+stand|\s+pad)?s?)\b/i,
    matchKeywords: [
      'cooling pad',
      'laptop cooler',
      'cooling stand',
      'notebook cooler',
      'cooler pad',
    ],
    parentCategoriesToOverride: ['laptops'],
    excludedProductTypes: [
      'laptop',
      'smartphone',
      'motorcycle',
      'helmet',
      'smartwatch',
    ],
    retailerCategoryHint: 'laptops',
    relatedCatalogueCategories: ['keyboards-mice', 'power-accessories'],
    relatedCategoryDescription:
      'wireless keyboards & mice or 65W GaN laptop chargers & power banks',
  },
  {
    subtypeId: 'laptop-stand',
    displayName: 'laptop stands / risers',
    searchQueryLabel: 'laptop stand',
    triggerRegex:
      /\b(laptop\s+stands?|laptop\s+risers?|notebook\s+stands?|macbook\s+stands?|laptop\s+holders?|monitor\s+stands?|monitor\s+arms?)\b/i,
    matchKeywords: [
      'laptop stand',
      'laptop riser',
      'notebook stand',
      'macbook stand',
      'laptop holder',
      'monitor stand',
    ],
    parentCategoriesToOverride: ['laptops', 'furniture'],
    excludedProductTypes: ['laptop', 'study-table', 'office-chair'],
    retailerCategoryHint: 'laptops',
    relatedCatalogueCategories: ['keyboards-mice', 'furniture'],
    relatedCategoryDescription:
      'keyboards & mice or study tables & ergonomic office chairs',
  },
  {
    subtypeId: 'laptop-sleeve',
    displayName: 'laptop sleeves / covers',
    searchQueryLabel: 'laptop sleeve',
    triggerRegex:
      /\b(laptop\s+sleeves?|laptop\s+skins?|laptop\s+covers?|laptop\s+pouches?|macbook\s+sleeves?|macbook\s+cases?)\b/i,
    matchKeywords: [
      'laptop sleeve',
      'laptop skin',
      'laptop cover',
      'laptop pouch',
      'macbook sleeve',
      'macbook case',
    ],
    parentCategoriesToOverride: ['laptops'],
    excludedProductTypes: ['laptop'],
    retailerCategoryHint: 'travel-luggage',
    relatedCatalogueCategories: ['travel-luggage', 'keyboards-mice'],
    relatedCategoryDescription:
      'laptop backpacks & travel luggage or keyboards & mice',
  },
  {
    subtypeId: 'usb-hub-dock',
    displayName: 'USB hubs / docking stations',
    searchQueryLabel: 'USB-C hub docking station',
    triggerRegex:
      /\b(usb\s+hubs?|type-?c\s+hubs?|usb-?c\s+hubs?|docking\s+stations?|laptop\s+docks?|hdmi\s+splitters?)\b/i,
    matchKeywords: [
      'usb hub',
      'type-c hub',
      'usb-c hub',
      'docking station',
      'laptop dock',
    ],
    parentCategoriesToOverride: ['laptops', 'power-accessories'],
    excludedProductTypes: ['laptop', 'power-bank', 'charger'],
    retailerCategoryHint: 'power-accessories',
    relatedCatalogueCategories: ['power-accessories', 'keyboards-mice'],
    relatedCategoryDescription:
      'power banks & fast chargers or keyboards & mice',
  },
  {
    subtypeId: 'phone-case',
    displayName: 'phone cases / back covers',
    searchQueryLabel: 'phone case back cover',
    triggerRegex:
      /\b(phone\s+cases?|phone\s+covers?|mobile\s+cases?|mobile\s+covers?|back\s+covers?|smartphone\s+cases?|iphone\s+cases?|bumper\s+cases?|silicone\s+cases?|magsafe\s+cases?)\b/i,
    matchKeywords: [
      'phone case',
      'phone cover',
      'mobile case',
      'mobile cover',
      'back cover',
      'smartphone case',
      'iphone case',
    ],
    parentCategoriesToOverride: ['smartphones'],
    excludedProductTypes: ['smartphone', 'laptop', 'smartwatch'],
    retailerCategoryHint: 'smartphones',
    relatedCatalogueCategories: ['power-accessories', 'headphones'],
    relatedCategoryDescription:
      'power banks & fast chargers or wireless earbuds',
  },
  {
    subtypeId: 'screen-protector',
    displayName: 'screen protectors / tempered glass',
    searchQueryLabel: 'tempered glass screen protector',
    triggerRegex:
      /\b(screen\s+protectors?|tempered\s+glass|screen\s+guards?|privacy\s+glass|camera\s+lens\s+protectors?)\b/i,
    matchKeywords: [
      'screen protector',
      'tempered glass',
      'screen guard',
      'privacy glass',
    ],
    parentCategoriesToOverride: ['smartphones', 'laptops', 'smartwatches'],
    excludedProductTypes: ['smartphone', 'laptop', 'smartwatch'],
    retailerCategoryHint: 'smartphones',
    relatedCatalogueCategories: ['power-accessories', 'smartphones'],
    relatedCategoryDescription: 'power banks & fast chargers',
  },
  {
    subtypeId: 'phone-holder',
    displayName: 'phone stands / mobile holders',
    searchQueryLabel: 'mobile phone stand holder',
    triggerRegex:
      /\b(phone\s+stands?|phone\s+holders?|mobile\s+stands?|mobile\s+holders?|phone\s+mounts?|car\s+phone\s+mounts?|bike\s+phone\s+mounts?|popsockets?|selfie\s+sticks?)\b/i,
    matchKeywords: [
      'phone stand',
      'phone holder',
      'mobile stand',
      'mobile holder',
      'phone mount',
      'selfie stick',
    ],
    parentCategoriesToOverride: ['smartphones', 'automotive'],
    excludedProductTypes: ['smartphone', 'motorcycle', 'helmet', 'dash-cam'],
    retailerCategoryHint: 'smartphones',
    relatedCatalogueCategories: ['power-accessories', 'automotive'],
    relatedCategoryDescription: 'power accessories or car dash cams',
  },
  {
    subtypeId: 'camera-tripod',
    displayName: 'camera tripods / camera accessories',
    searchQueryLabel: 'camera tripod',
    triggerRegex:
      /\b(camera\s+tripods?|tripods?|tripod\s+stands?|monopods?|gimbals?|camera\s+mounts?|lens\s+caps?|camera\s+straps?|camera\s+bags?|ring\s+lights?)\b/i,
    matchKeywords: [
      'camera tripod',
      'tripod',
      'tripod stand',
      'monopod',
      'gimbal',
      'lens cap',
      'camera bag',
      'ring light',
    ],
    parentCategoriesToOverride: [
      'smartphones',
      'laptops',
      'automotive',
      'travel-luggage',
    ],
    excludedProductTypes: [
      'smartphone',
      'laptop',
      'motorcycle',
      'helmet',
      'dash-cam',
      'backpack',
      'luggage',
    ],
    retailerCategoryHint: 'smartphones',
    relatedCatalogueCategories: ['power-accessories', 'travel-luggage'],
    relatedCategoryDescription:
      'power banks & accessories or travel backpacks',
  },
  {
    subtypeId: 'helmet-visor',
    displayName: 'helmet visors / pinlock inserts',
    searchQueryLabel: 'helmet visor',
    triggerRegex:
      /\b(helmet\s+visors?|visors?|pinlocks?|pinlock\s+inserts?|helmet\s+shields?|helmet\s+liners?|helmet\s+paddings?|chin\s+mounts?|helmet\s+locks?|helmet\s+intercoms?)\b/i,
    matchKeywords: [
      'helmet visor',
      'visor',
      'pinlock',
      'helmet shield',
      'helmet liner',
      'chin mount',
      'helmet lock',
      'helmet intercom',
    ],
    parentCategoriesToOverride: ['automotive'],
    excludedProductTypes: ['motorcycle', 'helmet', 'dash-cam'],
    retailerCategoryHint: 'automotive',
    relatedCatalogueCategories: ['automotive'],
    relatedCategoryDescription:
      'full-face ISI/ECE certified helmets or car dash cams',
  },
  {
    subtypeId: 'bike-accessory',
    displayName: 'motorcycle / bike accessories',
    searchQueryLabel: 'motorcycle accessory',
    triggerRegex:
      /\b(bike\s+covers?|motorcycle\s+covers?|chain\s+lubes?|chain\s+cleaners?|riding\s+gloves?|biker\s+gloves?|knee\s+guards?|tank\s+bags?|saddle\s+bags?|tyre\s+inflators?|puncture\s+kits?)\b/i,
    matchKeywords: [
      'bike cover',
      'motorcycle cover',
      'chain lube',
      'chain cleaner',
      'riding gloves',
      'knee guard',
      'tank bag',
      'saddle bag',
      'tyre inflator',
    ],
    parentCategoriesToOverride: ['automotive'],
    excludedProductTypes: ['motorcycle', 'helmet', 'dash-cam'],
    retailerCategoryHint: 'automotive',
    relatedCatalogueCategories: ['automotive'],
    relatedCategoryDescription:
      'full-face helmets, dash cams, or commuter motorcycles',
  },
  {
    subtypeId: 'watch-strap',
    displayName: 'watch straps / bands',
    searchQueryLabel: 'smartwatch strap band',
    triggerRegex:
      /\b(watch\s+straps?|watch\s+bands?|smartwatch\s+straps?|smartwatch\s+bands?|apple\s+watch\s+bands?|watch\s+chargers?)\b/i,
    matchKeywords: [
      'watch strap',
      'watch band',
      'smartwatch strap',
      'smartwatch band',
    ],
    parentCategoriesToOverride: ['smartwatches'],
    excludedProductTypes: ['smartwatch'],
    retailerCategoryHint: 'smartwatches',
    relatedCatalogueCategories: ['smartwatches', 'power-accessories'],
    relatedCategoryDescription: 'smartwatches or charging accessories',
  },
  {
    subtypeId: 'earbud-accessory',
    displayName: 'earbud cases / headphone cushions',
    searchQueryLabel: 'earbud case ear tips',
    triggerRegex:
      /\b(earbud\s+cases?|airpods?\s+cases?|ear\s+tips?|earpads?|headphone\s+cushions?|headphone\s+stands?)\b/i,
    matchKeywords: [
      'earbud case',
      'airpods case',
      'ear tips',
      'earpads',
      'headphone cushion',
      'headphone stand',
    ],
    parentCategoriesToOverride: ['headphones'],
    excludedProductTypes: ['earbuds', 'headphone', 'neckband'],
    retailerCategoryHint: 'headphones',
    relatedCatalogueCategories: ['headphones'],
    relatedCategoryDescription: 'wireless earbuds and headphones',
  },
  {
    subtypeId: 'gaming-console',
    displayName: 'gaming consoles',
    searchQueryLabel: 'gaming console',
    triggerRegex:
      /\b(gaming\s+consoles?|video\s+game\s+consoles?|ps5|playstation\s*[45]?|xbox(?:\s+series\s*[xs])?|nintendo\s+switch|steam\s+deck|handheld\s+consoles?)\b/i,
    matchKeywords: [
      'gaming console',
      'video game console',
      'playstation 5 console',
      'xbox series x console',
      'nintendo switch console',
      'steam deck console',
    ],
    parentCategoriesToOverride: ['laptops', 'smartphones', 'keyboards-mice', 'headphones'],
    excludedProductTypes: [
      'laptop',
      'smartphone',
      'mouse',
      'keyboard',
      'headphone',
      'headphones',
      'earbuds',
      'neckband',
      'speaker',
      'office-chair',
      'study-table',
    ],
    retailerCategoryHint: 'laptops',
    relatedCatalogueCategories: ['laptops', 'keyboards-mice'],
    relatedCategoryDescription: 'gaming laptops or mechanical gaming keyboards & mice',
  },
];

// Canonical category aliases for flexible input matching across ALL product sectors
const CATEGORY_ALIASES: Record<string, string> = {
  // Headphones & Audio
  headphones: 'headphones',
  headphone: 'headphones',
  'wireless headphones': 'headphones',
  earbuds: 'headphones',
  earbud: 'headphones',
  tws: 'headphones',
  earphones: 'headphones',
  earphone: 'headphones',
  neckband: 'headphones',
  neckbands: 'headphones',
  airpods: 'headphones',
  audio: 'headphones',
  '🎧': 'headphones',

  // Smartphones
  smartphones: 'smartphones',
  smartphone: 'smartphones',
  phones: 'smartphones',
  phone: 'smartphones',
  mobiles: 'smartphones',
  mobile: 'smartphones',
  cellphone: 'smartphones',
  '5g phone': 'smartphones',
  '5g phones': 'smartphones',
  '📱': 'smartphones',

  // Smartwatches
  smartwatches: 'smartwatches',
  smartwatch: 'smartwatches',
  'smart watch': 'smartwatches',
  'smart watches': 'smartwatches',
  watches: 'smartwatches',
  watch: 'smartwatches',
  'fitness tracker': 'smartwatches',
  'fitness band': 'smartwatches',
  wearables: 'smartwatches',
  '⌚': 'smartwatches',

  // Laptops
  laptops: 'laptops',
  laptop: 'laptops',
  notebooks: 'laptops',
  notebook: 'laptops',
  macbook: 'laptops',
  macbooks: 'laptops',
  ultrabook: 'laptops',
  'gaming laptop': 'laptops',
  '💻': 'laptops',

  // Keyboards & Mice
  'keyboards-mice': 'keyboards-mice',
  keyboard: 'keyboards-mice',
  keyboards: 'keyboards-mice',
  mouse: 'keyboards-mice',
  mice: 'keyboards-mice',
  'keyboard and mouse': 'keyboards-mice',
  'keyboard mouse': 'keyboards-mice',
  'mechanical keyboard': 'keyboards-mice',
  '⌨️': 'keyboards-mice',
  '⌨': 'keyboards-mice',
  '🖱️': 'keyboards-mice',
  '🖱': 'keyboards-mice',

  // Power & Accessories
  'power-accessories': 'power-accessories',
  'power banks': 'power-accessories',
  'power bank': 'power-accessories',
  powerbank: 'power-accessories',
  powerbanks: 'power-accessories',
  chargers: 'power-accessories',
  charger: 'power-accessories',
  adapter: 'power-accessories',
  adapters: 'power-accessories',
  'gan charger': 'power-accessories',
  'fast charger': 'power-accessories',
  '🔋': 'power-accessories',

  // Fashion & Apparel
  fashion: 'fashion',
  apparel: 'fashion',
  clothing: 'fashion',
  clothes: 'fashion',
  hoodie: 'fashion',
  hoodies: 'fashion',
  'black hoodie': 'fashion',
  'black hoodies': 'fashion',
  't-shirt': 'fashion',
  't-shirts': 'fashion',
  tshirt: 'fashion',
  tshirts: 'fashion',
  shirt: 'fashion',
  shirts: 'fashion',
  jacket: 'fashion',
  jackets: 'fashion',
  jeans: 'fashion',
  sweatshirt: 'fashion',
  sweatshirts: 'fashion',
  kurta: 'fashion',
  dress: 'fashion',
  dresses: 'fashion',
  trousers: 'fashion',
  '🧥': 'fashion',
  '👕': 'fashion',

  // Footwear
  footwear: 'footwear',
  shoes: 'footwear',
  shoe: 'footwear',
  sneakers: 'footwear',
  sneaker: 'footwear',
  'running shoes': 'footwear',
  'running shoe': 'footwear',
  'sports shoes': 'footwear',
  boots: 'footwear',
  sandals: 'footwear',
  loafers: 'footwear',
  '👟': 'footwear',

  // Home & Furniture
  furniture: 'furniture',
  chair: 'furniture',
  chairs: 'furniture',
  'office chair': 'furniture',
  'office chairs': 'furniture',
  'desk chair': 'furniture',
  'ergonomic chair': 'furniture',
  'study table': 'furniture',
  'study tables': 'furniture',
  table: 'furniture',
  tables: 'furniture',
  desk: 'furniture',
  desks: 'furniture',
  sofa: 'furniture',
  bookshelf: 'furniture',
  bed: 'furniture',
  wardrobe: 'furniture',
  '🪑': 'furniture',

  // Kitchen & Home Appliances
  'kitchen-appliances': 'kitchen-appliances',
  kitchen: 'kitchen-appliances',
  appliances: 'kitchen-appliances',
  'pressure cooker': 'kitchen-appliances',
  'pressure cookers': 'kitchen-appliances',
  cooker: 'kitchen-appliances',
  cookers: 'kitchen-appliances',
  'air fryer': 'kitchen-appliances',
  'air fryers': 'kitchen-appliances',
  blender: 'kitchen-appliances',
  blenders: 'kitchen-appliances',
  mixer: 'kitchen-appliances',
  'mixer grinder': 'kitchen-appliances',
  cookware: 'kitchen-appliances',
  pan: 'kitchen-appliances',
  kadai: 'kitchen-appliances',
  induction: 'kitchen-appliances',
  'induction cooktop': 'kitchen-appliances',
  'coffee maker': 'kitchen-appliances',
  kettle: 'kitchen-appliances',
  '🍳': 'kitchen-appliances',

  // Beauty & Personal Care
  'beauty-personal-care': 'beauty-personal-care',
  beauty: 'beauty-personal-care',
  skincare: 'beauty-personal-care',
  'personal care': 'beauty-personal-care',
  sunscreen: 'beauty-personal-care',
  sunscreens: 'beauty-personal-care',
  sunblock: 'beauty-personal-care',
  facewash: 'beauty-personal-care',
  'face wash': 'beauty-personal-care',
  moisturizer: 'beauty-personal-care',
  moisturiser: 'beauty-personal-care',
  serum: 'beauty-personal-care',
  serums: 'beauty-personal-care',
  shampoo: 'beauty-personal-care',
  perfume: 'beauty-personal-care',
  fragrance: 'beauty-personal-care',
  grooming: 'beauty-personal-care',
  'hair dryer': 'beauty-personal-care',
  '🧴': 'beauty-personal-care',

  // Sports, Fitness & Outdoors
  'sports-fitness': 'sports-fitness',
  sports: 'sports-fitness',
  fitness: 'sports-fitness',
  'gym equipment': 'sports-fitness',
  dumbbell: 'sports-fitness',
  dumbbells: 'sports-fitness',
  'yoga mat': 'sports-fitness',
  'yoga mats': 'sports-fitness',
  bicycle: 'sports-fitness',
  bicycles: 'sports-fitness',
  cycle: 'sports-fitness',
  cycles: 'sports-fitness',
  badminton: 'sports-fitness',
  cricket: 'sports-fitness',
  'water bottle': 'sports-fitness',
  'water bottles': 'sports-fitness',
  bottle: 'sports-fitness',
  bottles: 'sports-fitness',
  sipper: 'sports-fitness',
  flask: 'sports-fitness',
  '🏸': 'sports-fitness',
  '🧘': 'sports-fitness',

  // Automotive, Two-Wheelers & Riding Gear
  automotive: 'automotive',
  bike: 'automotive',
  bikes: 'automotive',
  motorcycle: 'automotive',
  motorcycles: 'automotive',
  'commuter bike': 'automotive',
  scooter: 'automotive',
  scooters: 'automotive',
  'two wheeler': 'automotive',
  helmet: 'automotive',
  helmets: 'automotive',
  'riding gear': 'automotive',
  'riding jacket': 'automotive',
  'dash cam': 'automotive',
  'motorcycles / bikes': 'automotive',
  'two-wheelers': 'automotive',
  '🏍️': 'automotive',
  '🏍': 'automotive',
  '🛵': 'automotive',

  // Books & Education
  books: 'books',
  book: 'books',
  novel: 'books',
  novels: 'books',
  textbook: 'books',
  'coding book': 'books',
  'coding books': 'books',
  'programming books': 'books',
  '📚': 'books',
  '📖': 'books',

  // Travel & Luggage
  'travel-luggage': 'travel-luggage',
  travel: 'travel-luggage',
  luggage: 'travel-luggage',
  backpack: 'travel-luggage',
  backpacks: 'travel-luggage',
  trolley: 'travel-luggage',
  'trolley bag': 'travel-luggage',
  suitcase: 'travel-luggage',
  'travel bag': 'travel-luggage',
  '🎒': 'travel-luggage',
  '🧳': 'travel-luggage',

  // Women's Ethnic & Western Fashion Categories
  'kurtis-kurtas': 'kurtis-kurtas',
  'kurtis & kurtas': 'kurtis-kurtas',
  'kurtis & everyday kurtas': 'kurtis-kurtas',
  kurti: 'kurtis-kurtas',
  kurtis: 'kurtis-kurtas',
  kurtas: 'kurtis-kurtas',
  anarkali: 'kurtis-kurtas',
  'anarkali kurta': 'kurtis-kurtas',
  'cotton kurti': 'kurtis-kurtas',
  'chikankari kurti': 'kurtis-kurtas',
  sarees: 'sarees',
  saree: 'sarees',
  sari: 'sarees',
  saris: 'sarees',
  'silk saree': 'sarees',
  'cotton saree': 'sarees',
  'banarasi saree': 'sarees',
  'kanjivaram saree': 'sarees',
  'organza saree': 'sarees',
  'ethnic-sets-festive-wear': 'ethnic-sets-festive-wear',
  'ethnic sets & festive wear': 'ethnic-sets-festive-wear',
  'ethnic set': 'ethnic-sets-festive-wear',
  'ethnic sets': 'ethnic-sets-festive-wear',
  'festive wear': 'ethnic-sets-festive-wear',
  'kurta set': 'ethnic-sets-festive-wear',
  'kurta sets': 'ethnic-sets-festive-wear',
  'salwar suit': 'ethnic-sets-festive-wear',
  'salwar suits': 'ethnic-sets-festive-wear',
  'sharara set': 'ethnic-sets-festive-wear',
  sharara: 'ethnic-sets-festive-wear',
  'womens-ethnic-wear': 'womens-ethnic-wear',
  "women's ethnic wear": 'womens-ethnic-wear',
  'womens ethnic wear': 'womens-ethnic-wear',
  'ethnic wear': 'womens-ethnic-wear',
  'indian ethnic wear': 'womens-ethnic-wear',
  'western-wear': 'western-wear',
  'western wear': 'western-wear',
  "women's western wear": 'western-wear',
  'womens-outerwear': 'womens-outerwear',
  "women's outerwear": 'womens-outerwear',
  'womens outerwear': 'womens-outerwear',
  "women's outerwear & occasion wear": 'womens-outerwear',
  'occasion wear': 'womens-outerwear',

  // Gifts & Occasions (can match gift items or open search)
  gifts: 'gifts',
  gift: 'gifts',
  'birthday gift': 'gifts',
  '🎁': 'gifts',
};

// Broad umbrella categories mapping to multiple member categories
const UMBRELLA_CATEGORIES: Record<string, string[]> = {
  fashion: ['fashion', 'footwear'],
  apparel: ['fashion'],
  'womens-ethnic-wear': ['kurtis-kurtas', 'sarees', 'ethnic-sets-festive-wear'],
  electronics: ['headphones', 'smartphones', 'smartwatches', 'laptops', 'keyboards-mice', 'power-accessories'],
  gadgets: ['headphones', 'smartphones', 'smartwatches', 'laptops', 'keyboards-mice', 'power-accessories'],
  sports: ['sports-fitness', 'footwear'],
};

export class FilterService {
  constructor(private productRepo: IProductRepository) {}

  /**
   * Detects if text or criteria matches an accessory / specific product subtype rule
   * that must NOT be conflated with its parent device category.
   */
  public static detectAccessoryRule(text?: string): AccessorySubtypeRule | undefined {
    if (!text) return undefined;
    const cleaned = text.toLowerCase().trim();
    if (!cleaned) return undefined;
    return ACCESSORY_SUBTYPE_RULES.find((rule) => rule.triggerRegex.test(cleaned));
  }

  /**
   * Looks up an accessory / subtype rule by its canonical subtypeId.
   */
  public static findAccessoryRuleById(
    subtypeId?: string
  ): AccessorySubtypeRule | undefined {
    if (!subtypeId) return undefined;
    const cleaned = subtypeId.toLowerCase().trim();
    return ACCESSORY_SUBTYPE_RULES.find((rule) => rule.subtypeId === cleaned);
  }

  /**
   * Normalizes category string to database canonical form
   */
  public normalizeCategory(input?: string): string | undefined {
    if (!input) return undefined;
    const cleaned = input.toLowerCase().trim();
    return CATEGORY_ALIASES[cleaned] || cleaned;
  }

  /**
   * Normalizes brand name (trims and standardizes common variations)
   */
  public normalizeBrand(input?: string): string | undefined {
    if (!input) return undefined;
    return input.trim();
  }

  /**
   * Normalizes raw user/assistant criteria into clean, typed filters
   */
  public normalizeCriteria(raw: Partial<NormalizedCriteria>): NormalizedCriteria {
    let minPrice = typeof raw.minPrice === 'number' && raw.minPrice >= 0 ? raw.minPrice : undefined;
    let maxPrice = typeof raw.maxPrice === 'number' && raw.maxPrice >= 0 ? raw.maxPrice : undefined;

    // Handle contradictory minPrice > maxPrice bounds gracefully
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      const temp = minPrice;
      minPrice = maxPrice;
      maxPrice = temp;
    }

    let normalizedCategory = this.normalizeCategory(raw.category);
    let categories = raw.categories;

    // Expand umbrella categories if applicable
    if (normalizedCategory && UMBRELLA_CATEGORIES[normalizedCategory]) {
      categories = UMBRELLA_CATEGORIES[normalizedCategory];
    }

    let rawFeatures = Array.isArray(raw.features)
      ? raw.features.map((f) => f.trim().toLowerCase()).filter(Boolean)
      : undefined;

    let searchQuery = raw.searchQuery?.trim();
    let requestedSubtype = raw.requestedSubtype;
    let requestedSubtypeLabel = raw.requestedSubtypeLabel;
    let requiredKeywords = raw.requiredKeywords ? [...raw.requiredKeywords] : undefined;
    let excludedProductTypes = raw.excludedProductTypes
      ? [...raw.excludedProductTypes]
      : undefined;
    let retailerCategoryHint = raw.retailerCategoryHint;
    let relatedCategoryDescription = raw.relatedCategoryDescription;

    // Check if any input field triggers an accessory / specific subtype rule
    const combinedTextForSubtype = [
      raw.requestedSubtype,
      raw.category,
      raw.searchQuery,
      ...(rawFeatures || []),
    ]
      .filter(Boolean)
      .join(' ');

    const matchedRule =
      FilterService.findAccessoryRuleById(raw.requestedSubtype) ||
      FilterService.detectAccessoryRule(combinedTextForSubtype);

    if (matchedRule) {
      requestedSubtype = matchedRule.subtypeId;
      requestedSubtypeLabel = matchedRule.displayName;
      requiredKeywords = Array.from(
        new Set([...(requiredKeywords || []), ...matchedRule.matchKeywords])
      );
      excludedProductTypes = Array.from(
        new Set([
          ...(excludedProductTypes || []),
          ...matchedRule.excludedProductTypes,
        ])
      );
      retailerCategoryHint = matchedRule.retailerCategoryHint;
      relatedCategoryDescription = matchedRule.relatedCategoryDescription;

      // Never allow an accessory query to be restricted to or replaced by its parent device category
      if (
        normalizedCategory &&
        (matchedRule.parentCategoriesToOverride.includes(normalizedCategory) ||
          matchedRule.triggerRegex.test(normalizedCategory) ||
          !Object.values(CATEGORY_ALIASES).includes(normalizedCategory))
      ) {
        normalizedCategory = undefined;
        categories = undefined;
      }

      // If searchQuery was just the accessory phrase, let requiredKeywords handle multi-alias matching
      if (searchQuery && matchedRule.triggerRegex.test(searchQuery)) {
        searchQuery = undefined;
      }

      // Remove the accessory noun itself from secondary features so RelaxationService never strips it
      if (rawFeatures && rawFeatures.length > 0) {
        const filteredFeatures = rawFeatures.filter((f) => {
          if (matchedRule.triggerRegex.test(f)) return false;
          if (
            matchedRule.matchKeywords.some(
              (kw) => kw.includes(f) || f.includes(kw)
            )
          ) {
            return false;
          }
          return true;
        });
        rawFeatures = filteredFeatures.length > 0 ? filteredFeatures : undefined;
      }
    }

    return {
      category: normalizedCategory,
      categories,
      brand: this.normalizeBrand(raw.brand),
      minPrice,
      maxPrice,
      features: rawFeatures,
      useCases: Array.isArray(raw.useCases)
        ? raw.useCases.map((u) => u.trim().toLowerCase()).filter(Boolean)
        : undefined,
      attributes: raw.attributes,
      inStockOnly: raw.inStockOnly !== false, // default to true
      searchQuery,
      sortPreference: raw.sortPreference,
      requestedSubtype,
      requestedSubtypeLabel,
      requestedProductType: raw.requestedProductType,
      requiredKeywords,
      excludedProductTypes,
      retailerCategoryHint,
      relatedCategoryDescription,
    };
  }

  /**
   * Parses explicit product names from comparison queries such as:
   * - "Compare Royal Enfield Hunter 350 vs Triumph Speed 400"
   * - "Royal Enfield Hunter 350 versus Triumph Speed 400"
   * - "Difference between Sony WH-CH720N and JBL Tune 770NC"
   * - "Compare Hunter 350, Speed 400 and Honda CB350RS"
   *
   * Ignores ordinal/pronoun follow-up references like "compare the first two" or "compare them".
   */
  public static extractExplicitComparisonQueries(userMessage: string): string[] {
    if (!userMessage) return [];
    const trimmed = userMessage.trim();
    if (!trimmed) return [];

    // Check if the query is purely an ordinal/pronoun or referential follow-up comparison
    const ordinalFollowUpRegex =
      /^(?:please\s+|can\s+you\s+)?(?:compare|pit|show\s+comparison\s+of|difference\s+between)\s+(?:the\s+)?(?:first\s+two|top\s+two|top\s+2|first\s+2|first\s+and\s+second|1st\s+and\s+2nd|1\s+and\s+2|option\s+1\s+and\s+(?:option\s+)?2|both(?:\s+of\s+them)?|them|these(?:\s+two)?|those(?:\s+two)?|all(?:\s+of\s+them|\s+three)?|the\s+two)\b/i;
    const referentialComparisonRegex =
      /\b(products?\s+you\s+(?:just\s+)?(?:recommended|showed|listed|found)|options?\s+you\s+(?:just\s+)?(?:recommended|showed|listed|found)|items?\s+you\s+(?:just\s+)?(?:recommended|showed)|recommendations?|previous\s+(?:products?|options?|ones?|items?)|trade-?offs?|explain\s+the)\b/i;
    if (ordinalFollowUpRegex.test(trimmed) || referentialComparisonRegex.test(trimmed)) {
      return [];
    }

    const hasVsSeparator = /\s+(?:vs\.?|versus|v\/s|against|compared\s+to|compared\s+with)\s+/i.test(
      trimmed
    );
    const hasCompareLead =
      /^(?:please\s+|can\s+you\s+|could\s+you\s+|help\s+me\s+)?(?:compare|comparison\s+of|comparison\s+between|difference\s+between|differences\s+between|which\s+is\s+better\s+between)\s+/i.test(
        trimmed
      );

    if (!hasVsSeparator && !hasCompareLead) {
      return [];
    }

    // Strip leading comparison verbs and trailing polite clauses
    let body = trimmed
      .replace(
        /^(?:please\s+|can\s+you\s+|could\s+you\s+|help\s+me\s+)?(?:compare|comparison\s+of|comparison\s+between|difference\s+between|differences\s+between|which\s+is\s+better\s+between|which\s+is\s+better)\s+/i,
        ''
      )
      .replace(/\s*\?+$/, '')
      .replace(/\s+(?:which\s+one\s+is\s+better|which\s+is\s+better|which\s+should\s+i\s+buy).*$/i, '')
      .trim();

    let parts: string[] = [];
    if (hasVsSeparator) {
      parts = body
        .split(/\s+(?:vs\.?|versus|v\/s|against|compared\s+to|compared\s+with|,|\band\b)\s+/i)
        .map((p) => p.trim())
        .filter(Boolean);
    } else {
      parts = body
        .split(/\s*(?:,|\s+and\s+|\s+vs\.?\s+|\s+versus\s+)\s*/i)
        .map((p) => p.trim())
        .filter(Boolean);
    }

    const pronounIgnore = new Set([
      'them',
      'these',
      'those',
      'both',
      'all',
      'it',
      'first',
      'second',
      'third',
      'the first',
      'the second',
      'the first one',
      'the second one',
      'first two',
      'the first two',
      'top two',
      'top 2',
      'option 1',
      'option 2',
    ]);

    const cleanedParts = parts
      .map((p) =>
        p
          .replace(/^(?:the\s+|a\s+|an\s+|between\s+)/i, '')
          .replace(/\s+(?:for\s+me|please|now)$/i, '')
          .trim()
      )
      .filter((p) => p.length >= 2 && !pronounIgnore.has(p.toLowerCase()));

    return cleanedParts.length >= 2 ? cleanedParts.slice(0, 4) : [];
  }

  /**
   * Extracts an explicit product model name from single-product action queries such as:
   * - "Show links to buy Triumph Speed 400"
   * - "Price of Royal Enfield Hunter 350"
   * - "Tell me about Sony WH-CH720N"
   * - "Add boAt Rockerz 550 to cart"
   */
  public static extractSingleExplicitProductQuery(userMessage: string): string | undefined {
    if (!userMessage) return undefined;
    const trimmed = userMessage.trim();

    const patterns: RegExp[] = [
      /^(?:show\s+|get\s+|find\s+)?(?:me\s+)?(?:buying\s+|purchase\s+|retailer\s+|store\s+)?(?:links?|urls?|where)\s+(?:to\s+buy|for|of)\s+(.+?)(?:\s+online|\s+in\s+india|\?|$)/i,
      /^(?:what\s+is\s+the\s+|check\s+|show\s+)?price\s+(?:of|for|comparison\s+for)\s+(.+?)(?:\s+in\s+india|\?|$)/i,
      /^(?:add|put)\s+(.+?)\s+(?:to|in|into)\s+(?:my\s+|the\s+)?(?:cart|bag)/i,
      /^(?:tell\s+me\s+(?:more\s+)?about|show\s+(?:me\s+)?(?:details|specs|specifications)\s+(?:of|for))\s+(.+?)(?:\?|$)/i,
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim().replace(/\?+$/, '').trim();
        const lower = candidate.toLowerCase();
        if (
          candidate.length >= 3 &&
          !/^(?:it|this|that|them|the\s+first(?:\s+one)?|the\s+second(?:\s+one)?|the\s+third(?:\s+one)?|first\s+one|second\s+one|option\s+\d+|product\s+\d+)$/i.test(
            lower
          )
        ) {
          return candidate;
        }
      }
    }
    return undefined;
  }

  /**
   * Resolves a single explicit product/model query (e.g., "Royal Enfield Hunter 350",
   * "Triumph Speed 400", "Sony WH-CH720N") against the catalogue with strict model-number
   * and brand verification so non-existent models never falsely match a different model.
   */
  public resolveProductByModelQuery(
    modelQuery: string,
    candidatePool?: Product[]
  ): { product?: Product; score: number; matchedTokens: string[] } {
    const rawQuery = (modelQuery || '').trim();
    if (!rawQuery) {
      return { score: 0, matchedTokens: [] };
    }

    const pool = candidatePool ?? this.productRepo.findMany({ limit: 500, inStockOnly: false });
    const queryLower = rawQuery
      .toLowerCase()
      .replace(/[()[\],/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const stopWords = new Set([
      'compare',
      'comparison',
      'vs',
      'versus',
      'the',
      'and',
      'with',
      'for',
      'in',
      'of',
      'to',
      'buy',
      'price',
      'links',
      'link',
      'india',
      'motorcycle',
      'bike',
      'scooter',
      'roadster',
      'phone',
      'smartphone',
      'laptop',
      'headphones',
      'headphone',
      'earbuds',
      'wireless',
    ]);

    // Tokenize while keeping both hyphenated and split forms
    const rawTokens = queryLower
      .split(/[\s-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !stopWords.has(t));

    if (rawTokens.length === 0) {
      return { score: 0, matchedTokens: [] };
    }

    // Known brand phrases to verify brand consistency when explicitly stated
    const knownBrands = [
      'royal enfield',
      'triumph',
      'kawasaki',
      'yamaha',
      'ktm',
      'bajaj',
      'tvs',
      'suzuki',
      'hero',
      'honda',
      'harley',
      'ducati',
      'bmw',
      'ather',
      'ola',
      'vespa',
      'sony',
      'jbl',
      'boat',
      'oneplus',
      'realme',
      'soundcore',
      'anker',
      'noise',
      'sennheiser',
      'bose',
      'apple',
      'samsung',
      'google',
      'nothing',
      'xiaomi',
      'redmi',
      'poco',
      'vivo',
      'iqoo',
      'oppo',
      'motorola',
      'lenovo',
      'asus',
      'dell',
      'hp',
      'acer',
      'msi',
      'nike',
      'adidas',
      'puma',
      'asics',
      'skechers',
    ];

    const mentionedBrands = knownBrands.filter((b) => {
      const bRegex = new RegExp(`\\b${b.replace(/\s+/g, '\\s+')}\\b`, 'i');
      return bRegex.test(queryLower);
    });

    const brandTokenSet = new Set(
      mentionedBrands.flatMap((b) => b.split(/\s+/))
    );

    // Non-brand tokens identify the specific model (e.g., ["hunter", "350"] or ["speed", "400"] or ["ninja", "300"])
    const modelTokens = rawTokens.filter((t) => !brandTokenSet.has(t));

    // Numeric / alphanumeric model identifiers (e.g., "350", "400", "500", "300", "550", "720n", "2r", "t300")
    const numericModelTokens = modelTokens.filter((t) => /\d/.test(t));

    let bestProduct: Product | undefined;
    let bestScore = 0;
    let bestMatchedTokens: string[] = [];

    for (const product of pool) {
      const pNameLower = product.name.toLowerCase();
      const pBrandLower = product.brand.toLowerCase();
      const pIdLower = product.id.toLowerCase();
      const pDescLower = product.description.toLowerCase();
      const pPrimarySearch = `${pNameLower} ${pBrandLower} ${pIdLower.replace(/-/g, ' ')}`;

      // 1. If the user explicitly mentioned a known brand, the product MUST belong to that brand
      if (mentionedBrands.length > 0) {
        const brandMatches = mentionedBrands.some(
          (b) => pBrandLower.includes(b) || pNameLower.includes(b)
        );
        if (!brandMatches) {
          continue;
        }
      }

      // 2. Every numeric/alphanumeric model token in the query MUST appear as a distinct token in the product name/id
      // This ensures "Classic 500" or "Ninja 300" NEVER matches "Classic 350"
      if (numericModelTokens.length > 0) {
        const allNumericMatched = numericModelTokens.every((numTok) => {
          const escaped = numTok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const tokenBoundaryRegex = new RegExp(`(?:^|[\\s\\-/()])${escaped}(?:$|[\\s\\-/()]|cc\\b)`, 'i');
          return tokenBoundaryRegex.test(pPrimarySearch);
        });
        if (!allNumericMatched) {
          continue;
        }
      }

      // 3. Score token overlap
      const matchedTokens: string[] = [];
      const matchedModelTokens: string[] = [];
      let score = 0;

      if (pNameLower.includes(queryLower)) {
        score += 55;
      }

      if (mentionedBrands.length > 0) {
        score += 15;
      }

      for (const token of rawTokens) {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordRegex = new RegExp(`(?:^|[\\s\\-/()])${escaped}(?:$|[\\s\\-/()])`, 'i');
        if (wordRegex.test(pPrimarySearch) || pNameLower.includes(token)) {
          matchedTokens.push(token);
          if (!brandTokenSet.has(token)) {
            matchedModelTokens.push(token);
            score += /\d/.test(token) ? 25 : 22;
          } else {
            score += 8;
          }
        } else if (pDescLower.includes(token)) {
          matchedTokens.push(token);
          score += 4;
        }
      }

      // If the query has model tokens beyond the brand name, require high model-token coverage in the product name/ID
      if (modelTokens.length > 0) {
        const modelCoverage = matchedModelTokens.length / modelTokens.length;
        if (matchedModelTokens.length === 0 || modelCoverage < 0.6) {
          continue;
        }
      }

      // Bonus for in-stock verified products
      if (product.availability) {
        score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestProduct = product;
        bestMatchedTokens = matchedTokens;
      }
    }

    if (!bestProduct || bestScore < 28) {
      return { score: 0, matchedTokens: [] };
    }

    return {
      product: bestProduct,
      score: bestScore,
      matchedTokens: bestMatchedTokens,
    };
  }

  /**
   * Resolves an array of explicit product queries independently against the catalogue.
   */
  public resolveExplicitProductsFromQueries(queries: string[]): {
    queries: string[];
    matchedProducts: Product[];
    unmatchedQueries: string[];
    resolutionDetails: Array<{ query: string; product?: Product; score: number }>;
  } {
    const allProducts = this.productRepo.findMany({ limit: 500, inStockOnly: false });
    const matchedProducts: Product[] = [];
    const unmatchedQueries: string[] = [];
    const resolutionDetails: Array<{ query: string; product?: Product; score: number }> = [];
    const seenIds = new Set<string>();

    for (const q of queries) {
      const resolved = this.resolveProductByModelQuery(q, allProducts);
      if (resolved.product) {
        resolutionDetails.push({
          query: q,
          product: resolved.product,
          score: resolved.score,
        });
        if (!seenIds.has(resolved.product.id)) {
          seenIds.add(resolved.product.id);
          matchedProducts.push(resolved.product);
        }
      } else {
        unmatchedQueries.push(q);
        resolutionDetails.push({
          query: q,
          score: 0,
        });
      }
    }

    return {
      queries,
      matchedProducts,
      unmatchedQueries,
      resolutionDetails,
    };
  }

  /**
   * Deterministically filters products from database matching all specified criteria
   */
  public filterProducts(criteria: NormalizedCriteria): Product[] {
    const normalized = this.normalizeCriteria(criteria);

    // 1. Fetch products from DB using primary SQL filters (category, brand, price bounds, inStock)
    const dbFilters: ProductFilters = {
      category: normalized.category === 'gifts' ? undefined : normalized.category,
      categories: normalized.categories,
      brand: normalized.brand,
      minPrice: normalized.minPrice,
      maxPrice: normalized.maxPrice,
      inStockOnly: normalized.inStockOnly,
      searchQuery: normalized.searchQuery,
      limit: 500,
    };

    let candidates = this.productRepo.findMany(dbFilters);

    // 1a. Enforce excludedProductTypes (prevents parent devices like laptops/smartphones from matching accessory queries)
    if (
      normalized.excludedProductTypes &&
      normalized.excludedProductTypes.length > 0
    ) {
      const excludedSet = new Set(
        normalized.excludedProductTypes.map((t) => t.toLowerCase().trim())
      );
      const parentCategoryImpliedType: Record<string, string> = {
        laptops: 'laptop',
        smartphones: 'smartphone',
        smartwatches: 'smartwatch',
        headphones: 'headphone',
      };

      candidates = candidates.filter((product) => {
        const pType = (product.product_type || '').toLowerCase().trim();
        if (pType && excludedSet.has(pType)) {
          return false;
        }
        if (!pType) {
          const implied =
            parentCategoryImpliedType[(product.category || '').toLowerCase().trim()];
          if (implied && excludedSet.has(implied)) {
            const nameLower = product.name.toLowerCase();
            const hasKeywordInName =
              normalized.requiredKeywords &&
              normalized.requiredKeywords.some((kw) =>
                nameLower.includes(kw.toLowerCase())
              );
            if (!hasKeywordInName) {
              return false;
            }
          }
        }
        return true;
      });
    }

    // 1b. Enforce requiredKeywords for accessory / specific product subtype queries
    // Check primary identity fields (name and product_type) so products that merely mention
    // compatibility in their description do not falsely match as that item.
    if (normalized.requiredKeywords && normalized.requiredKeywords.length > 0) {
      candidates = candidates.filter((product) => {
        const primaryIdentityText = [
          product.name,
          product.product_type || '',
        ]
          .join(' ')
          .toLowerCase();
        return normalized.requiredKeywords!.some((kw) =>
          primaryIdentityText.includes(kw.toLowerCase())
        );
      });
    }

    // 2. Deterministically filter in memory for required features (if specified)
    if (normalized.features && normalized.features.length > 0) {
      candidates = candidates.filter((product) =>
        this.matchesAllFeatures(product, normalized.features!)
      );
    }

    // 3. Deterministically filter in memory for required use cases (if specified)
    if (normalized.useCases && normalized.useCases.length > 0) {
      candidates = candidates.filter((product) =>
        this.matchesAnyUseCase(product, normalized.useCases!)
      );
    }

    // 4. Deterministically filter in memory for attributes/specifications (if specified)
    if (normalized.attributes && Object.keys(normalized.attributes).length > 0) {
      candidates = candidates.filter((product) =>
        this.matchesAttributes(product, normalized.attributes!)
      );
    }

    return candidates;
  }

  /**
   * Checks if a product satisfies all required feature constraints
   */
  public matchesAllFeatures(product: Product, requiredFeatures: string[]): boolean {
    const productFeaturesText = [
      product.name,
      ...product.features,
      product.description,
      ...Object.values(product.specifications).map(String),
    ]
      .join(' ')
      .toLowerCase();

    return requiredFeatures.every((reqFeature) =>
      this.featureMatchesText(reqFeature, productFeaturesText)
    );
  }

  /**
   * Checks if a product satisfies at least one of the requested use cases
   */
  public matchesAnyUseCase(product: Product, requestedUseCases: string[]): boolean {
    const productUseCases = product.use_cases.map((u) => u.toLowerCase());

    return requestedUseCases.some((reqUse) => {
      const u = reqUse.toLowerCase().trim();
      if (productUseCases.some((pUse) => pUse.includes(u) || u.includes(pUse))) {
        return true;
      }

      if ((u === 'daily walking' || u === 'walking') && product.category === 'footwear') {
        return productUseCases.some(
          (pUse) =>
            pUse.includes('walking') ||
            pUse.includes('comfort') ||
            pUse.includes('running') ||
            pUse.includes('daily')
        );
      }
      return false;
    });
  }

  /**
   * Checks if product specifications match required attributes (e.g. engine_cc <= 350, RAM >= 16GB)
   */
  public matchesAttributes(
    product: Product,
    attributes: Record<string, string | number>
  ): boolean {
    const specs = product.specifications || {};
    const productFullText = `${product.name} ${product.description} ${JSON.stringify(specs)}`.toLowerCase();

    for (const [key, value] of Object.entries(attributes)) {
      const k = key.toLowerCase();
      const valStr = String(value).toLowerCase();

      // Check engine displacement (e.g. bike under 350cc)
      if (k === 'engine_cc' || k === 'displacement' || k === 'cc') {
        const maxCc = typeof value === 'number' ? value : parseInt(String(value), 10);
        const specDisplacement = specs.engine_cc || specs.displacement || specs.engine;
        let foundCc: number | undefined;
        if (specDisplacement) {
          const matchNum = String(specDisplacement).match(/\d+/);
          if (matchNum) foundCc = parseInt(matchNum[0], 10);
        }
        if (foundCc === undefined) {
          const m = productFullText.match(/(\d+)\s*cc/);
          if (m) foundCc = parseInt(m[1], 10);
        }
        if (foundCc !== undefined && !isNaN(maxCc) && foundCc > maxCc) {
          return false;
        }
        continue;
      }

      // Check RAM (e.g. 16GB RAM)
      if (k === 'ram' || k === 'memory') {
        const ramMatch = String(value).match(/\d+/);
        if (ramMatch) {
          const neededRam = parseInt(ramMatch[0], 10);
          const specRam = specs.ram || specs.memory;
          let foundRam: number | undefined;
          if (specRam) {
            const m = String(specRam).match(/\d+/);
            if (m) foundRam = parseInt(m[0], 10);
          }
          if (foundRam === undefined) {
            const m = productFullText.match(/(\d+)\s*(?:gb|tb)\s*(?:ram)?/);
            if (m) foundRam = parseInt(m[1], 10);
          }
          if (foundRam !== undefined && foundRam < neededRam) {
            return false;
          }
        }
        continue;
      }

      // Check Capacity (e.g. 1 litre, family of 4)
      if (k === 'capacity') {
        // If query specified "family of 4", check if suitable or cookers of 3L-5L
        if (valStr.includes('family')) {
          continue;
        }
        const litMatch = valStr.match(/(\d+(?:\.\d+)?)\s*(?:litres?|liters?|ltrs?|l\b)/i);
        if (litMatch) {
          const num = litMatch[1];
          const hasCap =
            productFullText.includes(`${num}l`) ||
            productFullText.includes(`${num} l`) ||
            productFullText.includes(`${num} litre`) ||
            productFullText.includes(`${num} liter`);
          if (hasCap) continue;
        }
        continue;
      }

      // Check Display Size (e.g. 55 inches)
      if (k === 'display_size' || k === 'screen_size') {
        continue;
      }

      // Generic string matching for other attributes (color, size, etc.)
      if (!productFullText.includes(valStr)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Handles feature synonym matching across electronics, fashion, furniture, kitchen, beauty, etc.
   */
  private featureMatchesText(reqFeature: string, text: string): boolean {
    const f = reqFeature.toLowerCase().trim();

    // Strict Organic Certification Rule: Never match marketing buzzwords ("natural", "green", "herbal", "eco-friendly")
    // or non-certification phrases like "organic pebble shape"
    if (f === 'organic' || f === 'certified organic') {
      if (
        /\b(not\s+organic|non-?organic|no\s+organic\s+certification|not\s+certified\s+organic|unverified\s+organic|organic\s+pebble\s+shape)\b/i.test(
          text
        )
      ) {
        return false;
      }
      return /\b(usda\s+organic|india\s+organic|npop\s+certified|npop\s+organic|ecocert\s+organic|cosmos\s+organic|jaivik\s+bharat|eu\s+organic|soil\s+association\s+organic|gots\s+certified\s+organic|certified\s+organic)\b/i.test(
        text
      );
    }

    if (text.includes(f)) return true;

    if (f === 'comfortable' || f === 'comfort' || f === 'cushioned') {
      return (
        text.includes('comfort') ||
        text.includes('cushion') ||
        text.includes('foam') ||
        text.includes('gel') ||
        text.includes('ergonomic') ||
        text.includes('lightweight')
      );
    }

    // Color & Style synonyms
    if (f === 'black' && (text.includes('jet black') || text.includes('matte black') || text.includes('charcoal') || text.includes('black'))) {
      return true;
    }
    if (f === 'cotton' && (text.includes('100% cotton') || text.includes('combed cotton') || text.includes('cotton blend'))) {
      return true;
    }
    if (f === 'fleece' && (text.includes('brushed fleece') || text.includes('warm fleece'))) {
      return true;
    }

    // Audio & Tech synonyms
    if (f === 'anc' && (text.includes('active noise') || text.includes('noise cancellation'))) {
      return true;
    }
    if ((f === 'active noise cancellation' || f === 'noise cancellation') && text.includes('anc')) {
      return true;
    }
    if (f === 'wireless' && (text.includes('bluetooth') || text.includes('tws'))) {
      return true;
    }
    if (f === 'waterproof' && (text.includes('water resistant') || text.includes('ipx') || text.includes('ip5') || text.includes('ip6'))) {
      return true;
    }
    if (f === 'fast charge' || f === 'fast charging') {
      return text.includes('fast charge') || text.includes('fast charging') || text.includes('supervooc') || text.includes('asap');
    }
    if (f === 'bass' || f === 'extra bass') {
      return text.includes('bass');
    }

    // Safety & Standards (Helmets, Cookware, Skincare)
    if (f === 'isi' && (text.includes('isi') || text.includes('isi certified'))) {
      return true;
    }
    if (f === 'dot' && (text.includes('dot') || text.includes('dot certified'))) {
      return true;
    }
    if (f === 'spf' || f === 'spf 50' || f === 'spf50') {
      return text.includes('spf 50') || text.includes('spf');
    }
    if (f === 'oil free' || f === 'oil-free' || f === 'matte') {
      return text.includes('oil-free') || text.includes('oil free') || text.includes('matte') || text.includes('non-comedogenic');
    }
    if (f === 'ergonomic' && (text.includes('lumbar support') || text.includes('spine support') || text.includes('ergonomic'))) {
      return true;
    }
    if (f === 'induction' && (text.includes('induction compatible') || text.includes('gas and induction') || text.includes('induction base'))) {
      return true;
    }

    return false;
  }
}
