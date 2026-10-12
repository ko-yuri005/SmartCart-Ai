import { Router, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { IProductRepository } from '../db/repositories/product.repository.js';
import {
  AuthenticatedRequest,
  AuthService,
} from '../services/auth.service.js';
import {
  CartOrderService,
  CartValidationError,
} from '../services/cart-order.service.js';
import {
  ReviewService,
  ReviewValidationError,
} from '../services/review.service.js';
import {
  ProductRequestService,
  RequestWorkflowError,
  validateAndNormalizeExternalUrl,
} from '../services/product-request.service.js';
import {
  AdminMarketplaceSummaryDTO,
  OrderStatus,
  Product,
  ProductImageGalleryItem,
  ProductRequestStatus,
  RestockSubscriptionStatus,
  ReviewModerationStatus,
} from '../types/index.js';
import { getDatabase } from '../db/database.js';

const MAX_ADMIN_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates an uploaded base64 image (JPEG/PNG/WebP, max 5MB, valid magic bytes)
 * and returns a normalized data URI.
 */
function validateAndBuildImageDataUri(
  imageData: string,
  mimeType?: string
): string {
  const raw = (imageData || '').trim();
  if (!raw) {
    throw new RequestWorkflowError(
      'Image data is required.',
      'INVALID_IMAGE_DATA',
      400
    );
  }

  let cleanBase64 = raw;
  let detectedMime = (mimeType || '').trim().toLowerCase();

  const dataUriMatch = raw.match(/^data:([a-z0-9/+-]+);base64,(.+)$/i);
  if (dataUriMatch) {
    detectedMime = dataUriMatch[1].toLowerCase();
    cleanBase64 = dataUriMatch[2];
  }

  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(detectedMime)) {
    throw new RequestWorkflowError(
      'Unsupported image format. Only JPEG, PNG, and WebP images are permitted.',
      'UNSUPPORTED_IMAGE_FORMAT',
      400
    );
  }

  const buf = Buffer.from(cleanBase64, 'base64');
  if (buf.length < 8) {
    throw new RequestWorkflowError(
      'Image file is empty or corrupted.',
      'CORRUPTED_IMAGE',
      400
    );
  }

  if (buf.length > MAX_ADMIN_IMAGE_BYTES) {
    throw new RequestWorkflowError(
      'Image file exceeds the maximum allowed size of 5 MB.',
      'IMAGE_TOO_LARGE',
      400
    );
  }

  const isPng =
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isWebp =
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP';

  if (!isPng && !isJpeg && !isWebp) {
    throw new RequestWorkflowError(
      'File binary header does not match a valid JPEG, PNG, or WebP image.',
      'INVALID_IMAGE_MAGIC_BYTES',
      400
    );
  }

  const canonicalMime = isPng
    ? 'image/png'
    : isWebp
      ? 'image/webp'
      : 'image/jpeg';

  return `data:${canonicalMime};base64,${cleanBase64}`;
}

