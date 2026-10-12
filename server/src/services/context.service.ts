import { ExtractedRequirements } from '../types/index.js';
import { FilterService, NormalizedCriteria } from './filter.service.js';
import { IProductRepository } from '../db/repositories/product.repository.js';

export class ContextService {
  constructor(private productRepo?: IProductRepository) {}

  /**
   * Extracts 0-based indices for multi-product ordinal phrases such as
   * "first two", "top two", "first three", "last two", "first and second", "second and third".
   */
  public extractMultiOrdinalIndices(
    msg: string,
    current: ExtractedRequirements,
    totalCount: number
  ): number[] {
    if (totalCount <= 0) return [];

    if (
      current.referenced_indices &&
      Array.isArray(current.referenced_indices) &&
      current.referenced_indices.length >= 2
    ) {
      const valid = current.referenced_indices
        .map((idx) => idx - 1)
        .filter((i) => i >= 0 && i < totalCount);
      if (valid.length >= 2) {
        return Array.from(new Set(valid));
      }
    }

    if (/\b(?:first|top)\s+(?:two|2)\b/i.test(msg)) {
      return [0, 1].filter((i) => i < totalCount);
    }
    if (/\b(?:first|top)\s+(?:three|3)\b/i.test(msg)) {
      return [0, 1, 2].filter((i) => i < totalCount);
    }
    if (/\b(?:first|top)\s+(?:four|4)\b/i.test(msg)) {
      return [0, 1, 2, 3].filter((i) => i < totalCount);
    }
    if (/\b(?:last|bottom)\s+(?:two|2)\b/i.test(msg)) {
      return totalCount >= 2
        ? [totalCount - 2, totalCount - 1]
        : [0].filter((i) => i < totalCount);
    }
    if (/\b(?:last|bottom)\s+(?:three|3)\b/i.test(msg)) {
      return totalCount >= 3
        ? [totalCount - 3, totalCount - 2, totalCount - 1]
        : Array.from({ length: totalCount }, (_, i) => i);
    }

    // Check explicit ordinal pairs like "first and second", "first and third", "second and third", "1st and 2nd"
    const ordinalMap: Record<string, number> = {
      first: 0,
      '1st': 0,
      second: 1,
      '2nd': 1,
      third: 2,
      '3rd': 2,
      fourth: 3,
      '4th': 3,
      fifth: 4,
      '5th': 4,
    };

    const matches =
      msg.match(/\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th)\b/gi) ||
      [];
    const distinctIndices = Array.from(
      new Set(
        matches
          .map((m) => ordinalMap[m.toLowerCase()])
          .filter((idx) => idx !== undefined && idx < totalCount)
      )
    );

    if (distinctIndices.length >= 2) {
      return distinctIndices;
    }

