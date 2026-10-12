export type ProductImageViewType =
  | 'front'
  | 'back'
  | 'side'
  | 'closeup'
  | 'lifestyle';

export interface ProductImageGalleryItem {
  url: string;
  label: string;
  viewType: ProductImageViewType;
  variantId?: string;
}

export type VariantSizingSystem =
  | 'Alpha'
  | 'UK'
  | 'EU'
  | 'US'
  | 'WaistxLength'
  | 'Helmet'
  | 'Storage'
  | 'Standard';

export interface ProductVariantDTO {
  id: string;
  productId: string;
  sku: string;
  label: string;
  size?: string;
  sizeSystem?: VariantSizingSystem;
  color?: string;
  storageOrModel?: string;
  price: number;
  originalPrice?: number | null;
  stockCount: number;
  availability: boolean;
  image?: string;
  isDefault?: boolean;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  original_price?: number | null;
  discount_percent?: number | null;
  sale_start_at?: string | null;
  sale_end_at?: string | null;
  is_on_sale?: boolean;
  amount_saved?: number;
  currency: string;
  rating: number;
  review_count: number;
  description: string;
  features: string[];
  specifications: Record<string, string | number>;
  use_cases: string[];
  image: string;
  image_gallery?: ProductImageGalleryItem[];
  variants?: ProductVariantDTO[];
  requires_variant_selection?: boolean;
  product_type?: string;
  image_type?: string;
  image_verified?: boolean;
  availability: boolean;
  stock_count?: number;
  is_archived?: boolean;
  purchaseLinks?: ProductPurchaseLinksSummary;
  created_at?: string;
  updated_at?: string;
}

