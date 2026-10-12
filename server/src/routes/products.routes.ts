import { Router, Request, Response } from 'express';
import { IProductRepository } from '../db/repositories/product.repository.js';
import { ComparisonService } from '../services/comparison.service.js';
import { AlternativesService } from '../services/alternatives.service.js';
import { PriceComparisonService } from '../services/price-comparison.service.js';

export function createProductRouter(
  productRepo: IProductRepository,
  comparisonService: ComparisonService,
  alternativesService?: AlternativesService,
  priceComparisonService?: PriceComparisonService
): Router {
  const router = Router();

  const validateProductIdParam = (req: Request, res: Response): string | null => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!rawId || typeof rawId !== 'string' || rawId.trim().length === 0) {
      res.status(400).json({ error: 'Product ID is required' });
      return null;
    }
    const trimmed = rawId.trim();
    if (trimmed.length > 120 || !/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      res.status(400).json({ error: 'Invalid Product ID format' });
      return null;
    }
    return trimmed;
  };

  /**
   * GET /api/products
   * Filter and list catalogue products
   */
  router.get('/products', (req: Request, res: Response) => {
    try {
      const category = typeof req.query.category === 'string' ? req.query.category.trim() : undefined;
      const brand = typeof req.query.brand === 'string' ? req.query.brand.trim() : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

      const rawMax = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
      const maxPrice = rawMax !== undefined && Number.isFinite(rawMax) && rawMax >= 0 ? rawMax : undefined;

      const rawMin = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
      const minPrice = rawMin !== undefined && Number.isFinite(rawMin) && rawMin >= 0 ? rawMin : undefined;

      const rawLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 500;
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 500;

      const rawOffset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
      const offset = rawOffset !== undefined && Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : undefined;

      const onSaleOnly = req.query.onSaleOnly === 'true' || req.query.onSale === 'true';
      const inStockOnly =
        req.query.inStockOnly === 'true'
          ? true
          : req.query.inStockOnly === 'false'
            ? false
            : undefined;
      const validSorts = ['featured', 'price_asc', 'price_desc', 'rating', 'discount_desc'] as const;
      const sortBy =
        typeof req.query.sortBy === 'string' && validSorts.includes(req.query.sortBy as any)
          ? (req.query.sortBy as (typeof validSorts)[number])
          : undefined;

      const products = productRepo.findMany({
        category,
        maxPrice,
        minPrice,
        brand,
        searchQuery: search,
        onSaleOnly: onSaleOnly || undefined,
        inStockOnly,
        sortBy,
        limit,
        offset,
      });

      const enriched = priceComparisonService
        ? priceComparisonService.enrichProductsWithPurchaseLinks(products)
        : products;

      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve products' });
    }
  });

  /**
   * GET /api/products/meta
   * Returns all distinct categories, brands, and total catalogue count
   */
  router.get('/products/meta', (_req: Request, res: Response) => {
    try {
      res.json({
        totalProducts: productRepo.count(),
        categories: productRepo.getAllCategories(),
        brands: productRepo.getAllBrands(),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve catalogue metadata' });
    }
  });

  /**
   * GET /api/products/:id/alternatives
   * Find closely matching alternatives for a product
   */
  router.get('/products/:id/alternatives', (req: Request, res: Response) => {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!rawId || typeof rawId !== 'string' || rawId.trim().length === 0) {
        res.status(400).json({ error: 'Product ID is required' });
        return;
      }

      if (!alternativesService) {
        res.status(501).json({ error: 'Alternatives service not available' });
        return;
      }

      const id = rawId.trim();
      const rawLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 4;
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 10) : 4;

      const result = alternativesService.findAlternatives(id, limit);
      if (!result) {
        res.status(404).json({ error: `Product with ID '${id}' not found` });
        return;
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve alternatives' });
    }
  });

  /**
   * GET /api/products/:id/offers
   * Retrieve cross-website price comparison offers and search fallback links for a product
   */
  router.get('/products/:id/offers', async (req: Request, res: Response) => {
    try {
      const id = validateProductIdParam(req, res);
      if (!id) return;

      if (!priceComparisonService) {
        res.status(501).json({ error: 'Price comparison service not available' });
        return;
      }

      const comparison = await priceComparisonService.getProductPriceComparison(id, {
        forceRefresh: false,
      });

      if (!comparison) {
        res.status(404).json({ error: `Product with ID '${id}' not found` });
        return;
      }

      res.json(comparison);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve retailer offers' });
    }
  });

  /**
   * POST /api/products/:id/offers/refresh
   * Refresh retailer offers when permitted by provider rate limits and per-product cooldown
   */
  router.post('/products/:id/offers/refresh', async (req: Request, res: Response) => {
    try {
      const id = validateProductIdParam(req, res);
      if (!id) return;

      if (!priceComparisonService) {
        res.status(501).json({ error: 'Price comparison service not available' });
        return;
      }

      const comparison = await priceComparisonService.getProductPriceComparison(id, {
        forceRefresh: true,
      });

      if (!comparison) {
        res.status(404).json({ error: `Product with ID '${id}' not found` });
        return;
      }

      if (
        comparison.providerStatus.rateLimited &&
        comparison.providerStatus.cooldownRemainingMs !== undefined
      ) {
        res.status(429).json({
          error:
            'Price refresh rate limit active. Please wait before requesting another live refresh.',
          cooldownRemainingMs: comparison.providerStatus.cooldownRemainingMs,
          data: comparison,
        });
        return;
      }

      res.json(comparison);
    } catch (error) {
      res.status(500).json({ error: 'Failed to refresh retailer offers' });
    }
  });

  /**
   * GET /api/products/:id/offers/best
   * Retrieve the current best verified offer (lowest total price including known shipping)
   */
  router.get('/products/:id/offers/best', async (req: Request, res: Response) => {
    try {
      const id = validateProductIdParam(req, res);
      if (!id) return;

      if (!priceComparisonService) {
        res.status(501).json({ error: 'Price comparison service not available' });
        return;
      }

      const comparison = await priceComparisonService.getProductPriceComparison(id, {
        forceRefresh: false,
      });

      if (!comparison) {
        res.status(404).json({ error: `Product with ID '${id}' not found` });
        return;
      }

      res.json({
        productId: comparison.productId,
        productName: comparison.productName,
        lowestVerifiedOffer: comparison.lowestVerifiedOffer,
        hasComparableVerifiedPrices: comparison.hasComparableVerifiedPrices,
        comparableOffersCount: comparison.comparableOffersCount,
        primaryPurchaseLink: comparison.purchaseLinks.primaryLink,
        retailerSearchLinks: comparison.purchaseLinks.retailerSearchLinks,
        honestStatusMessage: comparison.providerStatus.honestStatusMessage,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve best verified offer' });
    }
  });

  /**
   * GET /api/products/:id/purchase-links
   * Return primary purchase link and retailer search links for a product
   */
  router.get('/products/:id/purchase-links', (req: Request, res: Response) => {
    try {
      const id = validateProductIdParam(req, res);
      if (!id) return;

      if (!priceComparisonService) {
        res.status(501).json({ error: 'Price comparison service not available' });
        return;
      }

      const product = productRepo.findById(id);
      if (!product) {
        res.status(404).json({ error: `Product with ID '${id}' not found` });
        return;
      }

      const links = priceComparisonService.getPurchaseLinksForProduct(product);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve purchase links' });
    }
  });

  /**
   * GET /api/products/:id
   * Get single product specifications and details
   */
  router.get('/products/:id', (req: Request, res: Response) => {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!rawId || typeof rawId !== 'string' || rawId.trim().length === 0) {
        res.status(400).json({ error: 'Product ID is required' });
        return;
      }

      const id = rawId.trim();
      const product = productRepo.findById(id);

      if (!product) {
        res.status(404).json({ error: `Product with ID '${id}' not found` });
        return;
      }

      const enriched = priceComparisonService
        ? priceComparisonService.enrichProductWithPurchaseLinks(product)
        : product;

      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve product details' });
    }
  });

  /**
   * POST /api/products/compare
   * Returns side-by-side spec matrix for 2-4 products
   */
  router.post('/products/compare', (req: Request, res: Response) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({ error: 'Invalid request: Body must be a JSON object' });
        return;
      }

      const { productIds, useCases } = req.body;

      if (!Array.isArray(productIds)) {
        res.status(400).json({ error: 'productIds must be an array of product IDs' });
        return;
      }

      if (productIds.length < 2) {
        res.status(400).json({ error: 'Comparison requires at least 2 product IDs' });
        return;
      }

      if (productIds.length > 4) {
        res.status(400).json({ error: 'Comparison supports a maximum of 4 products at once' });
        return;
      }

      if (!productIds.every((id) => typeof id === 'string' && id.trim().length > 0)) {
        res.status(400).json({ error: 'All elements in productIds must be non-empty strings' });
        return;
      }

      const cleanProductIds = productIds.map((id) => (id as string).trim());
      const cleanUseCases = Array.isArray(useCases)
        ? useCases.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        : undefined;

      const result = comparisonService.compareProducts(cleanProductIds, cleanUseCases);
      if (!result.success) {
        res.status(400).json({ error: result.error, invalidIds: result.invalidIds });
        return;
      }

      const enrichedData = priceComparisonService
        ? {
            ...result.data,
            products: priceComparisonService.enrichProductsWithPurchaseLinks(
              result.data.products
            ),
          }
        : result.data;

      res.json(enrichedData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to execute product comparison' });
    }
  });

  return router;
}
