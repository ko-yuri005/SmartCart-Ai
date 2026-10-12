import {
  AccountProfileDTO,
  AdminMarketplaceSummaryDTO,
  AuthResponseDTO,
  CartSummaryDTO,
  ChatHistoryResponse,
  ChatResponseDTO,
  CheckoutInput,
  ComparisonResult,
  CouponDTO,
  CreateReviewInput,
  HealthResponse,
  OrderDTO,
  OrderStatus,
  Product,
  ProductPriceComparisonResult,
  ProductPurchaseLinksSummary,
  ProductRequestDTO,
  ProductRequestStatus,
  ProductReviewDTO,
  ProductReviewSummaryDTO,
  ProductVariantDTO,
  RestockSubscriptionDTO,
  RestockSubscriptionStatus,
  ReviewModerationStatus,
  UserDTO,
  VisualSearchCorrectionInput,
  VisualSearchResponseDTO,
} from '../types/shopping';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const AUTH_TOKEN_KEY = 'luxe_auth_token_v1';
const CSRF_TOKEN_KEY = 'luxe_csrf_token_v1';

export function getAuthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const csrf = localStorage.getItem(CSRF_TOKEN_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (csrf) {
      headers['x-csrf-token'] = csrf;
    }
  } catch {}
  return headers;
}

export function saveAuthCredentials(token: string, csrfToken: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(CSRF_TOKEN_KEY, csrfToken);
  } catch {}
}

export function clearAuthCredentials(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(CSRF_TOKEN_KEY);
  } catch {}
}

/**
 * Sends a user message to the conversational shopping assistant
 */
export async function sendChatMessage(
  message: string,
  sessionId?: string
): Promise<ChatResponseDTO> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message, sessionId }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

/**
 * Retrieves past conversation messages for session recovery
 */
export async function fetchChatHistory(sessionId: string): Promise<ChatHistoryResponse> {
  const res = await fetch(`${BASE_URL}/api/chat/history/${encodeURIComponent(sessionId)}`, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to load chat history: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Clears session context on the backend
 */
export async function resetChatSession(sessionId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/chat/reset`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) {
    throw new Error('Failed to reset chat session');
  }
}

/**
 * Fetches full product catalogue with optional filtering
 */
export async function fetchProducts(params?: {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  onSaleOnly?: boolean;
  inStockOnly?: boolean;
  sortBy?: 'featured' | 'price_asc' | 'price_desc' | 'rating' | 'discount_desc';
  limit?: number;
}): Promise<{ count: number; products: Product[] }> {
  const sp = new URLSearchParams();
  if (params?.category) sp.set('category', params.category);
  if (params?.brand) sp.set('brand', params.brand);
  if (params?.minPrice !== undefined) sp.set('minPrice', String(params.minPrice));
  if (params?.maxPrice !== undefined) sp.set('maxPrice', String(params.maxPrice));
  if (params?.search) sp.set('search', params.search);
  if (params?.onSaleOnly !== undefined) sp.set('onSaleOnly', String(params.onSaleOnly));
  if (params?.inStockOnly !== undefined) sp.set('inStockOnly', String(params.inStockOnly));
  if (params?.sortBy) sp.set('sortBy', params.sortBy);
  sp.set('limit', String(params?.limit ?? 500));

  const query = sp.toString();
  const res = await fetch(`${BASE_URL}/api/products${query ? `?${query}` : ''}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch products (${res.status})`);
  }
  const body = await res.json();
  if (Array.isArray(body)) {
    return { count: body.length, products: body };
  }
  return body;
}

/**
 * Fetches catalogue metadata (categories, brands, total count)
 */
export async function fetchProductsMeta(): Promise<{
  totalProducts: number;
  categories: string[];
  brands: string[];
}> {
  const res = await fetch(`${BASE_URL}/api/products/meta`);
  if (!res.ok) {
    throw new Error(`Failed to load product metadata (${res.status})`);
  }
  return res.json();
}

/**
 * Fetches full specifications and verified details for a single product
 */
export async function fetchProductById(id: string): Promise<Product> {
  const res = await fetch(`${BASE_URL}/api/products/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(`Product not found with ID ${id}`);
  }
  return res.json();
}

/**
 * Fetches cross-website price comparison and retailer offers for a product
 */
export async function fetchProductOffers(id: string): Promise<ProductPriceComparisonResult> {
  const res = await fetch(`${BASE_URL}/api/products/${encodeURIComponent(id)}/offers`);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to load product offers (${res.status})`);
  }
  return res.json();
}

/**
 * Rate-limited live refresh of retailer offers for a product
 */
export async function refreshProductOffers(id: string): Promise<ProductPriceComparisonResult> {
  const res = await fetch(`${BASE_URL}/api/products/${encodeURIComponent(id)}/offers/refresh`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 429 && body) {
      if (body.data && body.data.productId) {
        return body.data as ProductPriceComparisonResult;
      }
      if (body.productId) {
        return body as ProductPriceComparisonResult;
      }
    }
    throw new Error(body.error || `Failed to refresh product offers (${res.status})`);
  }
  return body as ProductPriceComparisonResult;
}

/**
 * Fetches purchase links and fallback retailer search links for a product
 */
export async function fetchProductPurchaseLinks(
  id: string
): Promise<ProductPurchaseLinksSummary> {
  const res = await fetch(`${BASE_URL}/api/products/${encodeURIComponent(id)}/purchase-links`);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to load purchase links (${res.status})`);
  }
  return res.json();
}