export interface ProductFilters {
  category?: string;
  categories?: string[];
  maxPrice?: number;
  minPrice?: number;
  brand?: string;
  useCases?: string[];
  features?: string[];
  attributes?: Record<string, string | number>;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  includeArchived?: boolean;
  sortBy?: 'featured' | 'price_asc' | 'price_desc' | 'rating' | 'discount_desc';
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

export type ShoppingIntent =
  | 'SEARCH'
  | 'REFINE'
  | 'COMPARE'
  | 'PRODUCT_DETAILS'
  | 'ALTERNATIVES'
  | 'QUESTION_ON_PREVIOUS'
  | 'ADD_TO_CART'
  | 'RESTOCK_NOTIFY'
  | 'PRODUCT_REQUEST'
  | 'CONFIDENTIALITY_PROBE'
  | 'CASUAL';

export type StructuredIntentType =
  | 'PRODUCT_SEARCH'
  | 'PRODUCT_COMPARISON'
  | 'FOLLOW_UP_REFERENCE'
  | 'PRODUCT_PRICE_LOOKUP'
  | 'VISUAL_PRODUCT_SEARCH'
  | 'ADD_TO_CART'
  | 'PRODUCT_DETAILS'
  | 'MISSING_PRODUCT_REQUEST'
  | 'GENERAL_SHOPPING_QUESTION';

export interface ExtractedRequirements {
  intent: ShoppingIntent;
  structured_intent?: StructuredIntentType;
  category?: string;
  categories?: string[];
  max_price?: number;
  min_price?: number;
  currency?: string;
  brand?: string;
  features?: string[];
  use_cases?: string[];
  attributes?: Record<string, string | number>;
  referenced_product_ids?: string[]; // e.g. target IDs from past recommendations
  referenced_index?: number;         // e.g. 1 for "first one", 2 for "second one"
  referenced_indices?: number[];     // e.g. [1, 2] for "first two"
  comparison_queries?: string[];     // e.g. ["Royal Enfield Hunter 350", "Triumph Speed 400"]
  explicit_product_query?: string;   // e.g. "Royal Enfield Hunter 350"
  requested_product_type?: string;   // e.g. "headphones", "earbuds", "neckband", "motorcycle"
  requested_subtype?: string;        // e.g. "laptop-cooling-pad", "phone-case", "camera-tripod", "helmet-visor"
  excluded_product_types?: string[]; // e.g. ["laptop"] when a laptop accessory is requested
  sort_preference?: 'price_asc' | 'price_desc' | 'rating' | 'relevance';
  quantity_requested?: number;       // e.g. 1 or 2 when adding to cart via chat
  selected_size?: string;
  selected_color?: string;
  selected_variant_id?: string;
  query_summary?: string;
}


export interface ProductScoringWeights {
  useCaseMatchWeight: number; // Intent/use-case must have higher weight
  featureMatchWeight: number;
  ratingWeight: number;
  reviewVolumeWeight: number;
  budgetFitWeight: number;
}

export interface ScoredProduct {
  product: Product;
  score: number;
  scoreBreakdown: {
    useCaseScore: number;
    featureScore: number;
    ratingScore: number;
    reviewScore: number;
    budgetScore: number;
  };
  matchedUseCases: string[];
  matchedFeatures: string[];
  budgetFit?: {
    withinBudget: boolean;
    diffFromMax?: number;
    percentageOfMax?: number;
  };
  rankingReasons?: string[];
  matchExplanation?: string;
  isRelatedAlternative?: boolean;
  alternativeSectionLabel?: string;
}

export interface Session {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  recommended_product_ids?: string[];
  extracted_requirements?: ExtractedRequirements;
  created_at: string;
}

export interface ChatRequestDTO {
  message: string;
  sessionId?: string;
}

export interface TokenUsageTelemetry {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  usageSource: 'actual_provider' | 'none';
  estimatedCostUsd: number;
  costIsEstimate: true;
}

export interface BudgetStatusTelemetry {
  dailyRequestsUsed: number;
  dailyRequestBudget: number;
  dailyTokensUsed: number;
  dailyTokenBudget: number;
  budgetExhausted: boolean;
}

export interface RequestDiagnostics {
  correlationId: string;
  detectedIntent: ShoppingIntent;
  structuredIntent?: StructuredIntentType;
  extractionSource: 'gemini' | 'fallback';
  explanationSource: 'gemini' | 'fallback';
  model?: string;
  durationMs: number;
  stageDurationsMs?: {
    extractionMs: number;
    filteringMs: number;
    rankingMs: number;
    explanationMs: number;
  };
  productsConsidered: number;
  productsSelected: number;
  isCached: boolean;
  throttled?: boolean;
  duplicateSubmitBlocked?: boolean;
  quotaExhausted?: boolean;
  budgetExhausted?: boolean;
  tokenUsage?: TokenUsageTelemetry;
  budgetStatus?: BudgetStatusTelemetry;
  fallbackReason?: string;
}

export type OfferVerificationStatus =
  | 'live_verified'
  | 'cached_verified'
  | 'stale_cached'
  | 'unverified_search'
  | 'unavailable';

export type OfferMatchType =
  | 'exact'
  | 'similar_alternative'
  | 'variant_mismatch';

export type OfferLinkType = 'direct_listing' | 'search_link';

export type OfferAvailabilityStatus =
  | 'in_stock'
  | 'out_of_stock'
  | 'limited'
  | 'unknown';

export interface RetailerOffer {
  id: string;
  productId: string;
  retailerId: string;
  retailerName: string;
  externalListingId?: string | null;
  listingTitle: string;
  listingUrl: string | null;
  searchUrl: string;
  linkType: OfferLinkType;
  matchType: OfferMatchType;
  matchConfidence: number;
  matchedVariantSummary?: string;
  price: number | null;
  originalPrice?: number | null;
  discountPercent?: number | null;
  currency: string;
  shippingCost: number | null;
  shippingKnown: boolean;
  totalPrice: number | null;
  totalIsIncomplete: boolean;
  availability: OfferAvailabilityStatus;
  verificationStatus: OfferVerificationStatus;
  sourceProvider: string;
  lastCheckedAt: string | null;
  expiresAt?: string | null;
  statusMessage?: string;
  affiliateDisclosure?: string;
}

export interface ProductPurchaseLinksSummary {
  productId: string;
  primaryLink: {
    retailerId: string;
    retailerName: string;
    title: string;
    url: string;
    linkType: OfferLinkType;
    actionLabel: 'Buy now' | 'View product' | 'Search this product';
    verificationStatus: OfferVerificationStatus;
    price?: number | null;
    shippingCost?: number | null;
    shippingKnown?: boolean;
    totalPrice?: number | null;
    totalIsIncomplete?: boolean;
  };
  hasVerifiedDirectListing: boolean;
  lowestVerifiedOffer?: RetailerOffer | null;
  retailerSearchLinks: {
    retailerId: string;
    retailerName: string;
    searchUrl: string;
    categoryFit: string;
  }[];
}

export interface ProductPriceComparisonResult {
  productId: string;
  productName: string;
  brand: string;
  category: string;
  cataloguePrice: number;
  currency: string;
  lowestVerifiedOffer: RetailerOffer | null;
  comparableOffersCount: number;
  hasComparableVerifiedPrices: boolean;
  offers: RetailerOffer[];
  similarAlternativeOffers: RetailerOffer[];
  purchaseLinks: ProductPurchaseLinksSummary;
  providerStatus: {
    liveProviderConfigured: boolean;
    configuredProviders: string[];
    activeProvider: string;
    rateLimited?: boolean;
    cooldownRemainingMs?: number;
    providerError?: string;
    honestStatusMessage: string;
  };
  affiliateDisclosure: string;
  lastUpdatedAt: string;
}

// ==========================================
// Phase 2 & 6 & 7: Shopping Cart, Checkout & Orders
// ==========================================

export interface CartItemDTO {
  id: string;
  cartId: string;
  productId: string;
  variantId?: string | null;
  variantLabel?: string | null;
  selectedSize?: string | null;
  selectedColor?: string | null;
  product: Product;
  quantity: number;
  unitPrice: number;
  originalUnitPrice?: number | null;
  itemDiscountAmount?: number;
  lineTotal: number;
  maxAvailableStock: number;
  addedAt: string;
  updatedAt: string;
}

export interface CartPricingBreakdown {
  mrpTotal?: number;
  subtotal: number;
  itemDiscountAmount?: number;
  discountAmount: number;
  couponDiscountAmount?: number;
  discountDescription?: string;
  couponCode?: string | null;
  shippingCost: number;
  freeShippingThreshold: number;
  amountNeededForFreeShipping: number;
  taxIncludedEstimate: number;
  finalTotal: number;
  currency: string;
}

export interface CartSummaryDTO {
  cartId: string;
  sessionId: string;
  userId?: string | null;
  items: CartItemDTO[];
  totalQuantity: number;
  uniqueItemCount: number;
  pricing: CartPricingBreakdown;
  updatedAt: string;
}

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;
  note: string;
}

