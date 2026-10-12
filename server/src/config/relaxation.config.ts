/**
 * Configurable parameters for controlled no-match constraint relaxation.
 * Ensures that zero-result searches are relaxed systematically and transparently,
 * without silently dropping user constraints.
 */

export interface RelaxationConfig {
  defaultBudgetExpansionPercentage: number; // e.g. 20% expansion
  maxBudgetExpansionPercentage: number;     // e.g. up to 35% max expansion
  relaxationOrder: ('secondary_features' | 'budget_expansion' | 'both')[];
  minimumResultsTarget: number;             // Stop relaxing once we find this many products
}

export const DEFAULT_RELAXATION_CONFIG: RelaxationConfig = {
  defaultBudgetExpansionPercentage: 20, // Expands budget by 20%
  maxBudgetExpansionPercentage: 35,
  relaxationOrder: [
    'secondary_features', // 1. First attempt to relax secondary feature constraints
    'budget_expansion',   // 2. If still 0, expand the budget constraint by configured %
    'both',               // 3. If still 0, combine both relaxations
  ],
  minimumResultsTarget: 3,
};
