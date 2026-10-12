import { ScoredProduct } from '../types/index.js';
import { FilterService, NormalizedCriteria } from './filter.service.js';
import { RankingService } from './ranking.service.js';
import { DEFAULT_RELAXATION_CONFIG, RelaxationConfig } from '../config/relaxation.config.js';

export interface RelaxationResult {
  isRelaxed: boolean;
  originalCriteria: NormalizedCriteria;
  relaxedCriteria?: NormalizedCriteria;
  relaxedFields: string[];
  explanation?: string;
  products: ScoredProduct[];
}

export class RelaxationService {
  constructor(
    private filterService: FilterService,
    private rankingService: RankingService,
    private config: RelaxationConfig = DEFAULT_RELAXATION_CONFIG
  ) {}

  /**
   * Evaluates criteria. If exact matches exist, returns them.
   * If zero matches, methodically applies deterministic relaxation rules
   * and returns explicit metadata about what was relaxed.
   */
  public searchWithRelaxation(criteria: NormalizedCriteria): RelaxationResult {
    const normalizedOriginal = this.filterService.normalizeCriteria(criteria);

    // Special handling when the user specifically asks for "headphones" (over-ear/on-ear)
    // so we surface exact over-ear headphones within budget first (honestly noting if gym/sweat
    // resistance is not specified) and clearly separate wireless earbuds/neckbands as Related Alternatives.
    if (
      normalizedOriginal.category === 'headphones' &&
      normalizedOriginal.requestedProductType === 'headphones'
    ) {
      const poolWithoutUseCase = this.filterService.filterProducts({
        ...normalizedOriginal,
        useCases: undefined,
      });

      const exactOverEar = poolWithoutUseCase.filter((p) => {
        const pt = (p.product_type || '').toLowerCase();
        return (
          pt === 'headphones' ||
          pt === 'headphone' ||
          /\b(over-?ear|on-?ear|headphones?)\b/i.test(p.name)
        );
      });

      const candidateEarbudsAndNeckbands = poolWithoutUseCase.filter((p) => {
        const pt = (p.product_type || '').toLowerCase();
        return (
          pt === 'earbuds' ||
          pt === 'neckband' ||
          (!exactOverEar.some((e) => e.id === p.id))
        );
      });

      const matchingUseCaseAlternatives =
        normalizedOriginal.useCases && normalizedOriginal.useCases.length > 0
          ? candidateEarbudsAndNeckbands.filter((p) =>
              this.filterService.matchesAnyUseCase(p, normalizedOriginal.useCases!)
            )
          : candidateEarbudsAndNeckbands;

      if (exactOverEar.length > 0 || matchingUseCaseAlternatives.length > 0) {
        const rankedExact = this.rankingService
          .rankProducts(exactOverEar, {
            ...normalizedOriginal,
            useCases: undefined,
          })
          .map((sp) => {
            const satisfiesUseCase =
              !normalizedOriginal.useCases ||
              normalizedOriginal.useCases.length === 0 ||
              this.filterService.matchesAnyUseCase(
                sp.product,
                normalizedOriginal.useCases
              );
            const requestedUseLabel = (normalizedOriginal.useCases || []).join(', ');
            const honestUseNote = !satisfiesUseCase
              ? `Exact over-ear wireless headphone under budget; note that ${requestedUseLabel || 'gym'}/sweat resistance (IP rating) is not specified in its catalogue record`
              : `Exact over-ear wireless headphone matching ${requestedUseLabel}`;

            return {
              ...sp,
              isRelatedAlternative: false,
              rankingReasons: [honestUseNote, ...(sp.rankingReasons || [])],
              matchExplanation: `${sp.matchExplanation} (${honestUseNote}).`,
            };
          });

        const rankedAlternatives = this.rankingService
          .rankProducts(matchingUseCaseAlternatives, normalizedOriginal)
          .map((sp) => {
            const subtypeLabel =
              (sp.product.product_type || '').toLowerCase() === 'neckband'
                ? 'Wireless neckband'
                : 'True wireless earbuds';
            const ipRating =
              sp.product.specifications?.water_resistance ||
              sp.product.features.find((f) => /\bip[x\d]{2}\b/i.test(f));
            const ipNote = ipRating ? ` with ${ipRating} water/sweat resistance` : '';

            return {
              ...sp,
              isRelatedAlternative: true,
              alternativeSectionLabel:
                'Related alternatives (Wireless Earbuds & Neckbands)',
              rankingReasons: [
                `${subtypeLabel}${ipNote} (related alternative to over-ear headphones)`,
                ...(sp.rankingReasons || []),
              ],
              matchExplanation: `Related alternative (${subtypeLabel.toLowerCase()}${ipNote}): ${sp.matchExplanation}`,
            };
          });

        const combined = [...rankedExact, ...rankedAlternatives];
        return {
          isRelaxed: false,
          originalCriteria: normalizedOriginal,
          relaxedFields: [],
          explanation:
            exactOverEar.length > 0 && rankedAlternatives.length > 0
              ? `Found ${exactOverEar.length} over-ear wireless headphone(s) within budget (note: gym/sweat resistance is not specified in its catalogue record), plus ${rankedAlternatives.length} gym-ready wireless earbuds and neckbands under budget listed as related alternatives.`
              : undefined,
          products: combined,
        };
      }
    }

    // 1. Try exact match first
    const exactProducts = this.filterService.filterProducts(normalizedOriginal);
    if (exactProducts.length > 0) {
      const ranked = this.rankingService.rankProducts(exactProducts, normalizedOriginal);
      return {
        isRelaxed: false,
        originalCriteria: normalizedOriginal,
        relaxedFields: [],
        products: ranked,
      };
    }

    // 2. Zero exact matches: Begin controlled relaxation steps
    const { defaultBudgetExpansionPercentage, maxBudgetExpansionPercentage } = this.config;

    const nonRelaxableFeatures = (normalizedOriginal.features || []).filter(
      (f) => f === 'organic' || f === 'certified organic'
    );
    const hasRelaxableFeatures =
      Boolean(normalizedOriginal.features && normalizedOriginal.features.length > nonRelaxableFeatures.length);
    const relaxedFeatureList =
      nonRelaxableFeatures.length > 0 ? nonRelaxableFeatures : undefined;
    const hasUseCases = Boolean(
      normalizedOriginal.useCases && normalizedOriginal.useCases.length > 0
    );

    // STEP A0: Relax strict use-case filter while keeping category, budget, and required features
    if (hasUseCases) {
      const criteriaWithoutUseCases: NormalizedCriteria = {
        ...normalizedOriginal,
        useCases: undefined,
      };
      const candidates = this.filterService.filterProducts(criteriaWithoutUseCases);
      if (candidates.length > 0) {
        const ranked = this.rankingService.rankProducts(
          candidates,
          criteriaWithoutUseCases
        );
        return {
          isRelaxed: true,
          originalCriteria: normalizedOriginal,
          relaxedCriteria: criteriaWithoutUseCases,
          relaxedFields: ['useCases'],
          explanation: `No products explicitly tagged for "${normalizedOriginal.useCases!.join(
            ', '
          )}" matched every filter. Showing matching ${normalizedOriginal.category || 'catalogue'} options within your budget (check individual specifications for ${normalizedOriginal.useCases!.join(', ')} suitability).`,
          products: ranked,
        };
      }
    }

    // STEP A: Relax secondary features while keeping category, budget, use cases, and strict certification constraints
    if (hasRelaxableFeatures) {
      const criteriaWithoutFeatures: NormalizedCriteria = {
        ...normalizedOriginal,
        features: relaxedFeatureList,
      };

      const candidates = this.filterService.filterProducts(criteriaWithoutFeatures);
      if (candidates.length > 0) {
        const ranked = this.rankingService.rankProducts(candidates, criteriaWithoutFeatures);
        return {
          isRelaxed: true,
          originalCriteria: normalizedOriginal,
          relaxedCriteria: criteriaWithoutFeatures,
          relaxedFields: ['features'],
          explanation: `No exact matches found with all requested features (${normalizedOriginal.features!.join(
            ', '
          )}). Showing available options within your budget in the ${normalizedOriginal.category || 'selected'} category.`,
          products: ranked,
        };
      }
    }

    // STEP A2: Relax both secondary features and use cases within budget
    if (hasRelaxableFeatures && hasUseCases) {
      const criteriaWithoutFeaturesAndUseCases: NormalizedCriteria = {
        ...normalizedOriginal,
        features: relaxedFeatureList,
        useCases: undefined,
      };
      const candidates = this.filterService.filterProducts(
        criteriaWithoutFeaturesAndUseCases
      );
      if (candidates.length > 0) {
        const ranked = this.rankingService.rankProducts(
          candidates,
          criteriaWithoutFeaturesAndUseCases
        );
        return {
          isRelaxed: true,
          originalCriteria: normalizedOriginal,
          relaxedCriteria: criteriaWithoutFeaturesAndUseCases,
          relaxedFields: ['features', 'useCases'],
          explanation: `Showing available options in the ${normalizedOriginal.category || 'selected'} category within your budget after relaxing secondary feature and use-case tags.`,
          products: ranked,
        };
      }
    }

    // STEP B: If budget is specified, expand budget by default percentage (e.g. 20%) while keeping features
    if (normalizedOriginal.maxPrice && normalizedOriginal.maxPrice > 0) {
      const expandedMaxPrice = Math.round(
        normalizedOriginal.maxPrice * (1 + defaultBudgetExpansionPercentage / 100)
      );

      const criteriaWithExpandedBudget: NormalizedCriteria = {
        ...normalizedOriginal,
        maxPrice: expandedMaxPrice,
      };

      const candidates = this.filterService.filterProducts(criteriaWithExpandedBudget);
      if (candidates.length > 0) {
        const ranked = this.rankingService.rankProducts(candidates, criteriaWithExpandedBudget);
        return {
          isRelaxed: true,
          originalCriteria: normalizedOriginal,
          relaxedCriteria: criteriaWithExpandedBudget,
          relaxedFields: ['maxPrice'],
          explanation: `No exact matches found under ₹${normalizedOriginal.maxPrice.toLocaleString(
            'en-IN'
          )}. Showing closest options by relaxing budget by ${defaultBudgetExpansionPercentage}% to ₹${expandedMaxPrice.toLocaleString(
            'en-IN'
          )}.`,
          products: ranked,
        };
      }
    }

    // STEP C: Combine feature relaxation + budget expansion
    if (
      normalizedOriginal.maxPrice &&
      (hasRelaxableFeatures || hasUseCases)
    ) {
      const expandedMaxPrice = Math.round(
        normalizedOriginal.maxPrice * (1 + defaultBudgetExpansionPercentage / 100)
      );

      const criteriaCombinedRelaxation: NormalizedCriteria = {
        ...normalizedOriginal,
        features: relaxedFeatureList,
        useCases: undefined,
        maxPrice: expandedMaxPrice,
      };

      const candidates = this.filterService.filterProducts(criteriaCombinedRelaxation);
      if (candidates.length > 0) {
        const ranked = this.rankingService.rankProducts(candidates, criteriaCombinedRelaxation);
        return {
          isRelaxed: true,
          originalCriteria: normalizedOriginal,
          relaxedCriteria: criteriaCombinedRelaxation,
          relaxedFields: ['features', 'maxPrice'],
          explanation: `No exact matches found within ₹${normalizedOriginal.maxPrice.toLocaleString(
            'en-IN'
          )} with all features. Showing options after expanding budget by ${defaultBudgetExpansionPercentage}% and relaxing strict feature filters.`,
          products: ranked,
        };
      }
    }

    // STEP D: Try max budget expansion (e.g. 35%)
    if (normalizedOriginal.maxPrice && normalizedOriginal.maxPrice > 0) {
      const maxExpandedPrice = Math.round(
        normalizedOriginal.maxPrice * (1 + maxBudgetExpansionPercentage / 100)
      );

      const criteriaMaxBudget: NormalizedCriteria = {
        ...normalizedOriginal,
        features: relaxedFeatureList,
        useCases: undefined,
        maxPrice: maxExpandedPrice,
      };

      const candidates = this.filterService.filterProducts(criteriaMaxBudget);
      if (candidates.length > 0) {
        const ranked = this.rankingService.rankProducts(candidates, criteriaMaxBudget);
        return {
          isRelaxed: true,
          originalCriteria: normalizedOriginal,
          relaxedCriteria: criteriaMaxBudget,
          relaxedFields: ['features', 'maxPrice'],
          explanation: `No exact matches found. Showing nearest alternatives after expanding budget by ${maxExpandedPrice ? maxBudgetExpansionPercentage : 0}% to ₹${maxExpandedPrice.toLocaleString(
            'en-IN'
          )}.`,
          products: ranked,
        };
      }
    }

    // No matches even after safe relaxation (never relax accessory subtype or strict organic certification into unrelated items)
    const noMatchExplanation = normalizedOriginal.requestedSubtypeLabel
      ? `We don't currently have ${normalizedOriginal.requestedSubtypeLabel} in our internal product catalogue.`
      : nonRelaxableFeatures.length > 0
        ? `No certified organic products (with explicit USDA Organic, India Organic / NPOP, or ECOCERT certification) were found in our catalogue${normalizedOriginal.maxPrice ? ` under ₹${normalizedOriginal.maxPrice.toLocaleString('en-IN')}` : ''}. Note: We strictly verify organic certification and never treat generic marketing terms like "natural", "green", "herbal", or "eco-friendly" as certified organic.`
        : 'No products satisfied these criteria, even after relaxation.';

    return {
      isRelaxed: false,
      originalCriteria: normalizedOriginal,
      relaxedFields: [],
      explanation: noMatchExplanation,
      products: [],
    };
  }
}