export interface OrderItemDTO {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string | null;
  variantLabel?: string | null;
  selectedSize?: string | null;
  selectedColor?: string | null;
  productName: string;
  brand: string;
  category: string;
  image: string;
  unitPrice: number;
  originalUnitPrice?: number | null;
  itemDiscountAmount?: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderDTO {
  id: string;
  sessionId: string;
  userId?: string | null;
  idempotencyKey?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  isDemoCheckout: true;
  demoDisclaimer: string;
  items: OrderItemDTO[];
  totalQuantity: number;
  pricing: {
    subtotal: number;
    itemDiscountAmount?: number;
    discountAmount: number;
    couponDiscountAmount?: number;
    couponCode?: string | null;
    shippingCost: number;
    taxIncludedEstimate: number;
    finalTotal: number;
    currency: string;
  };
  status: OrderStatus;
  statusHistory: OrderStatusHistoryEntry[];
  stockRestored?: boolean;
  notes?: string | null;
  duplicatePrevented?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutInput {
  sessionId: string;
  userId?: string | null;
  idempotencyKey?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: ShippingAddress;
  paymentMethod?: string;
  couponCode?: string;
  notes?: string;
}

export interface AccountProfileDTO {
  sessionId: string;
  userId?: string | null;
  fullName: string;
  email: string;
  phone: string;
  defaultAddress: ShippingAddress | null;
  preferences: {
    preferredCategories: string[];
    budgetCeiling?: number;
    priorityPreference: 'budget' | 'quality_performance' | 'sustainability_certifications' | 'everyday_convenience';
  };
  updatedAt: string;
}

// ==========================================
// Phase 2 (Auth): Users, Roles & Sessions
// ==========================================

export type UserRole = 'customer' | 'admin';

export interface UserDTO {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  fullName: string;
  phone: string;
  defaultAddress: ShippingAddress | null;
  preferences: AccountProfileDTO['preferences'];
  mustChangePassword: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponseDTO {
  user: UserDTO;
  token: string;
  csrfToken: string;
  expiresAt: string;
  mergedCart?: CartSummaryDTO;
}

// ==========================================
// Phase 8: Customer Reviews & Ratings
// ==========================================

export type ReviewModerationStatus =
  | 'published'
  | 'pending'
  | 'rejected'
  | 'flagged';

export interface CategoryReviewAttributes {
  // Clothing / Jerseys
  fit?: 'Runs Small' | 'True to Size' | 'Runs Large';
  fabricQuality?: string;
  comfort?: string;
  // Footwear
  sizingAccuracy?: 'Runs Narrow/Small' | 'True to Size' | 'Runs Wide/Large';
  intendedUse?: string;
  // Electronics
  performance?: string;
  batteryLife?: string;
  buildQuality?: string;
  // Food / Personal Care
  freshnessOrTexture?: string;
  valueForMoney?: string;
}

export interface ProductReviewDTO {
  id: string;
  productId: string;
  userId?: string | null;
  sessionId: string;
  authorName: string;
  rating: number;
  title: string;
  comment: string;
  photos: string[];
  categoryAttributes: CategoryReviewAttributes;
  isVerifiedPurchase: boolean;
  moderationStatus: ReviewModerationStatus;
  moderationNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductReviewSummaryDTO {
  productId: string;
  averageRating: number;
  totalPublishedCount: number;
  verifiedPurchaseCount: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  reviews: ProductReviewDTO[];
}

export interface CreateReviewInput {
  productId: string;
  userId?: string | null;
  sessionId: string;
  authorName?: string;
  rating: number;
  title?: string;
  comment: string;
  photos?: string[];
  categoryAttributes?: CategoryReviewAttributes;
}

// ==========================================
// Phase 9: Discounts & Coupons
// ==========================================

export type CouponDiscountType = 'percentage' | 'fixed' | 'free_shipping';

export interface CouponDTO {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  eligibleCategories: string[];
  eligibleProductIds: string[];
  maxTotalUses?: number | null;
  maxUsesPerUser?: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Phase 10: Restock Notifications & Missing Product Requests
// ==========================================

export type RestockSubscriptionStatus =
  | 'Subscribed'
  | 'EligibleForNotification'
  | 'Notified'
  | 'Cancelled';

export interface RestockSubscriptionDTO {
  id: string;
  productId: string;
  productName?: string;
  variantId?: string | null;
  variantLabel?: string | null;
  selectedSize?: string | null;
  selectedColor?: string | null;
  userId?: string | null;
  sessionId: string;
  email: string;
  consentGiven: boolean;
  status: RestockSubscriptionStatus;
  notificationProviderConfigured: boolean;
  statusMessage: string;
  notifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProductRequestStatus =
  | 'Requested'
  | 'Under Review'
  | 'Available'
  | 'Unavailable'
  | 'Closed';

export interface ProductRequestDTO {
  id: string;
  sourceUrl: string;
  normalizedUrl: string;
  requestedName?: string | null;
  categoryHint?: string | null;
  descriptionNotes?: string | null;
  desiredSize?: string | null;
  desiredColor?: string | null;
  desiredVariant?: string | null;
  userId?: string | null;
  sessionId: string;
  contactEmail: string;
  consentGiven: boolean;
  status: ProductRequestStatus;
  linkedProductId?: string | null;
  adminNotes?: string | null;
  confirmationMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMarketplaceSummaryDTO {
  totalProducts: number;
  activeProducts: number;
  archivedProducts: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  onSaleProducts: number;
  totalVariants?: number;
  totalOrders: number;
  totalRevenue: number;
  totalOrderRevenue?: number;
  ordersByStatus?: Record<OrderStatus, number>;
  totalReviews: number;
  pendingModerationReviews?: number;
  pendingProductRequests: number;
  openProductRequests?: number;
  activeRestockSubscriptions: number;
  eligibleRestockNotifications?: number;
  totalRegisteredCustomers: number;
  activeCoupons: number;
  recentOrders: OrderDTO[];
  lowStockItems: Product[];
}

// ==========================================
// Phase 3 & 12: AI Image-Based Product Discovery & Chat
// ==========================================

export type VisualMatchClassification =
  | 'confirmed_exact_match'
  | 'likely_match'
  | 'relevant_alternative'
  | 'no_match';

export type ImageQualityAssessment =
  | 'clear'
  | 'blurry'
  | 'multiple_products'
  | 'unrecognizable';

export interface VisualSearchClues {
  brand?: string;
  model?: string;
  productType?: string;
  category?: string;
  color?: string;
  packagingText: string[];
  visualAttributes: string[];
  keywords: string[];
  confidence: number;
  imageQuality: ImageQualityAssessment;
  detectedProductCount: number;
  qualityWarning?: string;
  additionalDetectedItems?: string[];
  extractionSource: 'gemini_vision' | 'deterministic_fallback';
}

export interface VisualMatchedProduct {
  product: Product;
  matchClassification: Exclude<VisualMatchClassification, 'no_match'>;
  matchScore: number;
  matchReasons: string[];
}

export interface VisualSearchCorrectionInput {
  brand?: string;
  model?: string;
  category?: string;
  keywords?: string;
}

export interface VisualSearchResponseDTO {
  sessionId: string;
  clues: VisualSearchClues;
  appliedCorrection?: VisualSearchCorrectionInput;
  overallClassification: VisualMatchClassification;
  classificationSummary: string;
  matches: VisualMatchedProduct[];
  products: Product[];
  suggestions: string[];
}

export interface ChatCartActionResult {
  action: 'added' | 'clarification_needed' | 'variant_selection_required' | 'failed';
  product?: Product;
  variant?: ProductVariantDTO;
  quantity?: number;
  cart?: CartSummaryDTO;
  message: string;
}

export interface ChatResponseDTO {
  sessionId: string;
  message: string;
  products: Product[];
  scoredProducts?: ScoredProduct[];
  targetProduct?: Product;
  comparison?: any;
  alternatives?: any;
  priceComparison?: ProductPriceComparisonResult;
  priceComparisons?: ProductPriceComparisonResult[];
  cartAction?: ChatCartActionResult;
  cart?: CartSummaryDTO;
  offerProductRequestForm?: {
    suggestedName?: string;
    suggestedCategory?: string;
    reason: string;
  };
  offerRestockNotification?: {
    productId: string;
    productName: string;
    variantId?: string;
    variantLabel?: string;
  };
  activeRequirements?: Partial<ExtractedRequirements>;
  intent: ShoppingIntent;
  isRelaxedMatch?: boolean;
  relaxedExplanation?: string;
  suggestions?: string[];
  diagnostics?: RequestDiagnostics;
}