/**
 * Generates structured 2-4 product comparison data
 */
export async function compareProductsApi(
  productIds: string[],
  useCases?: string[]
): Promise<ComparisonResult> {
  const res = await fetch(`${BASE_URL}/api/products/compare`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ productIds, useCases }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `Comparison failed with status ${res.status}`);
  }

  return res.json();
}

// ============================================================================
// Authentication & Session API (Phase 2)
// ============================================================================

export async function registerCustomerApi(input: {
  username: string;
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
  guestSessionId?: string;
}): Promise<AuthResponseDTO> {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Registration failed');
  }
  if (body.token && body.csrfToken) {
    saveAuthCredentials(body.token, body.csrfToken);
  }
  return body;
}

export async function loginApi(input: {
  usernameOrEmail: string;
  password: string;
  guestSessionId?: string;
}): Promise<AuthResponseDTO> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Login failed');
  }
  if (body.token && body.csrfToken) {
    saveAuthCredentials(body.token, body.csrfToken);
  }
  return body;
}

export async function logoutApi(): Promise<void> {
  await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
  }).catch(() => {});
  clearAuthCredentials();
}

export async function fetchCurrentUserApi(): Promise<{
  user: UserDTO | null;
  csrfToken: string | null;
}> {
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    return { user: null, csrfToken: null };
  }
  const body = await res.json().catch(() => ({ user: null, csrfToken: null }));
  if (body.csrfToken) {
    try {
      localStorage.setItem(CSRF_TOKEN_KEY, body.csrfToken);
    } catch {}
  }
  return body;
}

export async function changePasswordApi(
  currentPassword: string,
  newPassword: string
): Promise<{ user: UserDTO }> {
  const res = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to change password');
  }
  return body;
}

// ============================================================================
// Cart, Checkout, Order, Coupon & Account API
// ============================================================================

