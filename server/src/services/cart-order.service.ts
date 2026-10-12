import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { getDatabase, initMarketplaceTables } from '../db/database.js';
import { IProductRepository } from '../db/repositories/product.repository.js';
import {
  AccountProfileDTO,
  CartItemDTO,
  CartPricingBreakdown,
  CartSummaryDTO,
  CheckoutInput,
  CouponDTO,
  OrderDTO,
  OrderItemDTO,
  OrderStatus,
  OrderStatusHistoryEntry,
  Product,
  ProductVariantDTO,
  ShippingAddress,
  UserDTO,
} from '../types/index.js';
import { PriceComparisonService } from './price-comparison.service.js';

export class CartValidationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, code = 'VALIDATION_ERROR', statusCode = 400) {
    super(message);
    this.name = 'CartValidationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

interface RawCartRow {
  id: string;
  session_id: string;
  user_id?: string | null;
  coupon_code: string | null;
  created_at: string;
  updated_at: string;
}

interface RawCartItemRow {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id?: string;
  variant_label?: string | null;
  selected_size?: string | null;
  selected_color?: string | null;
  quantity: number;
  added_at: string;
  updated_at: string;
}

interface RawOrderRow {
  id: string;
  session_id: string;
  user_id?: string | null;
  idempotency_key: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  payment_method: string;
  is_demo_checkout: number;
  demo_disclaimer: string;
  subtotal: number;
  item_discount_amount?: number;
  discount_amount: number;
  coupon_discount_amount?: number;
  coupon_code: string | null;
  shipping_cost: number;
  tax_amount: number;
  final_total: number;
  currency: string;
  status: OrderStatus;
  status_history: string;
  stock_restored?: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface RawOrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  variant_id?: string | null;
  variant_label?: string | null;
  selected_size?: string | null;
  selected_color?: string | null;
  product_name: string;
  brand: string;
  category: string;
  image: string;
  unit_price: number;
  original_unit_price?: number | null;
  item_discount_amount?: number;
  quantity: number;
  line_total: number;
}

interface RawAccountRow {
  session_id: string;
  user_id?: string | null;
  full_name: string;
  email: string;
  phone: string;
  default_address: string | null;
  preferences: string;
  updated_at: string;
}

interface RawCouponRow {
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed' | 'free_shipping';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  start_at: string | null;
  end_at: string | null;
  eligible_categories: string;
  eligible_product_ids: string;
  max_total_uses: number | null;
  max_uses_per_user: number | null;
  used_count: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export const DEMO_CHECKOUT_DISCLAIMER =
  'DEMO CHECKOUT ONLY — No real payment was processed and no real financial charge was made.';

export const FREE_SHIPPING_THRESHOLD = 999;
export const STANDARD_SHIPPING_FEE = 99;

export interface AddCartItemOptions {
  variantId?: string | null;
  selectedSize?: string | null;
  selectedColor?: string | null;
  requireExplicitVariant?: boolean;
  userId?: string | null;
}

export class CartOrderService {
  private db: Database.Database;
  private recentOrderFingerprints = new Map<
    string,
    { fingerprint: string; orderId: string; timestamp: number }
  >();

  constructor(
    private productRepo: IProductRepository,
    db?: Database.Database,
    private priceComparisonService?: PriceComparisonService
  ) {
    this.db = db || getDatabase();
    initMarketplaceTables(this.db);
  }

  private validateSessionId(sessionId: string | undefined): string {
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      throw new CartValidationError('A valid sessionId is required', 'INVALID_SESSION', 400);
    }
    const clean = sessionId.trim().slice(0, 100);
    if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
      throw new CartValidationError('Invalid sessionId format', 'INVALID_SESSION', 400);
    }
    return clean;
  }

  private getOrCreateCartRow(sessionId: string, userId?: string | null): RawCartRow {
    const cleanSessionId = this.validateSessionId(sessionId);
    const existing = this.db
      .prepare('SELECT * FROM carts WHERE session_id = ?')
      .get(cleanSessionId) as RawCartRow | undefined;

    if (existing) {
      if (userId && !existing.user_id) {
        this.db
          .prepare('UPDATE carts SET user_id = ? WHERE id = ?')
          .run(userId, existing.id);
        existing.user_id = userId;
      }
      return existing;
    }

    const cartId = `cart_${cleanSessionId}`;
    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO carts (id, session_id, user_id, coupon_code, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)'
      )
      .run(cartId, cleanSessionId, userId || null, now, now);

