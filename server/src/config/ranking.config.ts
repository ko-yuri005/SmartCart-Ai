/**
 * Configurable scoring parameters for the deterministic product ranking engine.
 * User intent and use-case relevance have the highest weights to ensure that
 * relevance to user requirements outweighs generic star ratings.
 */

export interface RankingConfig {
  weights: {
    useCaseMatchWeight: number;    // Primary: Match on intended usage (e.g. gym, calls, gaming)
    featureMatchWeight: number;    // Secondary: Match on explicit features (e.g. ANC, IPX5, 120Hz)
    budgetFitWeight: number;       // Tertiary: Points for delivering optimal value within budget
    ratingWeight: number;          // Baseline: Generic customer star rating (scaled 0-5)
    reviewVolumeWeight: number;    // Confidence: Diminishing returns on review count (log scaled)
  };
  bonusPoints: {
    allUseCasesMatchedBonus: number; // Extra boost if ALL requested use cases match
    allFeaturesMatchedBonus: number; // Extra boost if ALL requested features match
    brandExactMatchBonus: number;    // Boost if user explicitly asked for this brand
  };
  maxReviewVolumeLog: number; // Log base 10 limit for review volume confidence
  tieBreaker: 'rating' | 'price_asc' | 'review_count';
}

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  weights: {
    useCaseMatchWeight: 40.0,      // High weight: Intent/use-case relevance dominates
    featureMatchWeight: 25.0,      // High weight: Feature criteria
    budgetFitWeight: 15.0,         // Value-for-money / budget optimization
    ratingWeight: 12.0,            // Scaled: 4.8 rating gives ~11.5 pts, 4.0 gives ~9.6 pts
    reviewVolumeWeight: 8.0,       // Log-scaled: high review count gives up to 8 pts
  },
  bonusPoints: {
    allUseCasesMatchedBonus: 15.0,
    allFeaturesMatchedBonus: 10.0,
    brandExactMatchBonus: 20.0,
  },
  maxReviewVolumeLog: 5, // log10(100,000) = 5
  tieBreaker: 'rating',
};