export async function fetchActiveCouponsApi(): Promise<CouponDTO[]> {
  const res = await fetch(`${BASE_URL}/api/coupons`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return [];
  const body = await res.json().catch(() => []);
  return Array.isArray(body) ? body : [];
}

export async function fetchCart(sessionId: string): Promise<CartSummaryDTO> {
  const res = await fetch(`${BASE_URL}/api/cart/${encodeURIComponent(sessionId)}`, {
    headers: getAuthHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to load shopping cart');
  }
  return body;
}

export async function addCartItem(
  sessionId: string,
  productId: string,
  quantity: number = 1,
  options?: {
    variantId?: string | null;
    selectedSize?: string | null;
    selectedColor?: string | null;
  }
): Promise<CartSummaryDTO> {
  const res = await fetch(`${BASE_URL}/api/cart/items`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      sessionId,
      productId,
      quantity,
      variantId: options?.variantId,
      selectedSize: options?.selectedSize,
      selectedColor: options?.selectedColor,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to add item to cart');
  }
  return body;
}

export async function updateCartItemQuantity(
  sessionId: string,
  productId: string,
  quantity: number,
  variantId?: string | null
): Promise<CartSummaryDTO> {
  const res = await fetch(`${BASE_URL}/api/cart/items`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ sessionId, productId, quantity, variantId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to update item quantity');
  }
  return body;
}

export async function removeCartItem(
  sessionId: string,
  productId: string,
  variantId?: string | null
): Promise<CartSummaryDTO> {
  const qs = variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
  const res = await fetch(
    `${BASE_URL}/api/cart/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(productId)}${qs}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to remove item from cart');
  }
  return body;
}

export async function clearCartApi(sessionId: string): Promise<CartSummaryDTO> {
  const res = await fetch(`${BASE_URL}/api/cart/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to clear cart');
  }
  return body;
}

export async function applyCartCoupon(
  sessionId: string,
  couponCode: string | null
): Promise<CartSummaryDTO> {
  const res = await fetch(`${BASE_URL}/api/cart/coupon`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ sessionId, couponCode }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to apply promo code');
  }
  return body;
}

export async function checkoutOrderApi(input: CheckoutInput): Promise<OrderDTO> {
  const res = await fetch(`${BASE_URL}/api/orders/checkout`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Checkout failed');
  }
  return body;
}

export async function fetchOrders(sessionId: string): Promise<OrderDTO[]> {
  const res = await fetch(`${BASE_URL}/api/orders/${encodeURIComponent(sessionId)}`, {
    headers: getAuthHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to load orders');
  }
  return Array.isArray(body) ? body : [];
}

export async function fetchOrderById(
  sessionId: string,
  orderId: string
): Promise<OrderDTO> {
  const res = await fetch(
    `${BASE_URL}/api/orders/${encodeURIComponent(sessionId)}/${encodeURIComponent(orderId)}`,
    { headers: getAuthHeaders() }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Order not found');
  }
  return body;
}

export async function updateOrderStatusApi(
  sessionId: string,
  orderId: string,
  status: OrderStatus,
  note?: string
): Promise<OrderDTO> {
  const res = await fetch(
    `${BASE_URL}/api/orders/${encodeURIComponent(sessionId)}/${encodeURIComponent(orderId)}/status`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, note }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to update order status');
  }
  return body;
}

export async function fetchAccountProfile(sessionId: string): Promise<AccountProfileDTO> {
  const res = await fetch(`${BASE_URL}/api/account/${encodeURIComponent(sessionId)}`, {
    headers: getAuthHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to load account profile');
  }
  return body;
}

export async function updateAccountProfile(
  sessionId: string,
  profile: Partial<{
    fullName: string;
    email: string;
    phone: string;
    defaultAddress: AccountProfileDTO['defaultAddress'];
    preferences: Partial<AccountProfileDTO['preferences']>;
  }>
): Promise<AccountProfileDTO> {
  const res = await fetch(`${BASE_URL}/api/account/${encodeURIComponent(sessionId)}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(profile),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to save account profile');
  }
  return body;
}

// ============================================================================
// Customer Reviews API (Phase 8)
// ============================================================================

export async function fetchProductReviewsApi(
  productId: string,
  sortBy: 'newest' | 'highest' | 'lowest' = 'newest'
): Promise<ProductReviewSummaryDTO> {
  const res = await fetch(
    `${BASE_URL}/api/products/${encodeURIComponent(productId)}/reviews?sortBy=${encodeURIComponent(sortBy)}`,
    { headers: getAuthHeaders() }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to load product reviews');
  }
  return body;
}

export async function submitProductReviewApi(
  productId: string,
  input: Omit<CreateReviewInput, 'productId'>
): Promise<ProductReviewDTO> {
  const res = await fetch(
    `${BASE_URL}/api/products/${encodeURIComponent(productId)}/reviews`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to submit review');
  }
  return body;
}

export async function deleteReviewApi(
  reviewId: string,
  sessionId?: string
): Promise<void> {
  const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
  const res = await fetch(`${BASE_URL}/api/reviews/${encodeURIComponent(reviewId)}${qs}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to delete review');
  }
}

// ============================================================================
// Restock Notifications & Missing Product Requests API (Phase 10)
// ============================================================================

export async function subscribeRestockApi(input: {
  productId: string;
  variantId?: string | null;
  selectedSize?: string | null;
  selectedColor?: string | null;
  sessionId: string;
  email: string;
  consentGiven: boolean;
}): Promise<RestockSubscriptionDTO> {
  const res = await fetch(`${BASE_URL}/api/restock-subscriptions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to subscribe to restock notification');
  }
  return body;
}

export async function fetchRestockSubscriptionsApi(
  sessionId: string
): Promise<RestockSubscriptionDTO[]> {
  const res = await fetch(
    `${BASE_URL}/api/restock-subscriptions?sessionId=${encodeURIComponent(sessionId)}`,
    { headers: getAuthHeaders() }
  );
  const body = await res.json().catch(() => []);
  return Array.isArray(body) ? body : [];
}

export async function cancelRestockSubscriptionApi(
  subscriptionId: string,
  sessionId?: string
): Promise<RestockSubscriptionDTO> {
  const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
  const res = await fetch(
    `${BASE_URL}/api/restock-subscriptions/${encodeURIComponent(subscriptionId)}${qs}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to cancel restock subscription');
  }
  return body;
}

export async function submitProductRequestApi(input: {
  sourceUrl?: string;
  requestedName?: string;
  categoryHint?: string;
  descriptionNotes?: string;
  desiredSize?: string;
  desiredColor?: string;
  desiredVariant?: string;
  sessionId: string;
  contactEmail: string;
  consentGiven: boolean;
}): Promise<ProductRequestDTO> {
  const res = await fetch(`${BASE_URL}/api/product-requests`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to submit product request');
  }
  return body;
}

export async function fetchProductRequestsApi(
  sessionId: string
): Promise<ProductRequestDTO[]> {
  const res = await fetch(
    `${BASE_URL}/api/product-requests?sessionId=${encodeURIComponent(sessionId)}`,
    { headers: getAuthHeaders() }
  );
  const body = await res.json().catch(() => []);
  return Array.isArray(body) ? body : [];
}

export async function closeProductRequestApi(
  requestId: string,
  sessionId?: string
): Promise<ProductRequestDTO> {
  const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
  const res = await fetch(
    `${BASE_URL}/api/product-requests/${encodeURIComponent(requestId)}${qs}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to close product request');
  }
  return body;
}

// ============================================================================
// Admin Management API (Phase 3)
// ============================================================================

export async function fetchAdminSummaryApi(): Promise<AdminMarketplaceSummaryDTO> {
  const res = await fetch(`${BASE_URL}/api/admin/summary`, {
    headers: getAuthHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to load admin summary');
  }
  return body;
}

export async function fetchAdminProductsApi(params?: {
  search?: string;
  category?: string;
}): Promise<Product[]> {
  const sp = new URLSearchParams();
  if (params?.search) sp.set('search', params.search);
  if (params?.category) sp.set('category', params.category);
  const q = sp.toString();
  const res = await fetch(`${BASE_URL}/api/admin/products${q ? `?${q}` : ''}`, {
    headers: getAuthHeaders(),
  });
  const body = await res.json().catch(() => []);
  if (!res.ok) {
    throw new Error(body.error || 'Failed to load admin products');
  }
  return Array.isArray(body) ? body : [];
}

export async function createAdminProductApi(
  product: Partial<Product> & { name: string; brand: string; category: string; price: number }
): Promise<Product> {
  const res = await fetch(`${BASE_URL}/api/admin/products`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(product),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to create product');
  }
  return body;
}

export async function updateAdminProductApi(
  id: string,
  updates: Partial<Product>
): Promise<Product> {
  const res = await fetch(`${BASE_URL}/api/admin/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to update product');
  }
  return body;
}

export async function archiveAdminProductApi(
  id: string,
  isArchived: boolean
): Promise<Product> {
  const res = await fetch(
    `${BASE_URL}/api/admin/products/${encodeURIComponent(id)}/archive`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isArchived }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to update product archive status');
  }
  return body;
}

export async function uploadAdminProductImageApi(
  productId: string,
  input: {
    imageData?: string;
    mimeType?: string;
    url?: string;
    viewType?: string;
    label?: string;
    isPrimary?: boolean;
  }
): Promise<Product> {
  const res = await fetch(
    `${BASE_URL}/api/admin/products/${encodeURIComponent(productId)}/images`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to upload product image');
  }
  return body;
}

export async function upsertAdminVariantApi(
  productId: string,
  variant: Partial<ProductVariantDTO>
): Promise<ProductVariantDTO> {
  const res = await fetch(
    `${BASE_URL}/api/admin/products/${encodeURIComponent(productId)}/variants`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(variant),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to save product variant');
  }
  return body;
}

export async function deleteAdminVariantApi(variantId: string): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/api/admin/variants/${encodeURIComponent(variantId)}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to delete variant');
  }
}

