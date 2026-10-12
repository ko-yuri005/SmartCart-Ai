import { Product, ScoredProduct } from '../types/index.js';
import { IProductRepository } from '../db/repositories/product.repository.js';
import { FilterService } from './filter.service.js';

export interface AlternativeResult {
  targetProduct: Product;
  alternatives: {
    product: Product;
    similarityScore: number;
    priceDifference: number; // e.g. +100 or -200
    sharedUseCases: string[];
    sharedFeatures: string[];
    similarityReason: string;
  }[];
}

export interface AlternativesContextCriteria {
  maxPrice?: number;
  minPrice?: number;
  useCases?: string[];
}

export class AlternativesService {
  constructor(
    private productRepo: IProductRepository,
    private filterService: FilterService
  ) {}

  /**
   * Finds and ranks deterministic alternative products for a given reference product.
   * Guarantees that:
   * - The original product is excluded
   * - Same category is respected
   * - Active conversation budget (maxPrice/minPrice) and use cases are respected when available
   * - Only available products are returned
   * - Candidates are scored by use-case, feature, brand diversity, and price similarity
   */
  public findAlternatives(
    targetProductId: string,
    limit = 4,
    contextCriteria?: AlternativesContextCriteria
  ): AlternativeResult | null {
    const targetProduct = this.productRepo.findById(targetProductId);
    if (!targetProduct) {
      return null;
    }

    // 1. Fetch available products in the same category
    const categoryProducts = this.productRepo.findMany({
      category: targetProduct.category,
      inStockOnly: true,
      limit: 100,
    });

    // 2. Exclude the original product
    let otherProducts = categoryProducts.filter((p) => p.id !== targetProduct.id);

    if (otherProducts.length === 0) {
      return {
        targetProduct,
        alternatives: [],
      };
    }

    // 2b. Respect active conversation budget if candidates exist within budget
    if (contextCriteria?.maxPrice !== undefined) {
      const withinMax = otherProducts.filter((p) => p.price <= contextCriteria.maxPrice!);
      if (withinMax.length > 0) {
        otherProducts = withinMax;
      }
    }
    if (contextCriteria?.minPrice !== undefined) {
      const withinMin = otherProducts.filter((p) => p.price >= contextCriteria.minPrice!);
      if (withinMin.length > 0) {
        otherProducts = withinMin;
      }
    }

    const targetPrice = targetProduct.price;
    const targetUseCases = targetProduct.use_cases.map((u) => u.toLowerCase());
    const activeUseCases = (contextCriteria?.useCases || []).map((u) => u.toLowerCase());
    const combinedTargetUseCases = Array.from(new Set([...activeUseCases, ...targetUseCases]));
    const targetFeatures = targetProduct.features.map((f) => f.toLowerCase());

    // 3. Score each alternative against the target product and active session context
    const scoredAlternatives = otherProducts.map((candidate) => {
      const candidateUseCases = candidate.use_cases.map((u) => u.toLowerCase());
      const candidateFeatures = candidate.features.map((f) => f.toLowerCase());

      // Overlapping use cases (against both active context use cases and target product use cases)
      const sharedUseCases = candidateUseCases.filter((cUse) =>
        combinedTargetUseCases.some((tUse) => tUse.includes(cUse) || cUse.includes(tUse))
      );

      // Active context use-case match bonus
      const matchesActiveUseCases = activeUseCases.filter((aUse) =>
        candidateUseCases.some((cUse) => cUse.includes(aUse) || aUse.includes(cUse))
      );

      // Overlapping features
      const sharedFeatures = candidateFeatures.filter((cFeat) =>
        targetFeatures.some((tFeat) => tFeat.includes(cFeat) || cFeat.includes(tFeat))
      );

      // Price proximity score (0 to 25 points)
      const maxPrice = Math.max(candidate.price, targetPrice);
      const priceRatio = maxPrice > 0 ? 1 - Math.abs(candidate.price - targetPrice) / maxPrice : 1;
      const priceProximityScore = Math.max(0, priceRatio) * 25;

      // Use case score (30 points per shared use case + 20 points per active requested use case)
      const useCaseScore = sharedUseCases.length * 30 + matchesActiveUseCases.length * 20;

      // Feature score (15 points per shared feature)
      const featureScore = sharedFeatures.length * 15;

      // Brand diversity bonus (10 points for offering a distinct brand alternative)
      const brandDiversityBonus =
        candidate.brand.toLowerCase() !== targetProduct.brand.toLowerCase() ? 10 : 0;

      // Baseline rating score (up to 10 points)
      const ratingScore = (candidate.rating / 5.0) * 10;

      const totalSimilarity = Number(
        (
          priceProximityScore +
          useCaseScore +
          featureScore +
          brandDiversityBonus +
          ratingScore
        ).toFixed(2)
      );

      const priceDiff = candidate.price - targetPrice;
      const diffFormatted =
        priceDiff === 0
          ? 'Same price'
          : priceDiff > 0
          ? `₹${priceDiff.toLocaleString('en-IN')} more`
          : `₹${Math.abs(priceDiff).toLocaleString('en-IN')} less`;

      const reasons: string[] = [];
      reasons.push(diffFormatted);
      if (contextCriteria?.maxPrice !== undefined && candidate.price <= contextCriteria.maxPrice) {
        reasons.push(`Within ₹${contextCriteria.maxPrice.toLocaleString('en-IN')} budget`);
      }
      if (sharedUseCases.length > 0) {
        reasons.push(`Shared use cases: ${sharedUseCases.join(', ')}`);
      }
      if (candidate.brand !== targetProduct.brand) {
        reasons.push(`Alternative brand: ${candidate.brand}`);
      }

      return {
        product: candidate,
        similarityScore: totalSimilarity,
        priceDifference: priceDiff,
        sharedUseCases,
        sharedFeatures,
        similarityReason: reasons.join(' • '),
      };
    });

    // 4. Sort deterministically by similarityScore DESC, then rating DESC, then price ASC
    scoredAlternatives.sort((a, b) => {
      if (Math.abs(b.similarityScore - a.similarityScore) > 0.001) {
        return b.similarityScore - a.similarityScore;
      }
      if (b.product.rating !== a.product.rating) {
        return b.product.rating - a.product.rating;
      }
      return a.product.price - b.product.price;
    });

    return {
      targetProduct,
      alternatives: scoredAlternatives.slice(0, limit),
    };
  }
}
