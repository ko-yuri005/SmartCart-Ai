import { Product, ScoredProduct } from '../types/index.js';
import { NormalizedCriteria } from './filter.service.js';
import { DEFAULT_RANKING_CONFIG, RankingConfig } from '../config/ranking.config.js';

export class RankingService {
  constructor(private config: RankingConfig = DEFAULT_RANKING_CONFIG) {}

  /**
   * Scores and ranks a list of products deterministically against the user's criteria.
   * Products with highest scores are returned first.
   */
  public rankProducts(products: Product[], criteria: NormalizedCriteria): ScoredProduct[] {
    const scoredList = products.map((product) => this.scoreProduct(product, criteria));

    // Deterministic sort based on criteria.sortPreference or default relevance
    return scoredList.sort((a, b) => {
      if (criteria.sortPreference === 'price_asc') {
        if (a.product.price !== b.product.price) {
          return a.product.price - b.product.price;
        }
        return b.score - a.score;
      }

      if (criteria.sortPreference === 'price_desc') {
        if (a.product.price !== b.product.price) {
          return b.product.price - a.product.price;
        }
        return b.score - a.score;
      }

      if (criteria.sortPreference === 'rating') {
        if (b.product.rating !== a.product.rating) {
          return b.product.rating - a.product.rating;
        }
        return b.score - a.score;
      }

      // Default: totalScore DESC, then rating DESC, then price ASC, then id ASC
      if (Math.abs(b.score - a.score) > 0.001) {
        return b.score - a.score;
      }
      if (b.product.rating !== a.product.rating) {
        return b.product.rating - a.product.rating;
      }
      if (a.product.price !== b.product.price) {
        return a.product.price - b.product.price;
      }
      return a.product.id.localeCompare(b.product.id);
    });
  }

  /**
   * Calculates explainable score for a single product
   */
  public scoreProduct(product: Product, criteria: NormalizedCriteria): ScoredProduct {
    const { weights, bonusPoints, maxReviewVolumeLog } = this.config;
    const rankingReasons: string[] = [];

    // 1. USE-CASE RELEVANCE (Highest Priority)
    let useCaseScore = 0;
    const matchedUseCases: string[] = [];
    if (criteria.useCases && criteria.useCases.length > 0) {
      const productUseCasesLower = product.use_cases.map((u) => u.toLowerCase());
      const productText = `${product.name} ${product.description}`.toLowerCase();

      for (const reqUseCase of criteria.useCases) {
        const directMatch = productUseCasesLower.some(
          (pUse) => pUse.includes(reqUseCase) || reqUseCase.includes(pUse)
        );
        const textMatch = productText.includes(reqUseCase);

        if (directMatch || textMatch) {
          matchedUseCases.push(reqUseCase);
          useCaseScore += weights.useCaseMatchWeight;
        }
      }

      if (matchedUseCases.length === criteria.useCases.length && criteria.useCases.length > 0) {
        useCaseScore += bonusPoints.allUseCasesMatchedBonus;
        rankingReasons.push(`Matches all requested use cases: ${matchedUseCases.join(', ')}`);
      } else if (matchedUseCases.length > 0) {
        rankingReasons.push(`Matches use cases: ${matchedUseCases.join(', ')}`);
      }
    }

    // 2. FEATURE RELEVANCE
    let featureScore = 0;
    const matchedFeatures: string[] = [];
    if (criteria.features && criteria.features.length > 0) {
      const productFeatureText = [
        ...product.features,
        product.description,
        ...Object.values(product.specifications).map(String),
      ]
        .join(' ')
        .toLowerCase();

      for (const reqFeature of criteria.features) {
        if (productFeatureText.includes(reqFeature)) {
          matchedFeatures.push(reqFeature);
          featureScore += weights.featureMatchWeight;
        }
      }

      if (matchedFeatures.length === criteria.features.length && criteria.features.length > 0) {
        featureScore += bonusPoints.allFeaturesMatchedBonus;
        rankingReasons.push(`Includes all requested features: ${matchedFeatures.join(', ')}`);
      } else if (matchedFeatures.length > 0) {
        rankingReasons.push(`Includes key features: ${matchedFeatures.join(', ')}`);
      }
    }

    // 3. BUDGET FIT
    let budgetScore = 0;
    let withinBudget = true;
    let diffFromMax: number | undefined;
    let percentageOfMax: number | undefined;

    if (criteria.maxPrice !== undefined && criteria.maxPrice > 0) {
      withinBudget = product.price <= criteria.maxPrice;
      diffFromMax = criteria.maxPrice - product.price;
      percentageOfMax = (product.price / criteria.maxPrice) * 100;

      if (withinBudget) {
        budgetScore = weights.budgetFitWeight;
        rankingReasons.push(
          `Comfortably within budget at ₹${product.price.toLocaleString('en-IN')} (Budget: ₹${criteria.maxPrice.toLocaleString('en-IN')})`
        );
      }
    }

    // 4. BRAND MATCH (If requested)
    let brandScore = 0;
    if (criteria.brand && product.brand.toLowerCase() === criteria.brand.toLowerCase()) {
      brandScore += bonusPoints.brandExactMatchBonus;
      rankingReasons.push(`Matches preferred brand: ${product.brand}`);
    }

    // 5. RATING SCORE (Bounded baseline)
    const normalizedRating = Math.max(0, Math.min(product.rating, 5.0));
    const ratingScore = (normalizedRating / 5.0) * weights.ratingWeight;
    if (product.rating >= 4.3) {
      rankingReasons.push(`Highly rated: ${product.rating}/5 stars`);
    }

    // 6. REVIEW VOLUME CONFIDENCE (Log-scaled)
    const reviewLog = Math.log10(Math.max(product.review_count, 1));
    const normalizedReviewFraction = Math.min(reviewLog / maxReviewVolumeLog, 1.0);
    const reviewScore = normalizedReviewFraction * weights.reviewVolumeWeight;

    // TOTAL SCORE CALCULATION
    const totalScore = Number(
      (useCaseScore + featureScore + budgetScore + brandScore + ratingScore + reviewScore).toFixed(2)
    );

    return {
      product,
      score: totalScore,
      scoreBreakdown: {
        useCaseScore: Number(useCaseScore.toFixed(2)),
        featureScore: Number(featureScore.toFixed(2)),
        ratingScore: Number(ratingScore.toFixed(2)),
        reviewScore: Number(reviewScore.toFixed(2)),
        budgetScore: Number(budgetScore.toFixed(2)),
      },
      matchedUseCases,
      matchedFeatures,
      budgetFit: {
        withinBudget,
        diffFromMax,
        percentageOfMax: percentageOfMax ? Number(percentageOfMax.toFixed(1)) : undefined,
      },
      rankingReasons,
      matchExplanation: rankingReasons.join('. '),
    };
  }
}