export async function fetchAdminOrdersApi(): Promise<OrderDTO[]> {
  const res = await fetch(`${BASE_URL}/api/admin/orders`, {
    headers: getAuthHeaders(),
  });
  const body = await res.json().catch(() => []);
  if (!res.ok) {
    throw new Error((body as any).error || 'Failed to load admin orders');
  }
  return Array.isArray(body) ? body : [];
}

export async function updateAdminOrderStatusApi(
  orderId: string,
  status: OrderStatus,
  note?: string
): Promise<OrderDTO> {
  const res = await fetch(
    `${BASE_URL}/api/admin/orders/${encodeURIComponent(orderId)}/status`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, note }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to update order status');
  }
  return body;
}

export async function fetchAdminReviewsApi(): Promise<ProductReviewDTO[]> {
  const res = await fetch(`${BASE_URL}/api/admin/reviews`, {
    headers: getAuthHeaders(),
  });
  const body = await res.json().catch(() => []);
  return Array.isArray(body) ? body : [];
}

export async function moderateAdminReviewApi(
  reviewId: string,
  moderationStatus: ReviewModerationStatus,
  moderationNote?: string
): Promise<ProductReviewDTO> {
  const res = await fetch(
    `${BASE_URL}/api/admin/reviews/${encodeURIComponent(reviewId)}/status`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ moderationStatus, moderationNote }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to moderate review');
  }
  return body;
}