    return [];
  }

  /**
   * Merges current turn requirements with previous requirements and resolves referenced product IDs.
   */
  public mergeRequirements(
    current: ExtractedRequirements,
    previous: ExtractedRequirements | null,
    lastRecommendedIds: string[] = [],
    userMessage = ''
  ): {
    mergedCriteria: NormalizedCriteria;
    resolvedProductIds: string[];
    targetProductId?: string;
  } {
    const msg = (userMessage || '').toLowerCase();
    const resolvedProductIds: string[] = [];
    let targetProductId: string | undefined;

    const multiIndices = this.extractMultiOrdinalIndices(
      msg,
      current,
      lastRecommendedIds.length
    );

    // 1. Resolve referenced product IDs for follow-ups
    const validExplicitReferencedIds = (current.referenced_product_ids || []).filter(
      (id) =>
        typeof id === 'string' &&
        (lastRecommendedIds.includes(id) ||
          (this.productRepo ? this.productRepo.findById(id) !== null : true))
    );

    const hasExplicitComparisonQueries = Boolean(
      current.comparison_queries && current.comparison_queries.length >= 2
    );
    const hasExplicitSingleProductQuery = Boolean(
      current.explicit_product_query && current.explicit_product_query.trim().length >= 3
    );

    if (validExplicitReferencedIds.length > 0) {
      resolvedProductIds.push(...validExplicitReferencedIds);
      targetProductId = resolvedProductIds[0];
    } else if (multiIndices.length >= 2) {
      for (const idx of multiIndices) {
        if (lastRecommendedIds[idx]) {
          resolvedProductIds.push(lastRecommendedIds[idx]);
        }
      }
      targetProductId = resolvedProductIds[0];
    } else if (
      current.intent === 'COMPARE' &&
      !hasExplicitComparisonQueries &&
      lastRecommendedIds.length >= 2
    ) {
      const count = /\b(?:all|three|3)\b/i.test(msg)
        ? Math.min(lastRecommendedIds.length, 3)
        : Math.min(lastRecommendedIds.length, 2);
      resolvedProductIds.push(...lastRecommendedIds.slice(0, count));
      targetProductId = resolvedProductIds[0];
    } else if (
      msg.includes('cheaper one') ||
      (msg.includes('cheapest') &&
        !msg.includes('website') &&
        !msg.includes('site') &&
        !msg.includes('retailer') &&
        lastRecommendedIds.length > 1)
    ) {
      // Find product with lowest price among recent recommendations
      if (this.productRepo && lastRecommendedIds.length > 0) {
        const prods = this.productRepo.findByIds(lastRecommendedIds);
        if (prods.length > 0) {
          prods.sort((a, b) => a.price - b.price);
          targetProductId = prods[0].id;
          resolvedProductIds.push(targetProductId);
        }
      }
      if (!targetProductId && lastRecommendedIds.length > 0) {
        targetProductId = lastRecommendedIds[0];
        resolvedProductIds.push(targetProductId);
      }
    } else if (
      /\b(last\s+one|the\s+last|bottom\s+one)\b/i.test(msg) ||
      current.referenced_index === 999
    ) {
      if (lastRecommendedIds.length > 0) {
        targetProductId = lastRecommendedIds[lastRecommendedIds.length - 1];
        resolvedProductIds.push(targetProductId);
      }
    } else if (/\b(fourth|4th)\b/i.test(msg) || current.referenced_index === 4) {
      if (lastRecommendedIds[3]) {
        targetProductId = lastRecommendedIds[3];
        resolvedProductIds.push(targetProductId);
      }
    } else if (/\b(third|3rd)\b/i.test(msg) || current.referenced_index === 3) {
      if (lastRecommendedIds[2]) {
        targetProductId = lastRecommendedIds[2];
        resolvedProductIds.push(targetProductId);
      }
    } else if (/\b(second|2nd)\b/i.test(msg) || current.referenced_index === 2) {
      if (lastRecommendedIds[1]) {
        targetProductId = lastRecommendedIds[1];
        resolvedProductIds.push(targetProductId);
      }
    } else if (
      /\b(first\s+one|the\s+first|1st|top\s+one|top\s+pick)\b/i.test(msg) ||
      current.referenced_index === 1
    ) {
      if (lastRecommendedIds.length > 0) {
        targetProductId = lastRecommendedIds[0];
        resolvedProductIds.push(targetProductId);
      }
    } else if (
      current.referenced_index !== undefined &&
      current.referenced_index > 0
    ) {
      const idx = current.referenced_index - 1;
      if (lastRecommendedIds[idx]) {
        targetProductId = lastRecommendedIds[idx];
        resolvedProductIds.push(targetProductId);
      }
    } else if (lastRecommendedIds.length > 0 && !hasExplicitSingleProductQuery) {
      // Check if previous turn focused on a specific product (e.g. after "Where can I buy the first one?")
      const prevFocusedId =
        previous?.referenced_product_ids &&
        previous.referenced_product_ids.length > 0 &&
        lastRecommendedIds.includes(previous.referenced_product_ids[0])
          ? previous.referenced_product_ids[0]
          : undefined;

      if (
        current.intent === 'PRODUCT_DETAILS' ||
        current.intent === 'ALTERNATIVES' ||
        current.intent === 'QUESTION_ON_PREVIOUS' ||
        /\b(this|it|that\s+one|this\s+one|this\s+product)\b/i.test(msg)
      ) {
        targetProductId = prevFocusedId || lastRecommendedIds[0];
        resolvedProductIds.push(targetProductId);
      }
    }

    // 2. Detect accessory / subtype rules and category transitions
    const detectedCurrentRule =
      FilterService.findAccessoryRuleById(current.requested_subtype) ||
      FilterService.detectAccessoryRule(userMessage);
    const currentSubtype =
      detectedCurrentRule?.subtypeId || current.requested_subtype;
    const previousSubtype = previous?.requested_subtype;

    const categoryChanged = Boolean(
      (current.category &&
        previous?.category &&
        current.category.toLowerCase().trim() !==
          previous.category.toLowerCase().trim()) ||
        (currentSubtype && currentSubtype !== previousSubtype) ||
        (!currentSubtype && previousSubtype && current.category) ||
        (current.category && !previous?.category && !previousSubtype) ||
        (previous?.intent === 'COMPARE' &&
          current.intent === 'SEARCH' &&
          Boolean(current.category || currentSubtype))
    );

    const activeSubtype = currentSubtype || (!categoryChanged ? previousSubtype : undefined);
    const activeAccessoryRule = FilterService.findAccessoryRuleById(activeSubtype);

    let category =
      current.category || (!categoryChanged ? previous?.category : undefined);

    if (activeAccessoryRule) {
      if (
        category &&
        (activeAccessoryRule.parentCategoriesToOverride.includes(
          category.toLowerCase().trim()
        ) ||
          activeAccessoryRule.triggerRegex.test(category))
      ) {
        category = undefined;
      }
    }

    const excludedProductTypes = activeAccessoryRule
      ? Array.from(
          new Set([
            ...(current.excluded_product_types || []),
            ...activeAccessoryRule.excludedProductTypes,
          ])
        )
      : current.excluded_product_types ||
        (!categoryChanged ? previous?.excluded_product_types : undefined);

    // Check for brand removal instruction (e.g. "Forget the Sony requirement", "Any brand", "Remove brand filter")
    const isBrandRemoval =
      (msg.includes('forget') &&
        (msg.includes('brand') ||
          (previous?.brand && msg.includes(previous.brand.toLowerCase())))) ||
      msg.includes('remove brand') ||
      msg.includes('no brand') ||
      msg.includes('any brand') ||
      msg.includes('all brands') ||
      msg.includes('without brand') ||
      current.brand === 'none' ||
      current.brand === 'all';

    let brand: string | undefined;
    if (isBrandRemoval) {
      brand = undefined;
    } else if (current.brand) {
      brand = current.brand;
    } else if (!categoryChanged) {
      brand = previous?.brand;
    }

    // Check for budget removal instruction (e.g. "Forget the budget", "Any price", "No budget")
    const isBudgetRemoval =
      (msg.includes('forget') &&
        (msg.includes('budget') || msg.includes('price'))) ||
      msg.includes('no budget') ||
      msg.includes('any budget') ||
      msg.includes('no price limit') ||
      msg.includes('any price') ||
      msg.includes('remove budget');

    let maxPrice: number | undefined;
    let minPrice: number | undefined;
    if (isBudgetRemoval) {
      maxPrice = undefined;
      minPrice = undefined;
    } else {
      maxPrice =
        current.max_price !== undefined
          ? current.max_price
          : categoryChanged
            ? undefined
            : previous?.max_price;
      minPrice =
        current.min_price !== undefined
          ? current.min_price
          : categoryChanged
            ? undefined
            : previous?.min_price;
    }

    // Feature merging: if category changed, do not carry over previous category features
    let features: string[] = [];
    if (categoryChanged) {
      features = current.features || [];
    } else if (current.intent === 'REFINE' && previous?.features) {
      features = Array.from(
        new Set([...previous.features, ...(current.features || [])])
      );
    } else {
      features =
        current.features ||
        (current.intent === 'QUESTION_ON_PREVIOUS'
          ? previous?.features || []
          : []);
    }

    // Use cases merging: if category changed, do not carry over previous category use cases
    let useCases: string[] = [];
    if (categoryChanged) {
      useCases = current.use_cases || [];
    } else if (current.intent === 'REFINE' && previous?.use_cases) {
      useCases = Array.from(
        new Set([...previous.use_cases, ...(current.use_cases || [])])
      );
    } else {
      useCases =
        current.use_cases ||
        (current.intent === 'QUESTION_ON_PREVIOUS'
          ? previous?.use_cases || []
          : []);
    }

    // Attributes merging: if category changed, reset attributes
    let attributes: Record<string, string | number> | undefined;
    if (categoryChanged) {
      attributes = current.attributes;
    } else {
      attributes = {
        ...(previous?.attributes || {}),
        ...(current.attributes || {}),
      };
    }

    const sortPreference =
      current.sort_preference ||
      (!categoryChanged ? previous?.sort_preference : undefined);

    const requestedProductType =
      current.requested_product_type ||
      (!categoryChanged ? previous?.requested_product_type : undefined);

    const mergedCriteria: NormalizedCriteria = {
      category,
      categories:
        current.categories ||
        (categoryChanged ? undefined : previous?.categories),
      maxPrice,
      minPrice,
      brand,
      features: features.length > 0 ? features : undefined,
      useCases: useCases.length > 0 ? useCases : undefined,
      attributes:
        attributes && Object.keys(attributes).length > 0
          ? attributes
          : undefined,
      sortPreference,
      requestedSubtype: activeSubtype,
      requestedSubtypeLabel: activeAccessoryRule?.displayName,
      requestedProductType,
      requiredKeywords: activeAccessoryRule?.matchKeywords,
      excludedProductTypes,
      retailerCategoryHint: activeAccessoryRule?.retailerCategoryHint,
      relatedCategoryDescription: activeAccessoryRule?.relatedCategoryDescription,
    };

    return {
      mergedCriteria,
      resolvedProductIds,
      targetProductId,
    };
  }
}