    return {
      id: cartId,
      session_id: cleanSessionId,
      user_id: userId || null,
      coupon_code: null,
      created_at: now,
      updated_at: now,
    };
  }

  public getCouponByCode(code: string): CouponDTO | null {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) return null;
    const row = this.db
      .prepare('SELECT * FROM coupons WHERE UPPER(code) = ?')
      .get(normalized) as RawCouponRow | undefined;
    if (!row) return null;
    return this.mapRowToCouponDTO(row);
  }

  public listCoupons(includeInactive = false): CouponDTO[] {
    const sql = includeInactive
      ? 'SELECT * FROM coupons ORDER BY created_at DESC'
      : 'SELECT * FROM coupons WHERE is_active = 1 ORDER BY created_at DESC';
    const rows = this.db.prepare(sql).all() as RawCouponRow[];
    return rows.map((r) => this.mapRowToCouponDTO(r));
  }

  public upsertCoupon(input: Partial<CouponDTO> & { code: string }): CouponDTO {
    const code = (input.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,25}$/.test(code)) {
      throw new CartValidationError(
        'Coupon code must be 3–25 uppercase letters, numbers, hyphens, or underscores.',
        'INVALID_COUPON_FORMAT',
        400
      );
    }

    const existing = this.getCouponByCode(code);
    const nowIso = new Date().toISOString();
    const discountType = input.discountType || existing?.discountType || 'percentage';
    const discountValue =
      input.discountValue !== undefined
        ? Number(input.discountValue)
        : existing?.discountValue ?? 10;
    const minOrderAmount =
      input.minOrderAmount !== undefined
        ? Number(input.minOrderAmount)
        : existing?.minOrderAmount ?? 0;
    const maxDiscountAmount =
      input.maxDiscountAmount !== undefined
        ? input.maxDiscountAmount
        : existing?.maxDiscountAmount ?? null;
    const description =
      (input.description || existing?.description || `${code} discount`).trim();

    this.db
      .prepare(
        `INSERT INTO coupons (
          code, description, discount_type, discount_value, min_order_amount,
          max_discount_amount, start_at, end_at, eligible_categories, eligible_product_ids,
          max_total_uses, max_uses_per_user, used_count, is_active, created_at, updated_at
        ) VALUES (
          @code, @description, @discountType, @discountValue, @minOrderAmount,
          @maxDiscountAmount, @startAt, @endAt, @eligibleCategories, @eligibleProductIds,
          @maxTotalUses, @maxUsesPerUser, @usedCount, @isActive, @createdAt, @updatedAt
        ) ON CONFLICT(code) DO UPDATE SET
          description = excluded.description,
          discount_type = excluded.discount_type,
          discount_value = excluded.discount_value,
          min_order_amount = excluded.min_order_amount,
          max_discount_amount = excluded.max_discount_amount,
          start_at = excluded.start_at,
          end_at = excluded.end_at,
          eligible_categories = excluded.eligible_categories,
          eligible_product_ids = excluded.eligible_product_ids,
          max_total_uses = excluded.max_total_uses,
          max_uses_per_user = excluded.max_uses_per_user,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at`
      )
      .run({
        code,
        description,
        discountType,
        discountValue,
        minOrderAmount,
        maxDiscountAmount,
        startAt:
          input.startAt !== undefined ? input.startAt : existing?.startAt ?? null,
        endAt: input.endAt !== undefined ? input.endAt : existing?.endAt ?? null,
        eligibleCategories: JSON.stringify(
          input.eligibleCategories ?? existing?.eligibleCategories ?? []
        ),
        eligibleProductIds: JSON.stringify(
          input.eligibleProductIds ?? existing?.eligibleProductIds ?? []
        ),
        maxTotalUses:
          input.maxTotalUses !== undefined
            ? input.maxTotalUses
            : existing?.maxTotalUses ?? null,
        maxUsesPerUser:
          input.maxUsesPerUser !== undefined
            ? input.maxUsesPerUser
            : existing?.maxUsesPerUser ?? null,
        usedCount: existing?.usedCount ?? 0,
        isActive: (input.isActive ?? existing?.isActive ?? true) ? 1 : 0,
        createdAt: existing?.createdAt ?? nowIso,
        updatedAt: nowIso,
      });

    return this.getCouponByCode(code)!;
  }

  private mapRowToCouponDTO(row: RawCouponRow): CouponDTO {
    let eligibleCategories: string[] = [];
    try {
      eligibleCategories = JSON.parse(row.eligible_categories || '[]');
    } catch {}
    let eligibleProductIds: string[] = [];
    try {
      eligibleProductIds = JSON.parse(row.eligible_product_ids || '[]');
    } catch {}

    return {
      code: row.code,
      description: row.description,
      discountType: row.discount_type,
      discountValue: row.discount_value,
      minOrderAmount: row.min_order_amount,
      maxDiscountAmount: row.max_discount_amount,
      startAt: row.start_at,
      endAt: row.end_at,
      eligibleCategories,
      eligibleProductIds,
      maxTotalUses: row.max_total_uses,
      maxUsesPerUser: row.max_uses_per_user,
      usedCount: row.used_count,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Validates whether a coupon is active, within its date window, and within usage limits.
   * When throwOnInvalid = true, throws a CartValidationError with a specific error code.
   */
  public validateCouponEligibility(
    couponCode: string,
    context?: {
      sessionId?: string;
      userId?: string | null;
      subtotal?: number;
      items?: { productId: string; category?: string; unitPrice: number; quantity: number }[];
      strictSubtotalAndEligibilityCheck?: boolean;
    }
  ): CouponDTO {
    const normalized = (couponCode || '').trim().toUpperCase();
    const coupon = this.getCouponByCode(normalized);

    if (!coupon) {
      throw new CartValidationError(
        `Invalid coupon code '${normalized}'. Supported coupons include WELCOME10, SAVE500, FREESHIP, APPAREL15.`,
        'INVALID_COUPON',
        400
      );
    }

    if (!coupon.isActive) {
      throw new CartValidationError(
        `Coupon '${normalized}' is currently inactive.`,
        'COUPON_INACTIVE',
        400
      );
    }

    const nowMs = Date.now();
    if (coupon.startAt) {
      const startMs = Date.parse(coupon.startAt);
      if (!Number.isNaN(startMs) && nowMs < startMs) {
        throw new CartValidationError(
          `Coupon '${normalized}' is not yet active.`,
          'COUPON_NOT_STARTED',
          400
        );
      }
    }

    if (coupon.endAt) {
      const endMs = Date.parse(coupon.endAt);
      if (!Number.isNaN(endMs) && nowMs > endMs) {
        throw new CartValidationError(
          `Coupon '${normalized}' has expired.`,
          'COUPON_EXPIRED',
          400
        );
      }
    }

    if (
      typeof coupon.maxTotalUses === 'number' &&
      coupon.usedCount >= coupon.maxTotalUses
    ) {
      throw new CartValidationError(
        `Coupon '${normalized}' has reached its maximum usage limit.`,
        'COUPON_USAGE_LIMIT_REACHED',
        400
      );
    }

    if (
      typeof coupon.maxUsesPerUser === 'number' &&
      (context?.userId || context?.sessionId)
    ) {
      let userUses = 0;
      if (context.userId) {
        const res = this.db
          .prepare(
            'SELECT COUNT(*) as c FROM coupon_usages WHERE coupon_code = ? AND (user_id = ? OR session_id = ?)'
          )
          .get(normalized, context.userId, context.sessionId || '') as { c: number };
        userUses = res.c;
      } else if (context.sessionId) {
        const res = this.db
          .prepare(
            'SELECT COUNT(*) as c FROM coupon_usages WHERE coupon_code = ? AND session_id = ?'
          )
          .get(normalized, context.sessionId) as { c: number };
        userUses = res.c;
      }

      if (userUses >= coupon.maxUsesPerUser) {
        throw new CartValidationError(
          `You have already used coupon '${normalized}' the maximum allowed number of times (${coupon.maxUsesPerUser}).`,
          'COUPON_USER_LIMIT_REACHED',
          400
        );
      }
    }

    if (context?.strictSubtotalAndEligibilityCheck) {
      if (
        typeof context.subtotal === 'number' &&
        context.subtotal < coupon.minOrderAmount
      ) {
        throw new CartValidationError(
          `Coupon '${normalized}' requires a minimum order subtotal of ₹${coupon.minOrderAmount.toLocaleString('en-IN')}.`,
          'COUPON_MIN_ORDER_NOT_MET',
          400
        );
      }

      if (
        context.items &&
        context.items.length > 0 &&
        (coupon.eligibleCategories.length > 0 || coupon.eligibleProductIds.length > 0)
      ) {
        const hasEligible = context.items.some((item) => {
          const prodMatch =
            coupon.eligibleProductIds.length === 0 ||
            coupon.eligibleProductIds.includes(item.productId);
          const catMatch =
            coupon.eligibleCategories.length === 0 ||
            coupon.eligibleCategories.some(
              (c) =>
                item.category &&
                (item.category.toLowerCase().includes(c.toLowerCase()) ||
                  c.toLowerCase().includes(item.category.toLowerCase()))
            );
          return prodMatch && catMatch;
        });

        if (!hasEligible) {
          throw new CartValidationError(
            `Coupon '${normalized}' is only eligible for: ${[
              ...coupon.eligibleCategories,
              ...coupon.eligibleProductIds,
            ].join(', ')}.`,
            'COUPON_NOT_ELIGIBLE',
            400
          );
        }
      }
    }

    return coupon;
  }

  /**
   * Computes subtotal, item-level savings, coupon/bundle discount, shipping, and final total
   * strictly on the backend using verified server-side product prices.
   */
  public calculatePricing(
    items: {
      productId?: string;
      category?: string;
      unitPrice: number;
      originalUnitPrice?: number | null;
      quantity: number;
    }[],
    couponCode?: string | null,
    sessionContext?: { sessionId?: string; userId?: string | null }
  ): CartPricingBreakdown {
    const rawSubtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    const subtotal = Math.round(rawSubtotal * 100) / 100;
    const rawMrpTotal = items.reduce((sum, item) => {
      const mrp =
        typeof item.originalUnitPrice === 'number' &&
        item.originalUnitPrice > item.unitPrice
          ? item.originalUnitPrice
          : item.unitPrice;
      return sum + mrp * item.quantity;
    }, 0);
    const mrpTotal = Math.round(rawMrpTotal * 100) / 100;
    const itemDiscountAmount = Math.max(0, Math.round((mrpTotal - subtotal) * 100) / 100);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    if (subtotal <= 0 || totalQuantity <= 0) {
      return {
        mrpTotal: 0,
        subtotal: 0,
        itemDiscountAmount: 0,
        discountAmount: 0,
        couponDiscountAmount: 0,
        couponCode: couponCode || null,
        shippingCost: 0,
        freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
        amountNeededForFreeShipping: FREE_SHIPPING_THRESHOLD,
        taxIncludedEstimate: 0,
        finalTotal: 0,
        currency: 'INR',
      };
    }

    let discountAmount = 0;
    let couponDiscountAmount = 0;
    let discountDescription: string | undefined;
    let freeShippingFromCoupon = false;
    const normalizedCoupon = couponCode ? couponCode.trim().toUpperCase() : null;

    if (normalizedCoupon) {
      try {
        const coupon = this.validateCouponEligibility(normalizedCoupon, {
          sessionId: sessionContext?.sessionId,
          userId: sessionContext?.userId,
        });

        // Compute eligible subtotal for category/product-restricted coupons
        const eligibleSubtotal = items.reduce((sum, item) => {
          const prodMatch =
            coupon.eligibleProductIds.length === 0 ||
            (item.productId && coupon.eligibleProductIds.includes(item.productId));
          const catMatch =
            coupon.eligibleCategories.length === 0 ||
            (item.category &&
              coupon.eligibleCategories.some(
                (c) =>
                  item.category!.toLowerCase().includes(c.toLowerCase()) ||
                  c.toLowerCase().includes(item.category!.toLowerCase()) ||
                  (c.toLowerCase().includes('clothing') &&
                    item.category!.toLowerCase().includes('fashion'))
              ));
          if (prodMatch && catMatch) {
            return sum + item.unitPrice * item.quantity;
          }
          return sum;
        }, 0);

        if (subtotal < coupon.minOrderAmount) {
          discountDescription = `${coupon.code} requires minimum order of ₹${coupon.minOrderAmount.toLocaleString('en-IN')}`;
        } else if (eligibleSubtotal <= 0 && coupon.discountType !== 'free_shipping') {
          discountDescription = `${coupon.code} applies only to eligible categories (${coupon.eligibleCategories.join(', ')})`;
        } else if (coupon.discountType === 'free_shipping') {
          freeShippingFromCoupon = true;
          discountDescription = coupon.description;
        } else if (coupon.discountType === 'percentage') {
          const rawDisc = Math.round((eligibleSubtotal * coupon.discountValue) / 100);
          discountAmount =
            typeof coupon.maxDiscountAmount === 'number'
              ? Math.min(coupon.maxDiscountAmount, rawDisc)
              : rawDisc;
          couponDiscountAmount = discountAmount;
          discountDescription = coupon.description;
        } else if (coupon.discountType === 'fixed') {
          discountAmount = Math.min(eligibleSubtotal, coupon.discountValue);
          couponDiscountAmount = discountAmount;
          discountDescription = coupon.description;
        }
      } catch (err: any) {
        discountDescription = err?.message || `Coupon ${normalizedCoupon} not applicable`;
      }
    } else if (totalQuantity >= 2 && subtotal >= 3000) {
      // Automatic multi-item bundle savings (5% off up to ₹2,000)
      discountAmount = Math.min(2000, Math.round(subtotal * 0.05));
      discountDescription = 'Multi-item bundle savings (5% off 2+ items)';
    }

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const qualifiesForFreeShipping =
      freeShippingFromCoupon || discountedSubtotal >= FREE_SHIPPING_THRESHOLD;

    const shippingCost = qualifiesForFreeShipping ? 0 : STANDARD_SHIPPING_FEE;
    const amountNeededForFreeShipping = qualifiesForFreeShipping
      ? 0
      : Math.max(0, FREE_SHIPPING_THRESHOLD - discountedSubtotal);

    const taxIncludedEstimate = Math.round(discountedSubtotal * 0.18);
    const finalTotal = Math.round((discountedSubtotal + shippingCost) * 100) / 100;

    return {
      mrpTotal,
      subtotal,
      itemDiscountAmount,
      discountAmount,
      couponDiscountAmount,
      discountDescription,
      couponCode: normalizedCoupon,
      shippingCost,
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      amountNeededForFreeShipping,
      taxIncludedEstimate,
      finalTotal,
      currency: 'INR',
    };
  }

  private resolveVariantForProduct(
    product: Product,
    options?: AddCartItemOptions
  ): ProductVariantDTO | null {
    const variants = product.variants || [];
    if (variants.length === 0) {
      if (
        options?.variantId &&
        options.variantId.trim().length > 0
      ) {
        throw new CartValidationError(
          `Product '${product.name}' does not have configurable variants.`,
          'INVALID_VARIANT',
          400
        );
      }
      return null;
    }

    const requestedVariantId = options?.variantId ? options.variantId.trim() : '';
    const requestedSize = options?.selectedSize ? options.selectedSize.trim() : '';
    const requestedColor = options?.selectedColor ? options.selectedColor.trim() : '';

    if (requestedVariantId) {
      const matched = variants.find((v) => v.id === requestedVariantId);
      if (!matched) {
        throw new CartValidationError(
          `Variant '${requestedVariantId}' does not belong to '${product.name}'.`,
          'INVALID_VARIANT',
          400
        );
      }
      return matched;
    }

    if (requestedSize || requestedColor) {
      const matched = variants.find((v) => {
        const sizeMatch =
          !requestedSize ||
          (v.size && v.size.toLowerCase() === requestedSize.toLowerCase()) ||
          v.label.toLowerCase().includes(requestedSize.toLowerCase());
        const colorMatch =
          !requestedColor ||
          (v.color && v.color.toLowerCase().includes(requestedColor.toLowerCase()));
        return sizeMatch && colorMatch;
      });
      if (!matched) {
        throw new CartValidationError(
          `Requested size/colour (${[requestedSize, requestedColor].filter(Boolean).join(' / ')}) is not available for '${product.name}'.`,
          'INVALID_VARIANT',
          400
        );
      }
      return matched;
    }

    if (options?.requireExplicitVariant && product.requires_variant_selection) {
      const availableSizes = variants
        .filter((v) => v.availability && v.stockCount > 0)
        .map((v) => v.size || v.label)
        .join(', ');
      throw new CartValidationError(
        `Please select a size or variant for '${product.name}' (available: ${availableSizes || 'none'}).`,
        'VARIANT_SELECTION_REQUIRED',
        400
      );
    }

    // Default fallback when explicit variant isn't required
    return (
      variants.find((v) => v.isDefault && v.availability && v.stockCount > 0) ||
      variants.find((v) => v.availability && v.stockCount > 0) ||
      variants[0]
    );
  }

  public getCart(sessionId: string, userId?: string | null): CartSummaryDTO {
    const cartRow = this.getOrCreateCartRow(sessionId, userId);
    const rawItems = this.db
      .prepare('SELECT * FROM cart_items WHERE cart_id = ? ORDER BY added_at ASC')
      .all(cartRow.id) as RawCartItemRow[];

    const items: CartItemDTO[] = [];
    for (const row of rawItems) {
      const product = this.productRepo.findById(row.product_id);
      if (!product) {
        // Clean up orphaned item if product no longer exists or is archived
        this.db.prepare('DELETE FROM cart_items WHERE id = ?').run(row.id);
        continue;
      }

      const enrichedProduct: Product = this.priceComparisonService
        ? this.priceComparisonService.enrichProductWithPurchaseLinks(product)
        : product;

      const variantId = row.variant_id && row.variant_id.trim().length > 0 ? row.variant_id.trim() : null;
      const matchedVariant = variantId
        ? (product.variants || []).find((v) => v.id === variantId)
        : undefined;

      const maxStock = matchedVariant
        ? matchedVariant.stockCount
        : typeof product.stock_count === 'number'
          ? product.stock_count
          : product.availability
            ? 25
            : 0;

      const unitPrice = matchedVariant ? matchedVariant.price : product.price;
      const originalUnitPrice =
        matchedVariant && matchedVariant.originalPrice
          ? matchedVariant.originalPrice
          : product.original_price ?? null;
      const itemDiscountAmount =
        originalUnitPrice && originalUnitPrice > unitPrice
          ? Math.round((originalUnitPrice - unitPrice) * row.quantity * 100) / 100
          : 0;
      const lineTotal = Math.round(unitPrice * row.quantity * 100) / 100;

      // If variant has a dedicated image, reflect it on the cart item's product snapshot
      const displayProduct: Product =
        matchedVariant && matchedVariant.image
          ? { ...enrichedProduct, image: matchedVariant.image }
          : enrichedProduct;

      items.push({
        id: row.id,
        cartId: cartRow.id,
        productId: product.id,
        variantId,
        variantLabel: row.variant_label || matchedVariant?.label || null,
        selectedSize: row.selected_size || matchedVariant?.size || null,
        selectedColor: row.selected_color || matchedVariant?.color || null,
        product: displayProduct,
        quantity: row.quantity,
        unitPrice,
        originalUnitPrice,
        itemDiscountAmount,
        lineTotal,
        maxAvailableStock: maxStock,
        addedAt: row.added_at,
        updatedAt: row.updated_at,
      });
    }

    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
    const pricing = this.calculatePricing(
      items.map((i) => ({
        productId: i.productId,
        category: i.product.category,
        unitPrice: i.unitPrice,
        originalUnitPrice: i.originalUnitPrice,
        quantity: i.quantity,
      })),
      cartRow.coupon_code,
      { sessionId: cartRow.session_id, userId: cartRow.user_id }
    );

    return {
      cartId: cartRow.id,
      sessionId: cartRow.session_id,
      userId: cartRow.user_id || null,
      items,
      totalQuantity,
      uniqueItemCount: items.length,
      pricing,
      updatedAt: cartRow.updated_at,
    };
  }

  public addItem(
    sessionId: string,
    productId: string,
    quantity = 1,
    options?: AddCartItemOptions
  ): CartSummaryDTO {
    const cleanSessionId = this.validateSessionId(sessionId);

    if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
      throw new CartValidationError('Product ID is required', 'INVALID_PRODUCT_ID', 400);
    }

    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      throw new CartValidationError(
        'Quantity to add must be a whole number of at least 1',
        'INVALID_QUANTITY',
        400
      );
    }

    const product = this.productRepo.findById(productId.trim());
    if (!product) {
      throw new CartValidationError(
        `Product '${productId}' was not found in the catalogue`,
        'PRODUCT_NOT_FOUND',
        404
      );
    }

    const matchedVariant = this.resolveVariantForProduct(product, options);
    const variantKey = matchedVariant ? matchedVariant.id : '';

    const maxStock = matchedVariant
      ? matchedVariant.stockCount
      : typeof product.stock_count === 'number'
        ? product.stock_count
        : product.availability
          ? 25
          : 0;

    const isItemAvailable = matchedVariant
      ? matchedVariant.availability && matchedVariant.stockCount > 0
      : product.availability && maxStock > 0;

    if (!isItemAvailable || maxStock <= 0) {
      throw new CartValidationError(
        matchedVariant
          ? `Variant '${matchedVariant.label}' of '${product.name}' is currently out of stock`
          : `Product '${product.name}' is currently out of stock`,
        'OUT_OF_STOCK',
        400
      );
    }

    const cartRow = this.getOrCreateCartRow(cleanSessionId, options?.userId);
    const existingItem = this.db
      .prepare(
        'SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ? AND COALESCE(variant_id, \'\') = ?'
      )
      .get(cartRow.id, product.id, variantKey) as RawCartItemRow | undefined;

    const newQuantity = (existingItem ? existingItem.quantity : 0) + quantity;
    if (newQuantity > maxStock) {
      throw new CartValidationError(
        `Cannot add ${quantity} unit(s) of '${product.name}'${matchedVariant ? ` (${matchedVariant.label})` : ''}. Only ${maxStock} unit(s) available in stock (you already have ${existingItem ? existingItem.quantity : 0} in your cart).`,
        'STOCK_LIMIT_EXCEEDED',
        400
      );
    }

    const now = new Date().toISOString();
    if (existingItem) {
      this.db
        .prepare('UPDATE cart_items SET quantity = ?, updated_at = ? WHERE id = ?')
        .run(newQuantity, now, existingItem.id);
    } else {
      const itemId = `ci_${randomUUID().slice(0, 12)}`;
      this.db
        .prepare(
          `INSERT INTO cart_items (
            id, cart_id, product_id, variant_id, variant_label, selected_size, selected_color,
            quantity, added_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          itemId,
          cartRow.id,
          product.id,
          variantKey,
          matchedVariant?.label || null,
          matchedVariant?.size || options?.selectedSize || null,
          matchedVariant?.color || options?.selectedColor || null,
          newQuantity,
          now,
          now
        );
    }

    this.db
      .prepare('UPDATE carts SET updated_at = ? WHERE id = ?')
      .run(now, cartRow.id);

    return this.getCart(cleanSessionId, options?.userId);
  }

  public updateItemQuantity(
    sessionId: string,
    productId: string,
    quantity: number,
    variantId?: string | null
  ): CartSummaryDTO {
    const cleanSessionId = this.validateSessionId(sessionId);

    if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
      throw new CartValidationError('Product ID is required', 'INVALID_PRODUCT_ID', 400);
    }

    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      throw new CartValidationError(
        'Quantity must be a non-negative integer (0 or greater)',
        'INVALID_QUANTITY',
        400
      );
    }

    const cartRow = this.getOrCreateCartRow(cleanSessionId);
    const cleanProductId = productId.trim();
    const variantKey = variantId ? variantId.trim() : undefined;

    if (quantity === 0) {
      return this.removeItem(cleanSessionId, cleanProductId, variantKey);
    }

    const product = this.productRepo.findById(cleanProductId);
    if (!product) {
      throw new CartValidationError(
        `Product '${cleanProductId}' was not found in the catalogue`,
        'PRODUCT_NOT_FOUND',
        404
      );
    }

    // Find the existing item in the cart first
    let existingItem: RawCartItemRow | undefined;
    if (variantKey !== undefined) {
      existingItem = this.db
        .prepare(
          'SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ? AND COALESCE(variant_id, \'\') = ?'
        )
        .get(cartRow.id, product.id, variantKey) as RawCartItemRow | undefined;
    } else {
      existingItem = this.db
        .prepare('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ? LIMIT 1')
        .get(cartRow.id, product.id) as RawCartItemRow | undefined;
    }

    const effectiveVariantId =
      variantKey !== undefined ? variantKey : existingItem?.variant_id || '';
    const matchedVariant = effectiveVariantId
      ? (product.variants || []).find((v) => v.id === effectiveVariantId)
      : undefined;

    const maxStock = matchedVariant
      ? matchedVariant.stockCount
      : typeof product.stock_count === 'number'
        ? product.stock_count
        : product.availability
          ? 25
          : 0;

    if ((!product.availability && !matchedVariant) || maxStock <= 0) {
      throw new CartValidationError(
        `Product '${product.name}' is currently out of stock`,
        'OUT_OF_STOCK',
        400
      );
    }

    if (quantity > maxStock) {
      throw new CartValidationError(
        `Requested quantity (${quantity}) exceeds available stock (${maxStock}) for '${product.name}'`,
        'STOCK_LIMIT_EXCEEDED',
        400
      );
    }

    const now = new Date().toISOString();
    if (existingItem) {
      this.db
        .prepare('UPDATE cart_items SET quantity = ?, updated_at = ? WHERE id = ?')
        .run(quantity, now, existingItem.id);
    } else {
      const itemId = `ci_${randomUUID().slice(0, 12)}`;
      this.db
        .prepare(
          `INSERT INTO cart_items (
            id, cart_id, product_id, variant_id, variant_label, selected_size, selected_color,
            quantity, added_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          itemId,
          cartRow.id,
          product.id,
          effectiveVariantId,
          matchedVariant?.label || null,
          matchedVariant?.size || null,
          matchedVariant?.color || null,
          quantity,
          now,
          now
        );
    }

    this.db
      .prepare('UPDATE carts SET updated_at = ? WHERE id = ?')
      .run(now, cartRow.id);

    return this.getCart(cleanSessionId);
  }

  public removeItem(
    sessionId: string,
    productId: string,
    variantId?: string | null
  ): CartSummaryDTO {
    const cleanSessionId = this.validateSessionId(sessionId);
    const cartRow = this.getOrCreateCartRow(cleanSessionId);
    const now = new Date().toISOString();

    if (variantId !== undefined && variantId !== null) {
      this.db
        .prepare(
          'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ? AND COALESCE(variant_id, \'\') = ?'
        )
        .run(cartRow.id, productId.trim(), variantId.trim());
    } else {
      this.db
        .prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?')
        .run(cartRow.id, productId.trim());
    }

    this.db
      .prepare('UPDATE carts SET updated_at = ? WHERE id = ?')
      .run(now, cartRow.id);

    return this.getCart(cleanSessionId);
  }

  public clearCart(sessionId: string): CartSummaryDTO {
    const cleanSessionId = this.validateSessionId(sessionId);
    const cartRow = this.getOrCreateCartRow(cleanSessionId);
    const now = new Date().toISOString();

    this.db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartRow.id);
    this.db
      .prepare('UPDATE carts SET coupon_code = NULL, updated_at = ? WHERE id = ?')
      .run(now, cartRow.id);

    return this.getCart(cleanSessionId);
  }

  /**
   * Merges a guest cart into an authenticated user's session cart safely,
   * respecting per-item stock limits.
   */
  public mergeGuestCartIntoUserCart(
    guestSessionId: string | undefined,
    targetSessionId: string,
    userId: string
  ): CartSummaryDTO {
    const cleanTarget = this.validateSessionId(targetSessionId);
    const targetCart = this.getOrCreateCartRow(cleanTarget, userId);

    if (!guestSessionId || guestSessionId.trim() === cleanTarget) {
      return this.getCart(cleanTarget, userId);
    }

    let cleanGuest: string;
    try {
      cleanGuest = this.validateSessionId(guestSessionId);
    } catch {
      return this.getCart(cleanTarget, userId);
    }

    const guestCart = this.db
      .prepare('SELECT * FROM carts WHERE session_id = ?')
      .get(cleanGuest) as RawCartRow | undefined;

    if (!guestCart) {
      return this.getCart(cleanTarget, userId);
    }

    const guestItems = this.db
      .prepare('SELECT * FROM cart_items WHERE cart_id = ?')
      .all(guestCart.id) as RawCartItemRow[];

    for (const item of guestItems) {
      try {
        this.addItem(cleanTarget, item.product_id, item.quantity, {
          variantId: item.variant_id || undefined,
          selectedSize: item.selected_size || undefined,
          selectedColor: item.selected_color || undefined,
          userId,
        });
      } catch {
        // Skip items that exceed stock or are no longer available
      }
    }

    if (guestCart.coupon_code && !targetCart.coupon_code) {
      try {
        this.applyCoupon(cleanTarget, guestCart.coupon_code, userId);
      } catch {}
    }

    // Clear merged guest cart
    this.db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(guestCart.id);
    return this.getCart(cleanTarget, userId);
  }

  public applyCoupon(
    sessionId: string,
    couponCode: string | null,
    userId?: string | null
  ): CartSummaryDTO {
    const cleanSessionId = this.validateSessionId(sessionId);
    const cartRow = this.getOrCreateCartRow(cleanSessionId, userId);
    const now = new Date().toISOString();

    const normalized = couponCode ? couponCode.trim().toUpperCase() : null;
    if (normalized) {
      this.validateCouponEligibility(normalized, {
        sessionId: cleanSessionId,
        userId: userId || cartRow.user_id,
      });
    }

    this.db
      .prepare('UPDATE carts SET coupon_code = ?, updated_at = ? WHERE id = ?')
      .run(normalized, now, cartRow.id);

    return this.getCart(cleanSessionId, userId);
  }

  /**
   * Validates checkout customer details, creates an order inside an atomic SQLite transaction,
   * prevents accidental duplicate order submissions, decrements product & variant stock,
   * records coupon usage, and clears the cart.
   */
  public createOrder(input: CheckoutInput): OrderDTO {
    const cleanSessionId = this.validateSessionId(input.sessionId);

    // 1. Check idempotency key first
    const cleanIdempotencyKey =
      input.idempotencyKey && input.idempotencyKey.trim().length > 0
        ? input.idempotencyKey.trim().slice(0, 120)
        : null;

    if (cleanIdempotencyKey) {
      const existingByKey = this.db
        .prepare('SELECT * FROM orders WHERE idempotency_key = ? AND session_id = ?')
        .get(cleanIdempotencyKey, cleanSessionId) as RawOrderRow | undefined;

      if (existingByKey) {
        const dto = this.mapRowToOrderDTO(existingByKey);
        return { ...dto, duplicatePrevented: true };
      }
    }

    // 2. Validate customer & shipping address fields
    const customerName = (input.customerName || '').trim();
    if (customerName.length < 2 || customerName.length > 120) {
      throw new CartValidationError(
        'Customer name must be between 2 and 120 characters',
        'INVALID_CUSTOMER_NAME',
        400
      );
    }

    const customerEmail = (input.customerEmail || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      throw new CartValidationError(
        'A valid customer email address is required',
        'INVALID_EMAIL',
        400
      );
    }

    const customerPhone = (input.customerPhone || '').trim();
    const digitsOnly = customerPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      throw new CartValidationError(
        'A valid 10-digit phone number is required',
        'INVALID_PHONE',
        400
      );
    }

    const addr = input.shippingAddress;
    if (!addr || typeof addr !== 'object') {
      throw new CartValidationError(
        'Shipping address is required',
        'INVALID_ADDRESS',
        400
      );
    }

    const line1 = (addr.line1 || '').trim();
    const line2 = addr.line2 ? addr.line2.trim() : undefined;
    const city = (addr.city || '').trim();
    const state = (addr.state || '').trim();
    const postalCode = (addr.postalCode || '').trim();
    const country = (addr.country || 'India').trim();

    if (line1.length < 3 || city.length < 2 || state.length < 2) {
      throw new CartValidationError(
        'Complete shipping address (street address, city, and state) is required',
        'INVALID_ADDRESS',
        400
      );
    }

    if (!/^[0-9A-Za-z\s-]{4,10}$/.test(postalCode)) {
      throw new CartValidationError(
        'A valid PIN / postal code is required',
        'INVALID_POSTAL_CODE',
        400
      );
    }

    // 3. Load current cart and check rapid duplicate fingerprint
    const currentCart = this.getCart(cleanSessionId, input.userId);
    const itemFingerprint = currentCart.items
      .map((i) => `${i.productId}:${i.variantId || ''}:${i.quantity}`)
      .sort()
      .join('|');

    const recentSub = this.recentOrderFingerprints.get(cleanSessionId);
    const nowMs = Date.now();
    if (
      recentSub &&
      nowMs - recentSub.timestamp < 15_000 &&
      (currentCart.items.length === 0 || recentSub.fingerprint === itemFingerprint)
    ) {
      const existingOrder = this.getOrderById(cleanSessionId, recentSub.orderId);
      if (existingOrder) {
        return { ...existingOrder, duplicatePrevented: true };
      }
    }

    if (currentCart.items.length === 0) {
      throw new CartValidationError(
        'Cannot place an order with an empty cart',
        'EMPTY_CART',
        400
      );
    }

    // 4. Execute order creation, stock decrement, coupon usage recording, and cart clear atomically
    const executeCheckoutTx = this.db.transaction((): OrderDTO => {
      const freshCart = this.getCart(cleanSessionId, input.userId);
      if (freshCart.items.length === 0) {
        throw new CartValidationError(
          'Cannot place an order with an empty cart',
          'EMPTY_CART',
          400
        );
      }

      // Verify stock and current server-side prices for all items and variants
      for (const item of freshCart.items) {
        const freshProd = this.productRepo.findById(item.productId);
        if (!freshProd || !freshProd.availability) {
          throw new CartValidationError(
            `Product '${item.product.name}' is no longer available`,
            'OUT_OF_STOCK',
            400
          );
        }

        if (item.variantId) {
          const freshVariant = (freshProd.variants || []).find(
            (v) => v.id === item.variantId
          );
          if (!freshVariant || !freshVariant.availability) {
            throw new CartValidationError(
              `Selected variant '${item.variantLabel || item.variantId}' of '${freshProd.name}' is no longer available`,
              'OUT_OF_STOCK',
              400
            );
          }
          if (item.quantity > freshVariant.stockCount) {
            throw new CartValidationError(
              `Insufficient stock for '${freshProd.name} (${freshVariant.label})'. Requested ${item.quantity}, available ${freshVariant.stockCount}.`,
              'STOCK_LIMIT_EXCEEDED',
              400
            );
          }
        } else {
          const availableStock =
            typeof freshProd.stock_count === 'number' ? freshProd.stock_count : 25;
          if (item.quantity > availableStock) {
            throw new CartValidationError(
              `Insufficient stock for '${freshProd.name}'. Requested ${item.quantity}, available ${availableStock}.`,
              'STOCK_LIMIT_EXCEEDED',
              400
            );
          }
        }
      }

      const activeCoupon =
        input.couponCode !== undefined
          ? input.couponCode
          : freshCart.pricing.couponCode;

      if (activeCoupon && activeCoupon.trim().length > 0) {
        this.validateCouponEligibility(activeCoupon, {
          sessionId: cleanSessionId,
          userId: input.userId || freshCart.userId,
          subtotal: freshCart.pricing.subtotal,
          items: freshCart.items.map((i) => ({
            productId: i.productId,
            category: i.product.category,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
          })),
        });
      }

      const verifiedPricing = this.calculatePricing(
        freshCart.items.map((i) => ({
          productId: i.productId,
          category: i.product.category,
          unitPrice: i.unitPrice,
          originalUnitPrice: i.originalUnitPrice,
          quantity: i.quantity,
        })),
        activeCoupon,
        { sessionId: cleanSessionId, userId: input.userId || freshCart.userId }
      );

      const nowIso = new Date().toISOString();
      const orderId = `ORD-${nowIso.slice(0, 10).replace(/-/g, '')}-${randomUUID()
        .slice(0, 6)
        .toUpperCase()}`;

      const cleanAddress: ShippingAddress = {
        line1,
        line2,
        city,
        state,
        postalCode,
        country,
      };

      const statusHistory: OrderStatusHistoryEntry[] = [
        {
          status: 'Pending',
          timestamp: nowIso,
          note: 'Order received and server-side cart validation passed.',
        },
        {
          status: 'Confirmed',
          timestamp: nowIso,
          note: 'Demo checkout confirmed (no real payment processed). Stock reserved.',
        },
      ];

      const paymentMethod = (input.paymentMethod || 'demo_card').trim();
      const notes = input.notes ? input.notes.trim().slice(0, 500) : null;
      const effectiveUserId = input.userId || freshCart.userId || null;

      this.db
        .prepare(
          `INSERT INTO orders (
            id, session_id, user_id, idempotency_key, customer_name, customer_email, customer_phone,
            shipping_address, payment_method, is_demo_checkout, demo_disclaimer,
            subtotal, item_discount_amount, discount_amount, coupon_discount_amount, coupon_code,
            shipping_cost, tax_amount, final_total,
            currency, status, status_history, stock_restored, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?, 0, ?, ?, ?)`
        )
        .run(
          orderId,
          cleanSessionId,
          effectiveUserId,
          cleanIdempotencyKey,
          customerName,
          customerEmail,
          customerPhone,
          JSON.stringify(cleanAddress),
          paymentMethod,
          DEMO_CHECKOUT_DISCLAIMER,
          verifiedPricing.subtotal,
          verifiedPricing.itemDiscountAmount ?? 0,
          verifiedPricing.discountAmount,
          verifiedPricing.couponDiscountAmount ?? 0,
          verifiedPricing.couponCode || null,
          verifiedPricing.shippingCost,
          verifiedPricing.taxIncludedEstimate,
          verifiedPricing.finalTotal,
          verifiedPricing.currency,
          JSON.stringify(statusHistory),
          notes,
          nowIso,
          nowIso
        );

      const insertItemStmt = this.db.prepare(
        `INSERT INTO order_items (
          id, order_id, product_id, variant_id, variant_label, selected_size, selected_color,
          product_name, brand, category, image, unit_price, original_unit_price, item_discount_amount,
          quantity, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const item of freshCart.items) {
        const orderItemId = `oi_${randomUUID().slice(0, 12)}`;
        const unitPrice = item.unitPrice;
        const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;

        insertItemStmt.run(
          orderItemId,
          orderId,
          item.productId,
          item.variantId || null,
          item.variantLabel || null,
          item.selectedSize || null,
          item.selectedColor || null,
          item.product.name,
          item.product.brand,
          item.product.category,
          item.product.image,
          unitPrice,
          item.originalUnitPrice ?? null,
          item.itemDiscountAmount ?? 0,
          item.quantity,
          lineTotal
        );

        if (this.productRepo.adjustStock) {
          this.productRepo.adjustStock(
            item.productId,
            -item.quantity,
            item.variantId || null
          );
        }
      }

      // Record coupon usage if a coupon was applied
      if (verifiedPricing.couponCode) {
        this.db
          .prepare('UPDATE coupons SET used_count = used_count + 1, updated_at = ? WHERE code = ?')
          .run(nowIso, verifiedPricing.couponCode);
        this.db
          .prepare(
            `INSERT INTO coupon_usages (
              id, coupon_code, user_id, session_id, order_id, discount_applied, used_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            `cu_${randomUUID().slice(0, 12)}`,
            verifiedPricing.couponCode,
            effectiveUserId,
            cleanSessionId,
            orderId,
            verifiedPricing.couponDiscountAmount ?? verifiedPricing.discountAmount,
            nowIso
          );
      }

      // Clear cart after order is placed
      this.db
        .prepare('DELETE FROM cart_items WHERE cart_id = ?')
        .run(freshCart.cartId);
      this.db
        .prepare('UPDATE carts SET coupon_code = NULL, updated_at = ? WHERE id = ?')
        .run(nowIso, freshCart.cartId);

      // Save customer details to account profile for convenience
      this.upsertAccountFromCheckout(
        cleanSessionId,
        customerName,
        customerEmail,
        customerPhone,
        cleanAddress,
        effectiveUserId
      );

      const createdRow = this.db
        .prepare('SELECT * FROM orders WHERE id = ?')
        .get(orderId) as RawOrderRow;

      return this.mapRowToOrderDTO(createdRow);
    });

    const createdOrder = executeCheckoutTx();

    this.recentOrderFingerprints.set(cleanSessionId, {
      fingerprint: itemFingerprint,
      orderId: createdOrder.id,
      timestamp: nowMs,
    });

    return createdOrder;
  }

  public getOrdersBySession(
    sessionId: string,
    authUser?: UserDTO
  ): OrderDTO[] {
    const cleanSessionId = this.validateSessionId(sessionId);
    let rows: RawOrderRow[];
    if (authUser) {
      rows = this.db
        .prepare(
          'SELECT * FROM orders WHERE user_id = ? OR (user_id IS NULL AND session_id = ?) ORDER BY created_at DESC'
        )
        .all(authUser.id, cleanSessionId) as RawOrderRow[];
    } else {
      rows = this.db
        .prepare(
          'SELECT * FROM orders WHERE session_id = ? AND user_id IS NULL ORDER BY created_at DESC'
        )
        .all(cleanSessionId) as RawOrderRow[];
    }

    return rows.map((r) => this.mapRowToOrderDTO(r));
  }

  public listAllOrdersForAdmin(statusFilter?: OrderStatus): OrderDTO[] {
    const rows = statusFilter
      ? (this.db
          .prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC')
          .all(statusFilter) as RawOrderRow[])
      : (this.db
          .prepare('SELECT * FROM orders ORDER BY created_at DESC')
          .all() as RawOrderRow[]);
    return rows.map((r) => this.mapRowToOrderDTO(r));
  }

  public getOrderById(
    sessionId: string,
    orderId: string,
    authUser?: UserDTO
  ): OrderDTO | null {
    if (!orderId || typeof orderId !== 'string') return null;

    if (authUser?.role === 'admin') {
      const row = this.db
        .prepare('SELECT * FROM orders WHERE id = ?')
        .get(orderId.trim()) as RawOrderRow | undefined;
      return row ? this.mapRowToOrderDTO(row) : null;
    }

    const cleanSessionId = this.validateSessionId(sessionId);
    const row = this.db
      .prepare('SELECT * FROM orders WHERE id = ?')
      .get(orderId.trim()) as RawOrderRow | undefined;

    if (!row) return null;

    // Enforce strict ownership check
    if (row.user_id) {
      if (!authUser || authUser.id !== row.user_id) {
        throw new CartValidationError(
          'You do not have permission to view or modify another customer\'s order.',
          'FORBIDDEN_ORDER_OWNERSHIP',
          403
        );
      }
    } else if (row.session_id !== cleanSessionId) {
      return null;
    }

    return this.mapRowToOrderDTO(row);
  }

  public updateOrderStatus(
    sessionId: string,
    orderId: string,
    nextStatus: OrderStatus,
    note?: string,
    authUser?: UserDTO
  ): OrderDTO {
    const validStatuses: OrderStatus[] = [
      'Pending',
      'Confirmed',
      'Processing',
      'Shipped',
      'Delivered',
      'Cancelled',
    ];
    if (!validStatuses.includes(nextStatus)) {
      throw new CartValidationError(
        `Invalid order status '${nextStatus}'`,
        'INVALID_ORDER_STATUS',
        400
      );
    }

    const rawRow = this.db
      .prepare('SELECT * FROM orders WHERE id = ?')
      .get((orderId || '').trim()) as RawOrderRow | undefined;

    if (!rawRow) {
      throw new CartValidationError(
        `Order '${orderId}' not found`,
        'ORDER_NOT_FOUND',
        404
      );
    }

    // Ownership verification if not admin
    if (authUser?.role !== 'admin') {
      const cleanSessionId = this.validateSessionId(sessionId);
      if (rawRow.user_id && (!authUser || authUser.id !== rawRow.user_id)) {
        throw new CartValidationError(
          'You do not have permission to modify another customer\'s order.',
          'FORBIDDEN_ORDER_OWNERSHIP',
          403
        );
      }
      if (!rawRow.user_id && rawRow.session_id !== cleanSessionId) {
        throw new CartValidationError(
          `Order '${orderId}' not found for this session`,
          'ORDER_NOT_FOUND',
          404
        );
      }
    }

    const existing = this.mapRowToOrderDTO(rawRow);

    if (existing.status === 'Cancelled') {
      throw new CartValidationError(
        'Cancelled orders cannot be transitioned to another status',
        'INVALID_STATUS_TRANSITION',
        400
      );
    }

    if (existing.status === 'Delivered' && nextStatus === 'Cancelled') {
      throw new CartValidationError(
        'Delivered orders cannot be cancelled directly',
        'INVALID_STATUS_TRANSITION',
        400
      );
    }

    const nowIso = new Date().toISOString();
    const updatedHistory: OrderStatusHistoryEntry[] = [
      ...existing.statusHistory,
      {
        status: nextStatus,
        timestamp: nowIso,
        note:
          note ||
          (nextStatus === 'Processing'
            ? 'Order is being packed and prepared for dispatch.'
            : nextStatus === 'Shipped'
              ? 'Demo shipment dispatched to courier.'
              : nextStatus === 'Delivered'
                ? 'Demo package marked as delivered.'
                : nextStatus === 'Cancelled'
                  ? 'Order cancelled; reserved stock restored.'
                  : `Order status updated to ${nextStatus}.`),
      },
    ];

    const tx = this.db.transaction(() => {
      const shouldRestoreStock =
        nextStatus === 'Cancelled' && !Boolean(rawRow.stock_restored);

      this.db
        .prepare(
          'UPDATE orders SET status = ?, status_history = ?, stock_restored = ?, updated_at = ? WHERE id = ?'
        )
        .run(
          nextStatus,
          JSON.stringify(updatedHistory),
          shouldRestoreStock || Boolean(rawRow.stock_restored) ? 1 : 0,
          nowIso,
          existing.id
        );

      // Restore stock AT MOST ONCE when cancelled
      if (shouldRestoreStock && this.productRepo.adjustStock) {
        for (const item of existing.items) {
          this.productRepo.adjustStock(
            item.productId,
            item.quantity,
            item.variantId || null
          );
        }
      }
    });

    tx();
    const updatedRow = this.db
      .prepare('SELECT * FROM orders WHERE id = ?')
      .get(existing.id) as RawOrderRow;
    return this.mapRowToOrderDTO(updatedRow);
  }

  private mapRowToOrderDTO(row: RawOrderRow): OrderDTO {
    const itemRows = this.db
      .prepare('SELECT * FROM order_items WHERE order_id = ?')
      .all(row.id) as RawOrderItemRow[];

    const items: OrderItemDTO[] = itemRows.map((ir) => ({
      id: ir.id,
      orderId: ir.order_id,
      productId: ir.product_id,
      variantId: ir.variant_id || null,
      variantLabel: ir.variant_label || null,
      selectedSize: ir.selected_size || null,
      selectedColor: ir.selected_color || null,
      productName: ir.product_name,
      brand: ir.brand,
      category: ir.category,
      image: ir.image,
      unitPrice: ir.unit_price,
      originalUnitPrice: ir.original_unit_price ?? null,
      itemDiscountAmount: ir.item_discount_amount ?? 0,
      quantity: ir.quantity,
      lineTotal: ir.line_total,
    }));

    let shippingAddress: ShippingAddress = {
      line1: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
    };
    try {
      shippingAddress = JSON.parse(row.shipping_address);
    } catch {}

    let statusHistory: OrderStatusHistoryEntry[] = [];
    try {
      statusHistory = JSON.parse(row.status_history);
    } catch {}

    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id || null,
      idempotencyKey: row.idempotency_key,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      shippingAddress,
      paymentMethod: row.payment_method,
      isDemoCheckout: true,
      demoDisclaimer: row.demo_disclaimer || DEMO_CHECKOUT_DISCLAIMER,
      items,
      totalQuantity,
      pricing: {
        subtotal: row.subtotal,
        itemDiscountAmount: row.item_discount_amount ?? 0,
        discountAmount: row.discount_amount,
        couponDiscountAmount: row.coupon_discount_amount ?? row.discount_amount,
        couponCode: row.coupon_code,
        shippingCost: row.shipping_cost,
        taxIncludedEstimate: row.tax_amount,
        finalTotal: row.final_total,
        currency: row.currency || 'INR',
      },
      status: row.status,
      statusHistory,
      stockRestored: Boolean(row.stock_restored),
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private upsertAccountFromCheckout(
    sessionId: string,
    fullName: string,
    email: string,
    phone: string,
    address: ShippingAddress,
    userId?: string | null
  ): void {
    const existing = this.getAccountProfile(sessionId);
    const nowIso = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO account_profiles (session_id, user_id, full_name, email, phone, default_address, preferences, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           user_id = COALESCE(excluded.user_id, account_profiles.user_id),
           full_name = excluded.full_name,
           email = excluded.email,
           phone = excluded.phone,
           default_address = excluded.default_address,
           updated_at = excluded.updated_at`
      )
      .run(
        sessionId,
        userId || null,
        fullName,
        email,
        phone,
        JSON.stringify(address),
        JSON.stringify(existing.preferences),
        nowIso
      );
  }

  public getAccountProfile(sessionId: string): AccountProfileDTO {
    const cleanSessionId = this.validateSessionId(sessionId);
    const row = this.db
      .prepare('SELECT * FROM account_profiles WHERE session_id = ?')
      .get(cleanSessionId) as RawAccountRow | undefined;

    if (!row) {
      return {
        sessionId: cleanSessionId,
        userId: null,
        fullName: '',
        email: '',
        phone: '',
        defaultAddress: null,
        preferences: {
          preferredCategories: [],
          priorityPreference: 'quality_performance',
        },
        updatedAt: new Date().toISOString(),
      };
    }

    let defaultAddress: ShippingAddress | null = null;
    if (row.default_address) {
      try {
        defaultAddress = JSON.parse(row.default_address);
      } catch {}
    }

    let preferences: AccountProfileDTO['preferences'] = {
      preferredCategories: [],
      priorityPreference: 'quality_performance',
    };
    try {
      const parsed = JSON.parse(row.preferences || '{}');
      preferences = {
        preferredCategories: Array.isArray(parsed.preferredCategories)
          ? parsed.preferredCategories
          : [],
        budgetCeiling:
          typeof parsed.budgetCeiling === 'number'
            ? parsed.budgetCeiling
            : undefined,
        priorityPreference: parsed.priorityPreference || 'quality_performance',
      };
    } catch {}

    return {
      sessionId: cleanSessionId,
      userId: row.user_id || null,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      defaultAddress,
      preferences,
      updatedAt: row.updated_at,
    };
  }

  public updateAccountProfile(
    sessionId: string,
    input: Partial<Omit<AccountProfileDTO, 'sessionId' | 'updatedAt'>>
  ): AccountProfileDTO {
    const cleanSessionId = this.validateSessionId(sessionId);
    const existing = this.getAccountProfile(cleanSessionId);

    const fullName =
      input.fullName !== undefined ? input.fullName.trim().slice(0, 120) : existing.fullName;
    const email =
      input.email !== undefined ? input.email.trim().slice(0, 120) : existing.email;
    const phone =
      input.phone !== undefined ? input.phone.trim().slice(0, 20) : existing.phone;

    const defaultAddress =
      input.defaultAddress !== undefined ? input.defaultAddress : existing.defaultAddress;

    const validPriorities = [
      'budget',
      'quality_performance',
      'sustainability_certifications',
      'everyday_convenience',
    ];
    const nextPriority =
      input.preferences?.priorityPreference &&
      validPriorities.includes(input.preferences.priorityPreference)
        ? input.preferences.priorityPreference
        : existing.preferences.priorityPreference;

    const preferences: AccountProfileDTO['preferences'] = {
      preferredCategories: Array.isArray(input.preferences?.preferredCategories)
        ? input.preferences!.preferredCategories.filter(
            (c): c is string => typeof c === 'string' && c.trim().length > 0
          )
        : existing.preferences.preferredCategories,
      budgetCeiling:
        input.preferences?.budgetCeiling !== undefined
          ? typeof input.preferences.budgetCeiling === 'number' &&
            input.preferences.budgetCeiling > 0
            ? input.preferences.budgetCeiling
            : undefined
          : existing.preferences.budgetCeiling,
      priorityPreference: nextPriority,
    };

    const nowIso = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO account_profiles (session_id, user_id, full_name, email, phone, default_address, preferences, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           user_id = COALESCE(excluded.user_id, account_profiles.user_id),
           full_name = excluded.full_name,
           email = excluded.email,
           phone = excluded.phone,
           default_address = excluded.default_address,
           preferences = excluded.preferences,
           updated_at = excluded.updated_at`
      )
      .run(
        cleanSessionId,
        input.userId ?? existing.userId ?? null,
        fullName,
        email,
        phone,
        defaultAddress ? JSON.stringify(defaultAddress) : null,
        JSON.stringify(preferences),
        nowIso
      );

    return this.getAccountProfile(cleanSessionId);
  }
}