export async function fetchAdminProductRequestsApi(): Promise<ProductRequestDTO[]> {
  const res = await fetch(`${BASE_URL}/api/admin/product-requests`, {
    headers: getAuthHeaders(),
  });
  const body = await res.json().catch(() => []);
  return Array.isArray(body) ? body : [];
}

export async function updateAdminProductRequestApi(
  requestId: string,
  updates: {
    status?: ProductRequestStatus;
    linkedProductId?: string | null;
    adminNotes?: string | null;
  }
): Promise<ProductRequestDTO> {
  const res = await fetch(
    `${BASE_URL}/api/admin/product-requests/${encodeURIComponent(requestId)}`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to update product request');
  }
  return body;
}

export async function promoteAdminProductRequestApi(
  requestId: string,
  input: {
    name?: string;
    brand: string;
    category: string;
    price: number;
    originalPrice?: number | null;
    description: string;
    image: string;
    stockCount?: number;
  }
): Promise<{ request: ProductRequestDTO; product: Product }> {
  const res = await fetch(
    `${BASE_URL}/api/admin/product-requests/${encodeURIComponent(requestId)}/promote`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to promote request to catalogue');
  }
  return body;
}

export async function fetchAdminRestockSubscriptionsApi(): Promise<
  RestockSubscriptionDTO[]
> {
  const res = await fetch(`${BASE_URL}/api/admin/restock-subscriptions`, {
    headers: getAuthHeaders(),
  });
  const body = await res.json().catch(() => []);
  return Array.isArray(body) ? body : [];
}

export async function updateAdminRestockSubscriptionApi(
  subscriptionId: string,
  status: RestockSubscriptionStatus
): Promise<RestockSubscriptionDTO> {
  const res = await fetch(
    `${BASE_URL}/api/admin/restock-subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to update restock subscription');
  }
  return body;
}

export async function fetchAdminCouponsApi(): Promise<CouponDTO[]> {
  const res = await fetch(`${BASE_URL}/api/admin/coupons`, {
    headers: getAuthHeaders(),
  });
  const body = await res.json().catch(() => []);
  return Array.isArray(body) ? body : [];
}

export async function upsertAdminCouponApi(
  coupon: Partial<CouponDTO> & { code: string }
): Promise<CouponDTO> {
  const res = await fetch(`${BASE_URL}/api/admin/coupons`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(coupon),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'Failed to save coupon');
  }
  return body;
}

// ============================================================================
// Visual Image Search API
// ============================================================================

export async function visualSearchApi(params: {
  sessionId?: string;
  imageData?: string;
  mimeType?: string;
  fileName?: string;
  userHint?: string;
  correction?: VisualSearchCorrectionInput;
}): Promise<VisualSearchResponseDTO> {
  const res = await fetch(`${BASE_URL}/api/visual-search`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Visual search failed (${res.status})`);
  }
  return body;
}

/**
 * System health check
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE_URL}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return res.json();
}
