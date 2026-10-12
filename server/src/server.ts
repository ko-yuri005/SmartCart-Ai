import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.routes.js';
import { createChatRouter } from './routes/chat.routes.js';
import { createProductRouter } from './routes/products.routes.js';
import { createCartOrderRouter } from './routes/cart-order.routes.js';
import { createVisualSearchRouter } from './routes/visual-search.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createMarketplaceRouter } from './routes/marketplace.routes.js';
import { getDatabase } from './db/database.js';
import { runSeed } from './db/seed.js';
import { SqliteProductRepository } from './db/repositories/product.repository.js';
import { SqliteSessionRepository } from './db/repositories/session.repository.js';
import { SqliteOfferRepository } from './db/repositories/offer.repository.js';
import { FilterService } from './services/filter.service.js';
import { RankingService } from './services/ranking.service.js';
import { RelaxationService } from './services/relaxation.service.js';
import { AlternativesService } from './services/alternatives.service.js';
import { ComparisonService } from './services/comparison.service.js';
import { SecurityService } from './services/security.service.js';
import { GeminiService } from './services/gemini.service.js';
import { ContextService } from './services/context.service.js';
import { PriceComparisonService } from './services/price-comparison.service.js';
import { CartOrderService } from './services/cart-order.service.js';
import { VisualSearchService } from './services/visual-search.service.js';
import { ShoppingAssistantService } from './services/shopping-assistant.service.js';
import { AuthService } from './services/auth.service.js';
import { ReviewService } from './services/review.service.js';
import { ProductRequestService } from './services/product-request.service.js';

export const app = express();

// Trust first reverse proxy hop (Vercel rewrite proxy, Render, or Railway load balancer)
// so req.ip and Secure cookies work accurately in production.
app.set('trust proxy', 1);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin requests, server-to-server/proxy requests (no Origin header),
      // or all origins when CORS_ALLOWED_ORIGINS is not explicitly restricted.
      if (!origin || env.CORS_ALLOWED_ORIGINS.length === 0) {
        callback(null, true);
        return;
      }
      if (
        env.CORS_ALLOWED_ORIGINS.includes('*') ||
        env.CORS_ALLOWED_ORIGINS.includes(origin) ||
        env.CORS_ALLOWED_ORIGINS.some(
          (allowed) => allowed.startsWith('*.') && origin.endsWith(allowed.slice(1))
        )
      ) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  })
);
app.use(express.json({ limit: '10mb' }));

// Return structured JSON on oversized payloads (413) or malformed JSON (400)
app.use(
  (
    err: Error & { status?: number; statusCode?: number; type?: string },
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (err?.type === 'entity.too.large' || err?.status === 413 || err?.statusCode === 413) {
      res.status(413).json({
        error: 'Uploaded payload exceeds the maximum allowed size (5 MB image limit). Please choose a smaller photo.',
        code: 'IMAGE_TOO_LARGE',
      });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({
        error: 'Invalid JSON request body.',
        code: 'INVALID_JSON',
      });
      return;
    }
    next(err);
  }
);

// Initialize database and repositories
const db = getDatabase();
export const productRepo = new SqliteProductRepository(db);
export const sessionRepo = new SqliteSessionRepository(db);
export const offerRepo = new SqliteOfferRepository(db);

// Initialize domain services
const filterService = new FilterService(productRepo);
const rankingService = new RankingService();
const relaxationService = new RelaxationService(filterService, rankingService);
const alternativesService = new AlternativesService(productRepo, filterService);
const comparisonService = new ComparisonService(productRepo);
const securityService = new SecurityService();
const geminiService = new GeminiService();
const contextService = new ContextService(productRepo);
export const authService = new AuthService(db);
export const reviewService = new ReviewService(productRepo, db);
export const productRequestService = new ProductRequestService(productRepo, db);
export const priceComparisonService = new PriceComparisonService(productRepo, offerRepo);
export const cartOrderService = new CartOrderService(productRepo, db, priceComparisonService);
export const visualSearchService = new VisualSearchService(
  productRepo,
  sessionRepo,
  geminiService,
  priceComparisonService
);

// Ensure variants and sale metadata are present on existing DB
try {
  if (productRepo.count() > 0) {
    productRepo.seedMarketplaceCatalogueEnhancements();
  }
} catch {
  // Ignore if DB not seeded yet
}

// Initialize pipeline orchestrator
export const shoppingAssistantService = new ShoppingAssistantService(
  productRepo,
  sessionRepo,
  filterService,
  rankingService,
  relaxationService,
  alternativesService,
  comparisonService,
  securityService,
  geminiService,
  contextService,
  {},
  priceComparisonService,
  cartOrderService
);

// Populate req.authUser from Bearer token or HttpOnly session cookie (with CSRF check on cookie mutations)
app.use('/api', authService.authenticateMiddleware);

// Mount API routes
app.use('/api', healthRouter);
app.use('/api', createAuthRouter(authService, cartOrderService));
app.use('/api', createChatRouter(shoppingAssistantService, sessionRepo));
app.use('/api', createProductRouter(productRepo, comparisonService, alternativesService, priceComparisonService));
app.use('/api', createCartOrderRouter(cartOrderService));
app.use('/api', createVisualSearchRouter(visualSearchService));
app.use(
  '/api',
  createMarketplaceRouter(
    productRepo,
    authService,
    cartOrderService,
    reviewService,
    productRequestService
  )
);

// Root greeting / status
app.get('/', (req, res) => {
  res.json({
    name: 'Mini Shopping Assistant API',
    status: 'running',
    endpoints: {
      health: '/api/health',
      authRegister: 'POST /api/auth/register',
      authLogin: 'POST /api/auth/login',
      authLogout: 'POST /api/auth/logout',
      authMe: 'GET /api/auth/me',
      chat: 'POST /api/chat',
      chatHistory: 'GET /api/chat/history/:sessionId',
      visualSearch: 'POST /api/visual-search',
      products: 'GET /api/products',
      productMeta: 'GET /api/products/meta',
      productDetails: 'GET /api/products/:id',
      productReviews: 'GET /api/products/:id/reviews',
      productOffers: 'GET /api/products/:id/offers',
      productOffersRefresh: 'POST /api/products/:id/offers/refresh',
      productBestOffer: 'GET /api/products/:id/offers/best',
      productPurchaseLinks: 'GET /api/products/:id/purchase-links',
      productCompare: 'POST /api/products/compare',
      coupons: 'GET /api/coupons',
      cart: 'GET /api/cart/:sessionId',
      cartAddItem: 'POST /api/cart/items',
      cartUpdateQuantity: 'PATCH /api/cart/items',
      cartApplyCoupon: 'POST /api/cart/coupon',
      checkout: 'POST /api/orders/checkout',
      orders: 'GET /api/orders/:sessionId',
      orderDetail: 'GET /api/orders/:sessionId/:orderId',
      restockSubscriptions: 'POST /api/restock-subscriptions',
      productRequests: 'POST /api/product-requests',
      adminSummary: 'GET /api/admin/summary',
      account: 'GET /api/account/:sessionId',
    },
  });
});

export function startServer(port = env.PORT) {
  // Ensure DB is seeded and synced with SEED_PRODUCTS on boot
  runSeed(false);

  return app.listen(port, () => {
    console.log(`[Server] Shopping Assistant API listening on http://localhost:${port}`);
    console.log(`[Server] Health endpoint: http://localhost:${port}/api/health`);
  });
}

// Start if executed directly
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  startServer();
}