export function createMarketplaceRouter(
  productRepo: IProductRepository,
  authService: AuthService,
  cartOrderService: CartOrderService,
  reviewService: ReviewService,
  productRequestService: ProductRequestService
): Router {
  const router = Router();

  const handleDomainError = (
    res: Response,
    error: unknown,
    defaultMsg: string
  ) => {
    if (
      error instanceof ReviewValidationError ||
      error instanceof RequestWorkflowError ||
      error instanceof CartValidationError
    ) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
      return;
    }
    console.error('[MarketplaceAPI] Unexpected error:', error);
    res.status(500).json({ error: defaultMsg });
  };

  // ===========================================================================
  // 1. CUSTOMER REVIEWS & RATINGS (PHASE 8)
  // ===========================================================================

  /**
   * GET /api/products/:id/reviews
   * Returns published reviews, average rating, rating distribution, and verified purchase count
   */
  router.get('/products/:id/reviews', (req: AuthenticatedRequest, res: Response) => {
    try {
      const productId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const sortParam = req.query.sortBy;
      const sortBy: 'newest' | 'highest' | 'lowest' =
        sortParam === 'highest' || sortParam === 'lowest' ? sortParam : 'newest';

      const summary = reviewService.getProductReviewSummary(productId, sortBy);
      res.json(summary);
    } catch (error) {
      handleDomainError(res, error, 'Failed to retrieve product reviews');
    }
  });

  /**
   * POST /api/products/:id/reviews
   * Submits a customer review; server verifies purchase status against non-cancelled orders
   */
  router.post('/products/:id/reviews', (req: AuthenticatedRequest, res: Response) => {
    try {
      const productId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const {
        sessionId,
        authorName,
        rating,
        title,
        comment,
        photos,
        categoryAttributes,
      } = req.body || {};

      const created = reviewService.createReview({
        productId,
        sessionId: sessionId || req.authSession?.id || 'guest_session',
        userId: req.authUser?.id ?? null,
        authorName: authorName || req.authUser?.fullName || req.authUser?.username,
        rating,
        title,
        comment,
        photos,
        categoryAttributes,
      });

      res.status(201).json(created);
    } catch (error) {
      handleDomainError(res, error, 'Failed to submit product review');
    }
  });

  /**
   * PATCH /api/reviews/:reviewId
   * Updates a customer's own review (or admin)
   */
  router.patch('/reviews/:reviewId', (req: AuthenticatedRequest, res: Response) => {
    try {
      const reviewId = Array.isArray(req.params.reviewId)
        ? req.params.reviewId[0]
        : req.params.reviewId;
      const { rating, title, comment, categoryAttributes, sessionId } =
        req.body || {};

      const updated = reviewService.updateReview(
        reviewId,
        { rating, title, comment, categoryAttributes },
        {
          userId: req.authUser?.id ?? null,
          sessionId,
          isAdmin: req.authUser?.role === 'admin',
        }
      );

      res.json(updated);
    } catch (error) {
      handleDomainError(res, error, 'Failed to update review');
    }
  });

  /**
   * DELETE /api/reviews/:reviewId
   * Deletes a customer's own review (or admin)
   */
  router.delete('/reviews/:reviewId', (req: AuthenticatedRequest, res: Response) => {
    try {
      const reviewId = Array.isArray(req.params.reviewId)
        ? req.params.reviewId[0]
        : req.params.reviewId;
      const sessionId =
        typeof req.query.sessionId === 'string'
          ? req.query.sessionId
          : req.body?.sessionId;

      reviewService.deleteReview(reviewId, {
        userId: req.authUser?.id ?? null,
        sessionId,
        isAdmin: req.authUser?.role === 'admin',
      });

      res.json({ success: true });
    } catch (error) {
      handleDomainError(res, error, 'Failed to delete review');
    }
  });

  // ===========================================================================
  // 2. RESTOCK NOTIFICATIONS & MISSING PRODUCT REQUESTS (PHASE 10)
  // ===========================================================================

  /**
   * POST /api/restock-subscriptions
   * Subscribes to restock notifications for an out-of-stock product or variant
   */
  router.post(
    '/restock-subscriptions',
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          productId,
          variantId,
          selectedSize,
          selectedColor,
          sessionId,
          email,
          consentGiven,
        } = req.body || {};

        const sub = productRequestService.subscribeRestock({
          productId,
          variantId,
          selectedSize,
          selectedColor,
          userId: req.authUser?.id ?? null,
          sessionId: sessionId || req.authSession?.id || 'guest_session',
          email: email || req.authUser?.email || '',
          consentGiven,
        });

        res.status(201).json(sub);
      } catch (error) {
        handleDomainError(
          res,
          error,
          'Failed to subscribe to restock notifications'
        );
      }
    }
  );

  /**
   * GET /api/restock-subscriptions
   * Lists the current customer's restock subscriptions
   */
  router.get(
    '/restock-subscriptions',
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const sessionId =
          typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
        const list = productRequestService.getCustomerRestockSubscriptions(
          sessionId,
          req.authUser?.id ?? null
        );
        res.json(list);
      } catch (error) {
        handleDomainError(
          res,
          error,
          'Failed to retrieve restock subscriptions'
        );
      }
    }
  );

  /**
   * DELETE /api/restock-subscriptions/:subscriptionId
   * Cancels the customer's own restock subscription
   */
  router.delete(
    '/restock-subscriptions/:subscriptionId',
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const subscriptionId = Array.isArray(req.params.subscriptionId)
          ? req.params.subscriptionId[0]
          : req.params.subscriptionId;
        const sessionId =
          typeof req.query.sessionId === 'string'
            ? req.query.sessionId
            : req.body?.sessionId;

        const cancelled = productRequestService.cancelRestockSubscription(
          subscriptionId,
          {
            userId: req.authUser?.id ?? null,
            sessionId,
            isAdmin: req.authUser?.role === 'admin',
          }
        );
        res.json(cancelled);
      } catch (error) {
        handleDomainError(res, error, 'Failed to cancel restock subscription');
      }
    }
  );

  /**
   * POST /api/product-requests
   * Records a missing-product request with SSRF-protected external URL validation
   */
  router.post('/product-requests', (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        sourceUrl,
        requestedName,
        categoryHint,
        descriptionNotes,
        desiredSize,
        desiredColor,
        desiredVariant,
        sessionId,
        contactEmail,
        consentGiven,
      } = req.body || {};

      const created = productRequestService.createProductRequest({
        sourceUrl,
        requestedName,
        categoryHint,
        descriptionNotes,
        desiredSize,
        desiredColor,
        desiredVariant,
        userId: req.authUser?.id ?? null,
        sessionId: sessionId || req.authSession?.id || 'guest_session',
        contactEmail: contactEmail || req.authUser?.email || '',
        consentGiven,
      });

      res.status(201).json(created);
    } catch (error) {
      handleDomainError(res, error, 'Failed to submit product request');
    }
  });

  /**
   * GET /api/product-requests
   * Lists the current customer's submitted product requests
   */
  router.get('/product-requests', (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessionId =
        typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
      const list = productRequestService.getCustomerProductRequests(
        sessionId,
        req.authUser?.id ?? null
      );
      res.json(list);
    } catch (error) {
      handleDomainError(res, error, 'Failed to retrieve product requests');
    }
  });

  /**
   * GET /api/product-requests/:requestId
   * Retrieves a specific product request with strict ownership check
   */
  router.get(
    '/product-requests/:requestId',
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const requestId = Array.isArray(req.params.requestId)
          ? req.params.requestId[0]
          : req.params.requestId;
        const sessionId =
          typeof req.query.sessionId === 'string' ? req.query.sessionId : '';

        const item = productRequestService.getProductRequestById(requestId, {
          userId: req.authUser?.id ?? null,
          sessionId,
          isAdmin: req.authUser?.role === 'admin',
        });
        res.json(item);
      } catch (error) {
        handleDomainError(res, error, 'Failed to retrieve product request');
      }
    }
  );

  /**
   * DELETE /api/product-requests/:requestId
   * Closes/cancels the customer's own product request
   */
  router.delete(
    '/product-requests/:requestId',
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const requestId = Array.isArray(req.params.requestId)
          ? req.params.requestId[0]
          : req.params.requestId;
        const sessionId =
          typeof req.query.sessionId === 'string'
            ? req.query.sessionId
            : req.body?.sessionId;

        const closed = productRequestService.cancelProductRequestByCustomer(
          requestId,
          {
            userId: req.authUser?.id ?? null,
            sessionId,
            isAdmin: req.authUser?.role === 'admin',
          }
        );
        res.json(closed);
      } catch (error) {
        handleDomainError(res, error, 'Failed to close product request');
      }
    }
  );

  // ===========================================================================
  // 3. ADMIN PRODUCT, VARIANT, IMAGE, COUPON, ORDER & REQUEST MANAGEMENT
  // ===========================================================================

  /**
   * GET /api/admin/summary
   * Returns complete marketplace metrics and operational overview for administrators
   */
  router.get(
    '/admin/summary',
    authService.requireAdmin,
    (_req: AuthenticatedRequest, res: Response) => {
      try {
        const db = getDatabase();
        const allProducts = productRepo.findMany({
          includeArchived: true,
          inStockOnly: false,
          limit: 1000,
        });

        const activeProducts = allProducts.filter((p) => !p.is_archived);
        const archivedProducts = allProducts.filter((p) => p.is_archived);
        const outOfStockProducts = activeProducts.filter(
          (p) => !p.availability || (p.stock_count ?? 25) <= 0
        );
        const lowStockProducts = activeProducts.filter(
          (p) =>
            p.availability &&
            (p.stock_count ?? 25) > 0 &&
            (p.stock_count ?? 25) <= 5
        );
        const onSaleProducts = activeProducts.filter(
          (p) =>
            p.is_on_sale &&
            typeof p.original_price === 'number' &&
            p.original_price > p.price
        );

        const allOrders = cartOrderService.listAllOrdersForAdmin();
        const nonCancelledOrders = allOrders.filter(
          (o) => o.status !== 'Cancelled'
        );
        const totalRevenue = nonCancelledOrders.reduce(
          (acc, o) => acc + (o.pricing?.finalTotal || 0),
          0
        );

        const allRequests =
          productRequestService.listAllProductRequestsForAdmin();
        const pendingProductRequests = allRequests.filter((r) =>
          ['Requested', 'Under Review'].includes(r.status)
        ).length;

        const allRestocks =
          productRequestService.listAllRestockSubscriptionsForAdmin();
        const activeRestockSubscriptions = allRestocks.filter((s) =>
          ['Subscribed', 'EligibleForNotification'].includes(s.status)
        ).length;

        const allReviews = reviewService.listAllReviewsForAdmin();
        const customerCountRow = db
          .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'")
          .get() as { count: number };
        const activeCoupons = cartOrderService.listCoupons(false).length;

        const summary: AdminMarketplaceSummaryDTO = {
          totalProducts: allProducts.length,
          activeProducts: activeProducts.length,
          archivedProducts: archivedProducts.length,
          outOfStockProducts: outOfStockProducts.length,
          lowStockProducts: lowStockProducts.length,
          onSaleProducts: onSaleProducts.length,
          totalOrders: allOrders.length,
          totalRevenue,
          totalOrderRevenue: totalRevenue,
          pendingProductRequests,
          openProductRequests: pendingProductRequests,
          activeRestockSubscriptions,
          totalReviews: allReviews.length,
          totalRegisteredCustomers: customerCountRow?.count || 0,
          activeCoupons,
          recentOrders: allOrders.slice(0, 10),
          lowStockItems: [...outOfStockProducts, ...lowStockProducts].slice(0, 12),
        };

        res.json(summary);
      } catch (error) {
        handleDomainError(res, error, 'Failed to retrieve admin marketplace summary');
      }
    }
  );

  /**
   * GET /api/admin/products
   * Lists all products including archived and out-of-stock items
   */
  router.get(
    '/admin/products',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const search =
          typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
        const category =
          typeof req.query.category === 'string'
            ? req.query.category.trim()
            : undefined;
        const products = productRepo.findMany({
          includeArchived: true,
          inStockOnly: false,
          searchQuery: search,
          category,
          limit: 500,
        });
        res.json(products);
      } catch (error) {
        handleDomainError(res, error, 'Failed to list admin products');
      }
    }
  );

  /**
   * POST /api/admin/products
   * Creates a new product in the catalogue
   */
  router.post(
    '/admin/products',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          id,
          name,
          brand,
          category,
          price,
          original_price,
          originalPrice,
          sale_start_at,
          sale_end_at,
          description,
          features,
          specifications,
          use_cases,
          useCases,
          image,
          image_gallery,
          imageGallery,
          stock_count,
          stockCount,
          availability,
          product_type,
          variants,
        } = req.body || {};

        if (!name || typeof name !== 'string' || !name.trim()) {
          res.status(400).json({ error: 'Product name is required.' });
          return;
        }
        if (!brand || typeof brand !== 'string' || !brand.trim()) {
          res.status(400).json({ error: 'Product brand is required.' });
          return;
        }
        if (!category || typeof category !== 'string' || !category.trim()) {
          res.status(400).json({ error: 'Product category is required.' });
          return;
        }

        const numericPrice = Number(price);
        if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
          res.status(400).json({ error: 'Price must be a positive number.' });
          return;
        }

        const rawOriginalPrice =
          original_price !== undefined ? original_price : originalPrice;
        let validOriginalPrice: number | null = null;
        let discountPercent: number | null = null;
        let isOnSale = false;

        if (
          rawOriginalPrice !== undefined &&
          rawOriginalPrice !== null &&
          rawOriginalPrice !== ''
        ) {
          const parsedOrig = Number(rawOriginalPrice);
          if (!Number.isFinite(parsedOrig) || parsedOrig <= numericPrice) {
            res.status(400).json({
              error:
                'Original reference price (MRP) must be strictly greater than the current selling price.',
            });
            return;
          }
          validOriginalPrice = Math.round(parsedOrig);
          discountPercent = Math.round(
            ((validOriginalPrice - numericPrice) / validOriginalPrice) * 100
          );
          isOnSale = true;
        }

        let safeImage = '';
        if (typeof image === 'string' && image.trim().length > 0) {
          const trimmedImg = image.trim();
          if (trimmedImg.startsWith('data:image/')) {
            safeImage = validateAndBuildImageDataUri(trimmedImg);
          } else {
            safeImage = validateAndNormalizeExternalUrl(trimmedImg);
          }
        }

        const rawGallery = image_gallery || imageGallery;
        const safeGallery: ProductImageGalleryItem[] = [];
        if (Array.isArray(rawGallery)) {
          for (const item of rawGallery) {
            if (item && typeof item.url === 'string' && item.url.trim()) {
              const u = item.url.trim().startsWith('data:image/')
                ? validateAndBuildImageDataUri(item.url.trim())
                : validateAndNormalizeExternalUrl(item.url.trim());
              safeGallery.push({
                url: u,
                viewType: item.viewType || item.angle || 'front',
                label: item.label || item.alt || name.trim(),
                variantId: item.variantId,
              });
            }
          }
        }

        const resolvedStock =
          stock_count !== undefined
            ? Math.max(0, Math.floor(Number(stock_count)))
            : stockCount !== undefined
              ? Math.max(0, Math.floor(Number(stockCount)))
              : 25;

        const prodId =
          typeof id === 'string' && id.trim().length > 0
            ? id.trim().replace(/[^a-zA-Z0-9_-]/g, '-')
            : `${category.trim().toLowerCase().slice(0, 6)}-${randomUUID().slice(0, 8)}`;

        const newProduct: Product = {
          id: prodId,
          name: name.trim(),
          brand: brand.trim(),
          category: category.trim().toLowerCase(),
          price: Math.round(numericPrice),
          original_price: validOriginalPrice,
          discount_percent: discountPercent,
          is_on_sale: isOnSale,
          sale_start_at: sale_start_at || null,
          sale_end_at: sale_end_at || null,
          is_archived: false,
          currency: 'INR',
          rating: 0,
          review_count: 0,
          description: (description || name).trim(),
          features: Array.isArray(features)
            ? features.map(String).filter(Boolean)
            : [],
          specifications:
            specifications && typeof specifications === 'object'
              ? specifications
              : {},
          use_cases: Array.isArray(use_cases || useCases)
            ? (use_cases || useCases).map(String).filter(Boolean)
            : [],
          image: safeImage,
          image_gallery: safeGallery.length > 0 ? safeGallery : undefined,
          availability:
            availability !== undefined ? Boolean(availability) && resolvedStock > 0 : resolvedStock > 0,
          stock_count: resolvedStock,
          product_type: product_type || category.trim().toLowerCase(),
        };

        productRepo.upsert(newProduct);

        if (Array.isArray(variants) && productRepo.upsertVariant) {
          for (const v of variants) {
            if (v && v.label) {
              productRepo.upsertVariant({
                id: v.id || `${prodId}-var-${randomUUID().slice(0, 6)}`,
                productId: prodId,
                sku: v.sku || `${prodId.toUpperCase()}-${randomUUID().slice(0, 4)}`,
                label: String(v.label),
                size: v.size ? String(v.size) : undefined,
                sizeSystem: v.sizeSystem,
                color: v.color ? String(v.color) : undefined,
                storageOrModel: v.storageOrModel,
                price: Number(v.price) || newProduct.price,
                originalPrice: v.originalPrice ? Number(v.originalPrice) : validOriginalPrice || undefined,
                stockCount: v.stockCount !== undefined ? Math.max(0, Number(v.stockCount)) : 10,
                availability: (v.stockCount ?? 10) > 0,
                image: v.image,
                isDefault: Boolean(v.isDefault),
              });
            }
          }
        }

        const created = productRepo.findById(prodId, { includeArchived: true });
        res.status(201).json(created);
      } catch (error) {
        handleDomainError(res, error, 'Failed to create product');
      }
    }
  );

  /**
   * PUT /api/admin/products/:id
   * Updates an existing product (pricing, discount, inventory, images, specifications)
   */
  router.put(
    '/admin/products/:id',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const prodId = Array.isArray(req.params.id)
          ? req.params.id[0]
          : req.params.id;
        const existing = productRepo.findById(prodId, { includeArchived: true });
        if (!existing) {
          res.status(404).json({ error: `Product '${prodId}' not found.` });
          return;
        }

        const body = req.body || {};
        const nextPrice =
          body.price !== undefined ? Math.round(Number(body.price)) : existing.price;
        if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
          res.status(400).json({ error: 'Price must be a positive number.' });
          return;
        }

        const rawOrig =
          body.original_price !== undefined
            ? body.original_price
            : body.originalPrice !== undefined
              ? body.originalPrice
              : existing.original_price;

        let nextOrigPrice: number | null = null;
        let nextDiscountPct: number | null = null;
        let nextIsOnSale = false;

        if (rawOrig !== null && rawOrig !== undefined && rawOrig !== '') {
          const parsedOrig = Number(rawOrig);
          if (!Number.isFinite(parsedOrig) || parsedOrig <= nextPrice) {
            res.status(400).json({
              error:
                'Original reference price (MRP) must be strictly greater than the current selling price.',
            });
            return;
          }
          nextOrigPrice = Math.round(parsedOrig);
          nextDiscountPct = Math.round(
            ((nextOrigPrice - nextPrice) / nextOrigPrice) * 100
          );
          nextIsOnSale = body.is_on_sale !== false;
        }

        let nextImage = existing.image;
        if (body.image !== undefined) {
          const trimmedImg = String(body.image || '').trim();
          if (!trimmedImg) {
            nextImage = '';
          } else if (trimmedImg.startsWith('data:image/')) {
            nextImage = validateAndBuildImageDataUri(trimmedImg);
          } else {
            nextImage = validateAndNormalizeExternalUrl(trimmedImg);
          }
        }

        const rawStock =
          body.stock_count !== undefined
            ? body.stock_count
            : body.stockCount !== undefined
              ? body.stockCount
              : existing.stock_count ?? 25;
        const nextStock = Math.max(0, Math.floor(Number(rawStock)));
        const nextAvail =
          body.availability !== undefined
            ? Boolean(body.availability) && nextStock > 0
            : nextStock > 0;

        const updatedProduct: Product = {
          ...existing,
          name: body.name !== undefined ? String(body.name).trim() : existing.name,
          brand: body.brand !== undefined ? String(body.brand).trim() : existing.brand,
          category:
            body.category !== undefined
              ? String(body.category).trim().toLowerCase()
              : existing.category,
          price: nextPrice,
          original_price: nextOrigPrice,
          discount_percent: nextDiscountPct,
          is_on_sale: nextIsOnSale,
          sale_start_at:
            body.sale_start_at !== undefined
              ? body.sale_start_at
              : existing.sale_start_at,
          sale_end_at:
            body.sale_end_at !== undefined
              ? body.sale_end_at
              : existing.sale_end_at,
          is_archived:
            body.is_archived !== undefined
              ? Boolean(body.is_archived)
              : existing.is_archived,
          description:
            body.description !== undefined
              ? String(body.description).trim()
              : existing.description,
          features: Array.isArray(body.features)
            ? body.features.map(String).filter(Boolean)
            : existing.features,
          specifications:
            body.specifications && typeof body.specifications === 'object'
              ? body.specifications
              : existing.specifications,
          use_cases: Array.isArray(body.use_cases || body.useCases)
            ? (body.use_cases || body.useCases).map(String).filter(Boolean)
            : existing.use_cases,
          image: nextImage,
          image_gallery: Array.isArray(body.image_gallery || body.imageGallery)
            ? body.image_gallery || body.imageGallery
            : existing.image_gallery,
          stock_count: nextStock,
          availability: nextAvail,
        };

        productRepo.upsert(updatedProduct);

        // If stock was replenished (> 0), mark any Subscribed restock notifications as EligibleForNotification
        if (nextStock > 0 && nextAvail) {
          productRequestService.markRestockEligible(prodId);
        }

        const refreshed = productRepo.findById(prodId, { includeArchived: true });
        res.json(refreshed);
      } catch (error) {
        handleDomainError(res, error, 'Failed to update product');
      }
    }
  );

  /**
   * PATCH /api/admin/products/:id/archive
   * Soft-deletes (archives) or restores a product without breaking historical orders
   */
  router.patch(
    '/admin/products/:id/archive',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const prodId = Array.isArray(req.params.id)
          ? req.params.id[0]
          : req.params.id;
        const isArchived = req.body?.isArchived !== false;
        const ok = productRepo.setArchived
          ? productRepo.setArchived(prodId, isArchived)
          : null;
        if (!ok) {
          res.status(404).json({ error: `Product '${prodId}' not found.` });
          return;
        }
        const refreshed = productRepo.findById(prodId, { includeArchived: true });
        res.json(refreshed);
      } catch (error) {
        handleDomainError(res, error, 'Failed to archive/unarchive product');
      }
    }
  );

  /**
   * POST /api/admin/products/:id/images
   * Uploads or attaches a verified image (base64 JPEG/PNG/WebP <= 5MB or SSRF-checked HTTPS URL)
   * to a product's gallery and/or primary image.
   */
  router.post(
    '/admin/products/:id/images',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const prodId = Array.isArray(req.params.id)
          ? req.params.id[0]
          : req.params.id;
        const existing = productRepo.findById(prodId, { includeArchived: true });
        if (!existing) {
          res.status(404).json({ error: `Product '${prodId}' not found.` });
          return;
        }

        const { imageData, mimeType, url, angle, viewType, alt, label, isPrimary, variantId } =
          req.body || {};

        let resolvedUrl = '';
        if (typeof imageData === 'string' && imageData.trim().length > 0) {
          resolvedUrl = validateAndBuildImageDataUri(imageData, mimeType);
        } else if (typeof url === 'string' && url.trim().length > 0) {
          resolvedUrl = validateAndNormalizeExternalUrl(url);
        } else {
          res.status(400).json({
            error:
              'Either imageData (base64 JPEG/PNG/WebP) or a valid public HTTPS url is required.',
          });
          return;
        }

        const validAngles = ['front', 'back', 'side', 'closeup', 'lifestyle'] as const;
        const rawAngle = viewType || angle;
        const chosenAngle = validAngles.includes(rawAngle) ? rawAngle : 'front';

        const currentGallery: ProductImageGalleryItem[] = Array.isArray(
          existing.image_gallery
        )
          ? [...existing.image_gallery]
          : [];

        const makePrimary = Boolean(isPrimary) || !existing.image;

        currentGallery.push({
          url: resolvedUrl,
          viewType: chosenAngle,
          label: (label || alt || `${existing.name} (${chosenAngle})`).trim(),
          variantId: variantId || undefined,
        });

        productRepo.upsert({
          ...existing,
          image: makePrimary ? resolvedUrl : existing.image,
          image_gallery: currentGallery,
        });

        const refreshed = productRepo.findById(prodId, { includeArchived: true });
        res.status(201).json(refreshed);
      } catch (error) {
        handleDomainError(res, error, 'Failed to upload or attach product image');
      }
    }
  );

  /**
   * POST /api/admin/products/:id/variants
   * Creates or updates a size/colour variant for a product
   */
  router.post(
    '/admin/products/:id/variants',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const prodId = Array.isArray(req.params.id)
          ? req.params.id[0]
          : req.params.id;
        const existing = productRepo.findById(prodId, { includeArchived: true });
        if (!existing) {
          res.status(404).json({ error: `Product '${prodId}' not found.` });
          return;
        }

        const v = req.body || {};
        if (!v.label && !v.size && !v.color) {
          res.status(400).json({
            error: 'Variant must specify at least a size, colour, or label.',
          });
          return;
        }

        const stockCount =
          v.stockCount !== undefined ? Math.max(0, Math.floor(Number(v.stockCount))) : 10;
        const variantId =
          v.id ||
          `${prodId}-var-${[v.size, v.color]
            .filter(Boolean)
            .join('-')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-') || randomUUID().slice(0, 6)}`;

        if (!productRepo.upsertVariant) {
          res.status(500).json({ error: 'Variant repository method unavailable.' });
          return;
        }

        const savedVariant = productRepo.upsertVariant({
          id: variantId,
          productId: prodId,
          sku: v.sku || `${prodId.toUpperCase()}-${randomUUID().slice(0, 4)}`,
          label:
            v.label ||
            [v.size, v.color].filter(Boolean).join(' · ') ||
            'Standard Variant',
          size: v.size ? String(v.size).trim() : undefined,
          sizeSystem: v.sizeSystem,
          color: v.color ? String(v.color).trim() : undefined,
          storageOrModel: v.storageOrModel,
          price: v.price !== undefined ? Math.round(Number(v.price)) : existing.price,
          originalPrice:
            v.originalPrice !== undefined ? Math.round(Number(v.originalPrice)) : undefined,
          stockCount,
          availability: v.availability !== undefined ? Boolean(v.availability) && stockCount > 0 : stockCount > 0,
          image: v.image || existing.image,
          isDefault: Boolean(v.isDefault),
        });

        if (savedVariant.stockCount > 0 && savedVariant.availability) {
          productRequestService.markRestockEligible(prodId, savedVariant.id);
        }

        res.status(201).json(savedVariant);
      } catch (error) {
        handleDomainError(res, error, 'Failed to save product variant');
      }
    }
  );

  /**
   * DELETE /api/admin/variants/:variantId
   * Deletes a product variant
   */
  router.delete(
    '/admin/variants/:variantId',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const variantId = Array.isArray(req.params.variantId)
          ? req.params.variantId[0]
          : req.params.variantId;
        const deleted = productRepo.deleteVariant
          ? productRepo.deleteVariant(variantId)
          : false;
        if (!deleted) {
          res.status(404).json({ error: `Variant '${variantId}' not found.` });
          return;
        }
        res.json({ success: true });
      } catch (error) {
        handleDomainError(res, error, 'Failed to delete variant');
      }
    }
  );

  /**
   * GET /api/admin/coupons
   * Lists all coupons (including inactive/expired) for admin management
   */
  router.get(
    '/admin/coupons',
    authService.requireAdmin,
    (_req: AuthenticatedRequest, res: Response) => {
      try {
        res.json(cartOrderService.listCoupons(true));
      } catch (error) {
        handleDomainError(res, error, 'Failed to list coupons');
      }
    }
  );

  /**
   * POST /api/admin/coupons
   * Creates or updates a coupon code
   */
  router.post(
    '/admin/coupons',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const coupon = cartOrderService.upsertCoupon(req.body || {});
        res.status(201).json(coupon);
      } catch (error) {
        handleDomainError(res, error, 'Failed to save coupon');
      }
    }
  );

  /**
   * GET /api/admin/orders
   * Lists all orders across the marketplace
   */
  router.get(
    '/admin/orders',
    authService.requireAdmin,
    (_req: AuthenticatedRequest, res: Response) => {
      try {
        res.json(cartOrderService.listAllOrdersForAdmin());
      } catch (error) {
        handleDomainError(res, error, 'Failed to list marketplace orders');
      }
    }
  );

  /**
   * PATCH /api/admin/orders/:orderId/status
   * Updates any order's status as administrator
   */
  router.patch(
    '/admin/orders/:orderId/status',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const orderId = Array.isArray(req.params.orderId)
          ? req.params.orderId[0]
          : req.params.orderId;
        const { status, note, sessionId } = req.body || {};
        const updated = cartOrderService.updateOrderStatus(
          sessionId || 'admin_override',
          orderId,
          status as OrderStatus,
          note,
          req.authUser
        );
        res.json(updated);
      } catch (error) {
        handleDomainError(res, error, 'Failed to update order status');
      }
    }
  );

  /**
   * GET /api/admin/reviews
   * Lists all customer reviews for moderation
   */
  router.get(
    '/admin/reviews',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const statusFilter =
          typeof req.query.status === 'string'
            ? (req.query.status as ReviewModerationStatus)
            : undefined;
        res.json(reviewService.listAllReviewsForAdmin(statusFilter));
      } catch (error) {
        handleDomainError(res, error, 'Failed to list reviews for moderation');
      }
    }
  );

  /**
   * PATCH /api/admin/reviews/:reviewId/status
   * Moderates a customer review (published, pending, rejected, flagged)
   */
  router.patch(
    '/admin/reviews/:reviewId/status',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const reviewId = Array.isArray(req.params.reviewId)
          ? req.params.reviewId[0]
          : req.params.reviewId;
        const { moderationStatus, status, moderationNote } = req.body || {};
        const updated = reviewService.moderateReview(
          reviewId,
          (moderationStatus || status) as ReviewModerationStatus,
          moderationNote
        );
        res.json(updated);
      } catch (error) {
        handleDomainError(res, error, 'Failed to moderate review');
      }
    }
  );

  /**
   * GET /api/admin/product-requests
   * Lists all missing-product requests submitted by customers
   */
  router.get(
    '/admin/product-requests',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const status =
          typeof req.query.status === 'string'
            ? (req.query.status as ProductRequestStatus)
            : undefined;
        const search =
          typeof req.query.search === 'string' ? req.query.search : undefined;
        res.json(
          productRequestService.listAllProductRequestsForAdmin({ status, search })
        );
      } catch (error) {
        handleDomainError(res, error, 'Failed to list product requests');
      }
    }
  );

  /**
   * PATCH /api/admin/product-requests/:requestId
   * Updates status, admin notes, or linkedProductId for a product request
   */
  router.patch(
    '/admin/product-requests/:requestId',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const requestId = Array.isArray(req.params.requestId)
          ? req.params.requestId[0]
          : req.params.requestId;
        const { status, linkedProductId, adminNotes } = req.body || {};
        const updated = productRequestService.updateProductRequestByAdmin(
          requestId,
          {
            status,
            linkedProductId,
            adminNotes,
          }
        );
        res.json(updated);
      } catch (error) {
        handleDomainError(res, error, 'Failed to update product request');
      }
    }
  );

  /**
   * POST /api/admin/product-requests/:requestId/promote
   * Promotes a reviewed product request directly into a live catalogue product
   */
  router.post(
    '/admin/product-requests/:requestId/promote',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const requestId = Array.isArray(req.params.requestId)
          ? req.params.requestId[0]
          : req.params.requestId;
        const result = productRequestService.promoteRequestToCatalogueProduct(
          requestId,
          req.body || {}
        );
        res.status(201).json(result);
      } catch (error) {
        handleDomainError(
          res,
          error,
          'Failed to promote product request to catalogue'
        );
      }
    }
  );

  /**
   * GET /api/admin/restock-subscriptions
   * Lists all customer restock subscriptions
   */
  router.get(
    '/admin/restock-subscriptions',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const status =
          typeof req.query.status === 'string'
            ? (req.query.status as RestockSubscriptionStatus)
            : undefined;
        res.json(
          productRequestService.listAllRestockSubscriptionsForAdmin(status)
        );
      } catch (error) {
        handleDomainError(res, error, 'Failed to list restock subscriptions');
      }
    }
  );

  /**
   * PATCH /api/admin/restock-subscriptions/:subscriptionId
   * Updates a restock subscription status (Subscribed, EligibleForNotification, Notified, Cancelled)
   */
  router.patch(
    '/admin/restock-subscriptions/:subscriptionId',
    authService.requireAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const subscriptionId = Array.isArray(req.params.subscriptionId)
          ? req.params.subscriptionId[0]
          : req.params.subscriptionId;
        const { status } = req.body || {};
        const updated = productRequestService.updateRestockSubscriptionByAdmin(
          subscriptionId,
          status as RestockSubscriptionStatus
        );
        res.json(updated);
      } catch (error) {
        handleDomainError(res, error, 'Failed to update restock subscription');
      }
    }
  );

  return router;
}
