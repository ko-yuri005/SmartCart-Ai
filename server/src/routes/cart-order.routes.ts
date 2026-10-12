import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../services/auth.service.js';
import {
  CartOrderService,
  CartValidationError,
} from '../services/cart-order.service.js';
import { OrderStatus } from '../types/index.js';

export function createCartOrderRouter(
  cartOrderService: CartOrderService
): Router {
  const router = Router();

  const handleServiceError = (res: Response, error: unknown, defaultMsg: string) => {
    if (error instanceof CartValidationError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
      return;
    }
    console.error('[CartOrderAPI] Unexpected error:', error);
    res.status(500).json({ error: defaultMsg });
  };

  /**
   * GET /api/coupons
   * Returns active promo coupons available in the marketplace
   */
  router.get('/coupons', (_req: Request, res: Response) => {
    try {
      const coupons = cartOrderService.listCoupons(false);
      res.json(coupons);
    } catch (error) {
      handleServiceError(res, error, 'Failed to retrieve active coupons');
    }
  });

  /**
   * GET /api/cart/:sessionId
   * Retrieves the current cart and server-calculated pricing breakdown
   */
  router.get('/cart/:sessionId', (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessionId = Array.isArray(req.params.sessionId)
        ? req.params.sessionId[0]
        : req.params.sessionId;
      const cart = cartOrderService.getCart(sessionId, req.authUser?.id ?? null);
      res.json(cart);
    } catch (error) {
      handleServiceError(res, error, 'Failed to retrieve shopping cart');
    }
  });

  /**
   * POST /api/cart/items
   * Adds a product (and optional variant) to the session's cart with server-side quantity & stock validation
   */
  router.post('/cart/items', (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        sessionId,
        productId,
        quantity,
        variantId,
        selectedSize,
        selectedColor,
      } = req.body || {};
      const parsedQty = quantity !== undefined ? Number(quantity) : 1;
      const cart = cartOrderService.addItem(sessionId, productId, parsedQty, {
        variantId,
        selectedSize,
        selectedColor,
        userId: req.authUser?.id ?? null,
      });
      res.json(cart);
    } catch (error) {
      handleServiceError(res, error, 'Failed to add item to cart');
    }
  });

  /**
   * PATCH /api/cart/items
   * Updates quantity for a specific product/variant in the cart (quantity = 0 removes it)
   */
  router.patch('/cart/items', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId, productId, quantity, variantId } = req.body || {};
      const parsedQty = Number(quantity);
      const cart = cartOrderService.updateItemQuantity(
        sessionId,
        productId,
        parsedQty,
        variantId
      );
      res.json(cart);
    } catch (error) {
      handleServiceError(res, error, 'Failed to update cart item quantity');
    }
  });

  /**
   * DELETE /api/cart/:sessionId/items/:productId
   * Removes a specific item (and optional variant) from the cart
   */
  router.delete(
    '/cart/:sessionId/items/:productId',
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const sessionId = Array.isArray(req.params.sessionId)
          ? req.params.sessionId[0]
          : req.params.sessionId;
        const productId = Array.isArray(req.params.productId)
          ? req.params.productId[0]
          : req.params.productId;
        const variantId =
          typeof req.query.variantId === 'string'
            ? req.query.variantId
            : req.body?.variantId;
        const cart = cartOrderService.removeItem(sessionId, productId, variantId);
        res.json(cart);
      } catch (error) {
        handleServiceError(res, error, 'Failed to remove item from cart');
      }
    }
  );

  /**
   * DELETE /api/cart/:sessionId
   * Clears all items from the session's cart
   */
  router.delete('/cart/:sessionId', (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessionId = Array.isArray(req.params.sessionId)
        ? req.params.sessionId[0]
        : req.params.sessionId;
      const cart = cartOrderService.clearCart(sessionId);
      res.json(cart);
    } catch (error) {
      handleServiceError(res, error, 'Failed to clear cart');
    }
  });

  /**
   * POST /api/cart/coupon
   * Applies or clears a coupon code with full eligibility & usage-limit validation
   */
  router.post('/cart/coupon', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId, couponCode } = req.body || {};
      const cart = cartOrderService.applyCoupon(
        sessionId,
        couponCode ?? null,
        req.authUser?.id ?? null
      );
      res.json(cart);
    } catch (error) {
      handleServiceError(res, error, 'Failed to apply coupon code');
    }
  });

  /**
   * POST /api/orders/checkout
   * Creates an order after strict server-side validation and duplicate submission checks
   */
  router.post('/orders/checkout', (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        sessionId,
        idempotencyKey,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        paymentMethod,
        couponCode,
        notes,
      } = req.body || {};

      const order = cartOrderService.createOrder({
        sessionId,
        userId: req.authUser?.id ?? null,
        idempotencyKey,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        paymentMethod,
        couponCode,
        notes,
      });

      res.status(order.duplicatePrevented ? 200 : 201).json(order);
    } catch (error) {
      handleServiceError(res, error, 'Failed to process checkout');
    }
  });

  /**
   * GET /api/orders/:sessionId
   * Lists order history for the session (and authenticated user if signed in)
   */
  router.get('/orders/:sessionId', (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessionId = Array.isArray(req.params.sessionId)
        ? req.params.sessionId[0]
        : req.params.sessionId;
      const orders = cartOrderService.getOrdersBySession(
        sessionId,
        req.authUser
      );
      res.json(orders);
    } catch (error) {
      handleServiceError(res, error, 'Failed to retrieve order history');
    }
  });

  /**
   * GET /api/orders/:sessionId/:orderId
   * Retrieves details and status history for a specific order with ownership check
   */
  router.get('/orders/:sessionId/:orderId', (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessionId = Array.isArray(req.params.sessionId)
        ? req.params.sessionId[0]
        : req.params.sessionId;
      const orderId = Array.isArray(req.params.orderId)
        ? req.params.orderId[0]
        : req.params.orderId;

      const order = cartOrderService.getOrderById(
        sessionId,
        orderId,
        req.authUser
      );
      if (!order) {
        res.status(404).json({ error: `Order '${orderId}' not found` });
        return;
      }
      res.json(order);
    } catch (error) {
      handleServiceError(res, error, 'Failed to retrieve order details');
    }
  });

  /**
   * PATCH /api/orders/:sessionId/:orderId/status
   * Updates order status (Pending -> Confirmed -> Processing -> Shipped -> Delivered, or Cancelled)
   */
  router.patch(
    '/orders/:sessionId/:orderId/status',
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const sessionId = Array.isArray(req.params.sessionId)
          ? req.params.sessionId[0]
          : req.params.sessionId;
        const orderId = Array.isArray(req.params.orderId)
          ? req.params.orderId[0]
          : req.params.orderId;
        const { status, note } = req.body || {};

        const updated = cartOrderService.updateOrderStatus(
          sessionId,
          orderId,
          status as OrderStatus,
          note,
          req.authUser
        );
        res.json(updated);
      } catch (error) {
        handleServiceError(res, error, 'Failed to update order status');
      }
    }
  );

  /**
   * GET /api/account/:sessionId
   * Retrieves saved account profile and shopping preferences for the session
   */
  router.get('/account/:sessionId', (req: Request, res: Response) => {
    try {
      const sessionId = Array.isArray(req.params.sessionId)
        ? req.params.sessionId[0]
        : req.params.sessionId;
      const profile = cartOrderService.getAccountProfile(sessionId);
      res.json(profile);
    } catch (error) {
      handleServiceError(res, error, 'Failed to retrieve account profile');
    }
  });

  /**
   * PUT /api/account/:sessionId
   * Updates saved account profile and shopping preferences
   */
  router.put('/account/:sessionId', (req: Request, res: Response) => {
    try {
      const sessionId = Array.isArray(req.params.sessionId)
        ? req.params.sessionId[0]
        : req.params.sessionId;
      const profile = cartOrderService.updateAccountProfile(
        sessionId,
        req.body || {}
      );
      res.json(profile);
    } catch (error) {
      handleServiceError(res, error, 'Failed to update account profile');
    }
  });

  return router;
}
