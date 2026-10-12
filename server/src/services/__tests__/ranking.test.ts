import { describe, it, expect } from 'vitest';
import { RankingService } from '../ranking.service.js';
import { Product } from '../../types/index.js';

describe('RankingService', () => {
  const rankingService = new RankingService();

  const productHighRatingNoMatch: Product = {
    id: 'prod-high-rating',
    name: 'Luxury Audiophile Studio Headphones',
    category: 'headphones',
    brand: 'AudiophilePro',
    price: 2800,
    currency: 'INR',
    rating: 4.8, // Very high rating!
    review_count: 5000,
    description: 'Perfect for quiet indoor studio mixing. Delicate open-back construction.',
    features: ['Open-Back Design', 'Velour Earcups', 'OFC Cable'],
    specifications: { driver: '50mm' },
    use_cases: ['studio', 'quiet listening', 'classical music'], // Does NOT match gym or calls
    image: 'https://example.com/p1.jpg',
    availability: true,
  };

  const productModerateRatingStrongMatch: Product = {
    id: 'prod-moderate-rating-strong-match',
    name: 'ActiveFit Sport True Wireless Earbuds',
    category: 'headphones',
    brand: 'FitAudio',
    price: 2499,
    currency: 'INR',
    rating: 4.3, // Moderate rating
    review_count: 8000,
    description: 'Engineered for gym workouts and crystal clear calling on the run.',
    features: ['IPX7 Waterproof', 'Quad Mic ENC', 'Secure Earhooks'],
    specifications: { driver: '10mm', water_resistance: 'IPX7' },
    use_cases: ['gym', 'workout', 'calls', 'running'], // Strongly matches requested gym + calls!
    image: 'https://example.com/p2.jpg',
    availability: true,
  };

  it('MUST rank use-case relevance higher than generic star rating', () => {
    // When user requests "gym" and "calls" under 3000:
    const criteria = {
      category: 'headphones',
      maxPrice: 3000,
      useCases: ['gym', 'calls'],
    };

    const ranked = rankingService.rankProducts(
      [productHighRatingNoMatch, productModerateRatingStrongMatch],
      criteria
    );

    // Moderate-rated product with strong use-case fit MUST outrank the 4.8-rated product!
    expect(ranked[0].product.id).toBe(productModerateRatingStrongMatch.id);
    expect(ranked[1].product.id).toBe(productHighRatingNoMatch.id);

    // Verify score breakdown explains why
    expect(ranked[0].scoreBreakdown.useCaseScore).toBeGreaterThan(0);
    expect(ranked[1].scoreBreakdown.useCaseScore).toBe(0);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('should calculate budget fit reward when within budget', () => {
    const criteria = {
      maxPrice: 3000,
    };

    const scored = rankingService.scoreProduct(productModerateRatingStrongMatch, criteria);
    expect(scored.budgetFit.withinBudget).toBe(true);
    expect(scored.scoreBreakdown.budgetScore).toBeGreaterThan(0);
    expect(scored.rankingReasons.some((r) => r.includes('within budget'))).toBe(true);
  });

  it('should provide explainable ranking reasons in metadata', () => {
    const criteria = {
      useCases: ['gym'],
      features: ['waterproof'],
      maxPrice: 3000,
    };

    const scored = rankingService.scoreProduct(productModerateRatingStrongMatch, criteria);
    expect(scored.rankingReasons.length).toBeGreaterThan(0);
    expect(scored.matchedUseCases).toContain('gym');
    expect(scored.matchExplanation).toBeDefined();
    expect(scored.matchExplanation?.length).toBeGreaterThan(10);
  });

  it('should perform deterministic repeated ranking with identical inputs', () => {
    const criteria = {
      category: 'headphones',
      useCases: ['gym', 'calls'],
      maxPrice: 3000,
    };

    const run1 = rankingService.rankProducts(
      [productHighRatingNoMatch, productModerateRatingStrongMatch],
      criteria
    );
    const run2 = rankingService.rankProducts(
      [productHighRatingNoMatch, productModerateRatingStrongMatch],
      criteria
    );

    expect(run1.map((p) => p.product.id)).toEqual(run2.map((p) => p.product.id));
    expect(run1[0].score).toBe(run2[0].score);
    expect(run1[1].score).toBe(run2[1].score);
  });
});
