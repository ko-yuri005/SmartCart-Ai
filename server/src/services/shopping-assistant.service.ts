import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import {
  CartSummaryDTO,
  ChatCartActionResult,
  ChatResponseDTO,
  Product,
  ProductPriceComparisonResult,
  RequestDiagnostics,
  ScoredProduct,
  ShoppingIntent,
} from '../types/index.js';
import { IProductRepository } from '../db/repositories/product.repository.js';
import { ISessionRepository } from '../db/repositories/session.repository.js';
import { FilterService } from './filter.service.js';
import { RankingService } from './ranking.service.js';
import { RelaxationService } from './relaxation.service.js';
import { AlternativesService } from './alternatives.service.js';
import { ComparisonService } from './comparison.service.js';
import { SecurityService } from './security.service.js';
import {
  ExtractionTelemetryResult,
  GenerationTelemetryResult,
  GeminiService,
  GroundedResponseParams,
  UncataloguedItemInfo,
} from './gemini.service.js';
import { ContextService } from './context.service.js';
import { PriceComparisonService } from './price-comparison.service.js';
import { CartOrderService } from './cart-order.service.js';

export interface SessionRateGuardConfig {
  sessionThrottleMs?: number;
  duplicateSubmitWindowMs?: number;
}

interface SessionRateState {
  lastRequestAt: number;
  lastNormalizedMessage: string;
  lastResponse?: ChatResponseDTO;
}

export class ShoppingAssistantService {
  private sessionThrottleMs: number;
  private duplicateSubmitWindowMs: number;
  private sessionRateMap = new Map<string, SessionRateState>();
  private sessionGenerationMap = new Map<string, number>();

  constructor(
    private productRepo: IProductRepository,
    private sessionRepo: ISessionRepository,
    private filterService: FilterService,
    private rankingService: RankingService,
    private relaxationService: RelaxationService,
    private alternativesService: AlternativesService,
    private comparisonService: ComparisonService,
    private securityService: SecurityService,
    private geminiService: GeminiService,
    private contextService: ContextService,
    rateGuardConfig: SessionRateGuardConfig = {},
    private priceComparisonService?: PriceComparisonService,
    private cartOrderService?: CartOrderService
  ) {
    this.sessionThrottleMs = Math.max(
      0,
      rateGuardConfig.sessionThrottleMs ?? env.SESSION_THROTTLE_MS
    );
    this.duplicateSubmitWindowMs = Math.max(
      0,
      rateGuardConfig.duplicateSubmitWindowMs ?? env.DUPLICATE_SUBMIT_WINDOW_MS
    );
  }

  public setPriceComparisonService(service: PriceComparisonService): void {
    this.priceComparisonService = service;
  }

  public setCartOrderService(service: CartOrderService): void {
    this.cartOrderService = service;
  }

  public setRateGuardConfig(config: SessionRateGuardConfig): void {
    if (config.sessionThrottleMs !== undefined) {
      this.sessionThrottleMs = Math.max(0, config.sessionThrottleMs);
    }
    if (config.duplicateSubmitWindowMs !== undefined) {
      this.duplicateSubmitWindowMs = Math.max(0, config.duplicateSubmitWindowMs);
    }
  }

  public clearSessionState(sessionId: string): void {
    this.sessionRateMap.delete(sessionId);
    this.sessionGenerationMap.set(
      sessionId,
      (this.sessionGenerationMap.get(sessionId) ?? 0) + 1
    );
  }

  /**
   * Main pipeline processing a user message through the complete shopping assistant flow.
   */
  public async handleUserMessage(
    sessionId: string | undefined,
    userMessage: string
  ): Promise<ChatResponseDTO> {
    const overallStartTime = Date.now();
    const correlationId = `req_${Date.now()}_${randomUUID().substring(0, 8)}`;

    // 0. Ensure session exists
    const session = this.sessionRepo.getOrCreateSession(sessionId);
    const activeSessionId = session.id;
    const sessionGenerationAtStart = this.sessionGenerationMap.get(activeSessionId) ?? 0;

    if (!userMessage || userMessage.trim().length === 0) {
      return {
        sessionId: activeSessionId,
        message:
          'Please tell me what you are looking for! (e.g., "Wireless headphones under ₹3000 for gym")',
        products: [],
        intent: 'CASUAL',
        diagnostics: {
          correlationId,
          detectedIntent: 'CASUAL',
          extractionSource: 'fallback',
          explanationSource: 'fallback',
          durationMs: Date.now() - overallStartTime,
          productsConsidered: 0,
          productsSelected: 0,
          isCached: false,
          tokenUsage: this.geminiService.emptyTokenUsage(),
          budgetStatus: this.geminiService.getBudgetStatus(),
        },
      };
    }

    // 1. STEP 1: Pre-LLM Confidentiality Guardrail
    const securityCheck = this.securityService.isConfidentialityProbe(userMessage);
    if (securityCheck.isProbe) {
      const refusal = this.securityService.getRefusalMessage();

      this.sessionRepo.addMessage({
        sessionId: activeSessionId,
        role: 'user',
        content: userMessage,
      });
      this.sessionRepo.addMessage({
        sessionId: activeSessionId,
        role: 'assistant',
        content: refusal,
        extractedRequirements: { intent: 'CONFIDENTIALITY_PROBE' },
      });

      return {
        sessionId: activeSessionId,
        message: refusal,
        products: [],
        intent: 'CONFIDENTIALITY_PROBE',
        diagnostics: {
          correlationId,
          detectedIntent: 'CONFIDENTIALITY_PROBE',
          extractionSource: 'fallback',
          explanationSource: 'fallback',
          durationMs: Date.now() - overallStartTime,
          productsConsidered: 0,
          productsSelected: 0,
          isCached: false,
          tokenUsage: this.geminiService.emptyTokenUsage(),
          budgetStatus: this.geminiService.getBudgetStatus(),
        },
      };
    }

    // 1b. Duplicate-Submit & Per-Session Request Throttling Guard
    const now = Date.now();
    const normalizedMessage = userMessage.trim().toLowerCase().replace(/\s+/g, ' ');
    const prevRateState = this.sessionRateMap.get(activeSessionId);

    if (
      prevRateState &&
      prevRateState.lastResponse &&
      this.duplicateSubmitWindowMs > 0 &&
      now - prevRateState.lastRequestAt < this.duplicateSubmitWindowMs &&
      prevRateState.lastNormalizedMessage === normalizedMessage
    ) {
      const cached = prevRateState.lastResponse;
      return {
        ...cached,
        diagnostics: {
          ...(cached.diagnostics || {
            detectedIntent: cached.intent,
            extractionSource: 'fallback',
            explanationSource: 'fallback',
            productsConsidered: 0,
            productsSelected: cached.products.length,
          }),
          correlationId,
          durationMs: Date.now() - overallStartTime,
          isCached: true,
          duplicateSubmitBlocked: true,
          tokenUsage: this.geminiService.emptyTokenUsage(),
          budgetStatus: this.geminiService.getBudgetStatus(),
          fallbackReason:
            'Duplicate submit detected within protection window; returned cached response without calling Gemini.',
        },
      };
    }

    const isSessionThrottled = Boolean(
      prevRateState &&
        this.sessionThrottleMs > 0 &&
        now - prevRateState.lastRequestAt < this.sessionThrottleMs
    );

    // 2. Retrieve recent conversation history and prior context
    const history = this.sessionRepo.getMessages(activeSessionId, 6);
    const lastRecommendedIds = this.sessionRepo.getLastRecommendedProducts(activeSessionId);
    const lastRequirements = this.sessionRepo.getLastRequirements(activeSessionId);

    // Record user message
    this.sessionRepo.addMessage({
      sessionId: activeSessionId,
      role: 'user',
      content: userMessage,
    });

    // 3. STEP 2: Requirement Extraction (Gemini when not throttled; deterministic fallback when throttled)
    let extractionResult: ExtractionTelemetryResult;
    if (isSessionThrottled) {
      const extractStart = Date.now();
      extractionResult = {
        requirements: this.geminiService.fallbackDeterministicExtraction(userMessage, history),
        source: 'fallback',
        model: this.geminiService.getModelName(),
        durationMs: Date.now() - extractStart,
        tokenUsage: this.geminiService.emptyTokenUsage(),
        fallbackReason:
          'Session request throttle active; served via deterministic shopping engine to protect Gemini API quota.',
      };
    } else {
      extractionResult = await this.geminiService.extractWithTelemetry(userMessage, history);
    }

    const extracted = extractionResult.requirements;

    // Defense-in-depth: if extraction model itself flags confidentiality probe
    if (extracted.intent === 'CONFIDENTIALITY_PROBE') {
      const refusal = this.securityService.getRefusalMessage();
      if ((this.sessionGenerationMap.get(activeSessionId) ?? 0) === sessionGenerationAtStart) {
        this.sessionRepo.addMessage({
          sessionId: activeSessionId,
          role: 'assistant',
          content: refusal,
          extractedRequirements: extracted,
        });
      }
      return {
        sessionId: activeSessionId,
        message: refusal,
        products: [],
        intent: 'CONFIDENTIALITY_PROBE',
        diagnostics: {
          correlationId,
          detectedIntent: 'CONFIDENTIALITY_PROBE',
          extractionSource: extractionResult.source,
          explanationSource: 'fallback',
          model: extractionResult.model,
          durationMs: Date.now() - overallStartTime,
          stageDurationsMs: {
            extractionMs: extractionResult.durationMs,
            filteringMs: 0,
            rankingMs: 0,
            explanationMs: 0,
          },
          productsConsidered: 0,
          productsSelected: 0,
          isCached: false,
          throttled: isSessionThrottled || undefined,
          tokenUsage: extractionResult.tokenUsage,
          budgetStatus: this.geminiService.getBudgetStatus(),
        },
      };
    }

    // 4. STEP 3: Context-Aware Requirement Merging
    const { mergedCriteria, resolvedProductIds, targetProductId } =
      this.contextService.mergeRequirements(
        extracted,
        lastRequirements,
        lastRecommendedIds,
        userMessage
      );

    let assistantResponseText = '';
    let returnProducts: Product[] = [];
    let returnScoredProducts: ScoredProduct[] | undefined;
    let comparisonData: any;
    let alternativesData: any;
    let priceComparisonData: ProductPriceComparisonResult | undefined;
    let priceComparisonsData: ProductPriceComparisonResult[] | undefined;
    let targetProductData: Product | undefined;
    let cartActionData: ChatCartActionResult | undefined;
    let updatedCartData: CartSummaryDTO | undefined;
    let isRelaxedMatch = false;
    let relaxedExplanation: string | undefined;
    let newRecommendedIds: string[] = [];
    let persistedReferencedIds: string[] | undefined =
      extracted.referenced_product_ids;
    let shouldPersistRecommendedList = true;
    let generationResult: GenerationTelemetryResult | undefined;
    let filterDurationMs = 0;
    const rankingDurationMs = 0;

    const runExplanation = async (
      params: GroundedResponseParams
    ): Promise<GenerationTelemetryResult> => {
      if (
        isSessionThrottled ||
        extractionResult.quotaExhausted ||
        extractionResult.budgetExhausted
      ) {
        const genStart = Date.now();
        return {
          text: this.geminiService.fallbackGroundedResponse(params),
          source: 'fallback',
          model: this.geminiService.getModelName(),
          durationMs: Date.now() - genStart,
          tokenUsage: this.geminiService.emptyTokenUsage(),
          quotaExhausted: extractionResult.quotaExhausted,
          budgetExhausted: extractionResult.budgetExhausted,
          fallbackReason: extractionResult.fallbackReason,
        };
      }
      return this.geminiService.generateWithTelemetry(params);
    };

    const buildUncataloguedInfo = (): UncataloguedItemInfo => {
      const rule = FilterService.findAccessoryRuleById(
        mergedCriteria.requestedSubtype
      );
      const cleanRawQuery = userMessage
        .replace(
          /^(?:please\s+|can\s+you\s+|could\s+you\s+)?(?:suggest|recommend|find|show\s+me|show|search\s+for|looking\s+for|i\s+need|i\s+want|buy|get)\s+(?:me\s+)?(?:a\s+|an\s+|some\s+|good\s+|best\s+)?/i,
          ''
        )
        .replace(/\s+/g, ' ')
        .trim();

      const requestedItemLabel =
        rule?.displayName ||
        mergedCriteria.requestedSubtypeLabel ||
        mergedCriteria.category ||
        cleanRawQuery ||
        'requested item';

      const searchQuery =
        rule?.searchQueryLabel || cleanRawQuery || requestedItemLabel;
      const categoryHint =
        rule?.retailerCategoryHint ||
        mergedCriteria.retailerCategoryHint ||
        mergedCriteria.category ||
        'electronics';

      const externalSearchLinks = this.priceComparisonService
        ? this.priceComparisonService.generateQuerySearchLinks(
            searchQuery,
            categoryHint
          )
        : [];

      return {
        requestedItemLabel,
        searchQuery,
        relatedCategoryDescription:
          rule?.relatedCategoryDescription ||
          mergedCriteria.relatedCategoryDescription,
        externalSearchLinks,
      };
    };

    const buildNoPriorProductsMessage = (): string => {
      const prevRule = FilterService.findAccessoryRuleById(
        lastRequirements?.requested_subtype || mergedCriteria.requestedSubtype
      );
      if (prevRule) {
        const links = this.priceComparisonService
          ? this.priceComparisonService.generateQuerySearchLinks(
              prevRule.searchQueryLabel,
              prevRule.retailerCategoryHint
            )
          : [];
        const linksMd =
          links.length > 0
            ? `\n\nYou can check external retailers directly using these search links *(unverified search queries — check the retailer's listing for live availability and pricing)*:\n` +
              links
                .map(
                  (s) =>
                    `• [Search "${prevRule.searchQueryLabel}" on ${s.retailerName}](${s.searchUrl})`
                )
                .join('\n')
            : '';
        return `No matching product cards were returned in my previous response because we don't currently carry **${prevRule.displayName}** in our internal catalogue — so there isn't a "first one" or product list to reference, compare, or check prices for yet.${linksMd}\n\nWould you like me to search for a category we have in stock (such as **${prevRule.relatedCategoryDescription}**), or refine your search?`;
      }

      return "No matching products were returned in my previous response, so there isn't a 'first one' or product list to reference, compare, or check prices for yet. Please tell me what product you'd like to search for (for example, 'coding laptops under ₹70000' or 'wireless headphones under ₹5000'), and I'll recommend the best matches!";
    };

    const msgLower = userMessage.toLowerCase();
    const hasExplicitOrdinal =
      /\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last|top\s+one|top\s+pick|cheaper\s+one)\b/i.test(
        msgLower
      ) ||
      Boolean(
        extracted.referenced_index !== undefined &&
          extracted.referenced_index > 0
      ) ||
      Boolean(
        extracted.referenced_product_ids &&
          extracted.referenced_product_ids.length > 0
      );

    const hasMultiOrdinal =
      /\b(?:first|top|last|bottom)\s+(?:two|2|three|3|four|4)\b/i.test(
        msgLower
      ) ||
      Boolean(
        extracted.referenced_indices &&
          extracted.referenced_indices.length >= 2
      );

    const hasSingularPronoun =
      /\b(this|it|that\s+one|this\s+one|this\s+product|that\s+product)\b/i.test(
        msgLower
      );

    const hasPluralPronoun =
      /\b(these|them|those|both\s+of\s+them)\b/i.test(msgLower);

    const currentTurnHasExplicitProductSubject = Boolean(
      extracted.category || extracted.brand || extracted.requested_subtype
    );

    const prevFocusedProductId =
      lastRequirements?.referenced_product_ids &&
      lastRequirements.referenced_product_ids.length > 0 &&
      lastRecommendedIds.includes(lastRequirements.referenced_product_ids[0])
        ? lastRequirements.referenced_product_ids[0]
        : undefined;

    const isPriceLinkQuery =
      Boolean(this.priceComparisonService) &&
      this.geminiService.isPriceOrPurchaseLinkQuery(userMessage);

    if (isPriceLinkQuery && this.priceComparisonService) {
      // Check if user explicitly mentioned a product name from lastRecommendedIds or from the full catalogue
      let explicitlyNamedProduct: Product | undefined;
      if (lastRecommendedIds.length > 0) {
        const recentProds = this.productRepo.findByIds(lastRecommendedIds);
        explicitlyNamedProduct = recentProds.find((p) => {
          const brandAndModel = p.name
            .toLowerCase()
            .split(/\s+/)
            .slice(0, 2)
            .join(' ');
          return brandAndModel.length >= 4 && msgLower.includes(brandAndModel);
        });
      }
      if (
        !explicitlyNamedProduct &&
        !hasExplicitOrdinal &&
        !hasSingularPronoun &&
        !hasPluralPronoun
      ) {
        const queryToResolve = extracted.explicit_product_query || userMessage;
        const resolvedFromCatalogue =
          this.filterService.resolveProductByModelQuery(queryToResolve);
        if (resolvedFromCatalogue.product) {
          explicitlyNamedProduct = resolvedFromCatalogue.product;
        }
      }

      if (
        explicitlyNamedProduct ||
        (lastRecommendedIds.length > 0 &&
          ((hasExplicitOrdinal && targetProductId) ||
            lastRecommendedIds.length === 1 ||
            hasSingularPronoun ||
            Boolean(prevFocusedProductId)))
      ) {
        const chosenId =
          explicitlyNamedProduct?.id ||
          (hasExplicitOrdinal
            ? targetProductId
            : prevFocusedProductId ||
              targetProductId ||
              lastRecommendedIds[0])!;
        const prod = this.productRepo.findById(chosenId);
        if (prod) {
          const comp =
            await this.priceComparisonService.getProductPriceComparison(
              prod.id
            );
          if (comp) {
            priceComparisonData = comp;
            priceComparisonsData = [comp];
          }
          targetProductData = prod;
          returnProducts = [prod];
          newRecommendedIds =
            lastRecommendedIds.length > 1 ? lastRecommendedIds : [prod.id];
          persistedReferencedIds = [prod.id];
          generationResult = await runExplanation({
            userMessage,
            intent: extracted.intent,
            targetProduct: prod,
            priceComparisons: priceComparisonsData,
            conversationContext: history,
          });
          assistantResponseText = generationResult.text;
        }
      } else if (lastRecommendedIds.length > 1) {
        // User has not selected a particular product among multiple recommendations:
        // compare offers for the strongest matching recommendations and include a concise clarification.
        const topIds = lastRecommendedIds.slice(0, 3);
        const topProds = this.productRepo.findByIds(topIds);
        const comps: ProductPriceComparisonResult[] = [];
        for (const p of topProds) {
          const comp =
            await this.priceComparisonService.getProductPriceComparison(p.id);
          if (comp) comps.push(comp);
        }
        returnProducts = topProds;
        newRecommendedIds = lastRecommendedIds;
        priceComparisonsData = comps;
        priceComparisonData = comps[0];

        const clarificationNote =
          "Since multiple products are in your current recommendations, I've compared retailer links and prices for your top matches above. Which specific product would you like to focus on (e.g., 'the first one' or 'the second one')?";

        generationResult = await runExplanation({
          userMessage,
          intent: extracted.intent,
          products: topProds,
          priceComparisons: comps,
          clarificationNote,
          conversationContext: history,
        });
        assistantResponseText = generationResult.text;
      } else if (
        currentTurnHasExplicitProductSubject &&
        !hasExplicitOrdinal &&
        !hasMultiOrdinal &&
        (mergedCriteria.category ||
          mergedCriteria.brand ||
          mergedCriteria.requestedSubtype)
      ) {
        // User specified a new product category/brand in the current query
        const filterStart = Date.now();
        const relaxationResult =
          this.relaxationService.searchWithRelaxation(mergedCriteria);
        filterDurationMs = Date.now() - filterStart;

        isRelaxedMatch = relaxationResult.isRelaxed;
        relaxedExplanation = relaxationResult.explanation;
        returnScoredProducts = relaxationResult.products;
        returnProducts = relaxationResult.products.map((sp) => sp.product);
        newRecommendedIds = returnProducts.map((p) => p.id);

        if (returnProducts.length > 0) {
          const comps: ProductPriceComparisonResult[] = [];
          for (const p of returnProducts.slice(0, 3)) {
            const comp =
              await this.priceComparisonService.getProductPriceComparison(p.id);
            if (comp) comps.push(comp);
          }
          priceComparisonsData = comps;
          priceComparisonData = comps[0];

          generationResult = await runExplanation({
            userMessage,
            intent: extracted.intent,
            products: relaxationResult.products,
            priceComparisons: comps,
            isRelaxedMatch,
            relaxedExplanation,
            conversationContext: history,
          });
          assistantResponseText = generationResult.text;
        } else {
          const uncataloguedInfo = buildUncataloguedInfo();
          generationResult = await runExplanation({
            userMessage,
            intent: extracted.intent,
            products: [],
            uncataloguedItemInfo: uncataloguedInfo,
            isRelaxedMatch: false,
            relaxedExplanation,
            conversationContext: history,
          });
          assistantResponseText = generationResult.text;
        }
      } else {
        // No products were recommended in the previous response
        returnProducts = [];
        newRecommendedIds = [];
        assistantResponseText = buildNoPriorProductsMessage();
      }
    } else {
      // 5. STEP 4: Standard Intent-Driven Deterministic Routing
      switch (extracted.intent) {
        case 'CASUAL': {
          shouldPersistRecommendedList = false;
          generationResult = await runExplanation({
            userMessage,
            intent: 'CASUAL',
            conversationContext: history,
          });
          assistantResponseText = generationResult.text;
          break;
        }

        case 'RESTOCK_NOTIFY': {
          let chosenId =
            (hasExplicitOrdinal && targetProductId)
              ? targetProductId
              : prevFocusedProductId || targetProductId || lastRecommendedIds[0];

          if (!chosenId) {
            const allProds = this.productRepo.findMany({ inStockOnly: false, limit: 250 });
            const matched = allProds.find((p) => {
              const brandAndModel = p.name.toLowerCase().split(/\s+/).slice(0, 2).join(' ');
              return brandAndModel.length >= 4 && msgLower.includes(brandAndModel);
            });
            if (matched) chosenId = matched.id;
          }

          const prod = chosenId ? this.productRepo.findById(chosenId) : undefined;
          if (prod) {
            targetProductData = prod;
            returnProducts = [prod];
            newRecommendedIds =
              lastRecommendedIds.length > 1 ? lastRecommendedIds : [prod.id];
            persistedReferencedIds = [prod.id];

            const selectedVarLabel =
              extracted.selected_size || extracted.selected_color || undefined;

            assistantResponseText =
              !prod.availability || (prod.stock_count ?? 25) <= 0
                ? `**${prod.name}**${selectedVarLabel ? ` (${selectedVarLabel})` : ''} is currently out of stock. Use the **Notify Me When Available** card below (or click **Notify Me** on the product card) to subscribe with your email—we'll record your subscription in our database and mark it eligible for notification as soon as stock is replenished.`
                : `**${prod.name}** is currently in stock (${prod.stock_count ?? 25} unit(s) available), or if a specific size/colour variant is out of stock, you can subscribe using the **Notify Me When Available** form below!`;
          } else {
            returnProducts = [];
            newRecommendedIds = [];
            assistantResponseText =
              "Which out-of-stock product or variant would you like me to notify you about? You can also click **Notify Me When Available** directly on any out-of-stock product card or detail modal.";
          }
          break;
        }

        case 'ADD_TO_CART': {
          const quantityToAdd = Math.max(1, extracted.quantity_requested || 1);

          // Check if user explicitly named one of the recommended products or a catalogue product
          let namedProduct: Product | undefined;
          if (lastRecommendedIds.length > 0) {
            const recentProds = this.productRepo.findByIds(lastRecommendedIds);
            namedProduct = recentProds.find((p) => {
              const brandAndModel = p.name
                .toLowerCase()
                .split(/\s+/)
                .slice(0, 2)
                .join(' ');
              return brandAndModel.length >= 4 && msgLower.includes(brandAndModel);
            });
          }
          if (
            !namedProduct &&
            !hasExplicitOrdinal &&
            !hasSingularPronoun &&
            !hasPluralPronoun
          ) {
            const resolvedFromCat = this.filterService.resolveProductByModelQuery(
              extracted.explicit_product_query || userMessage
            );
            if (resolvedFromCat.product) {
              namedProduct = resolvedFromCat.product;
            }
          }

          if (
            namedProduct ||
            (lastRecommendedIds.length > 0 &&
              ((hasExplicitOrdinal && targetProductId) ||
                lastRecommendedIds.length === 1 ||
                Boolean(prevFocusedProductId)))
          ) {
            const chosenId =
              namedProduct?.id ||
              (hasExplicitOrdinal
                ? targetProductId
                : prevFocusedProductId || lastRecommendedIds[0])!;
            const prod = this.productRepo.findById(chosenId);

            if (prod) {
              targetProductData = prod;
              returnProducts = [prod];
              newRecommendedIds =
                lastRecommendedIds.length > 1 ? lastRecommendedIds : [prod.id];
              persistedReferencedIds = [prod.id];

              if (this.cartOrderService) {
                try {
                  const defaultVariant =
                    !extracted.selected_variant_id &&
                    !extracted.selected_size &&
                    !extracted.selected_color &&
                    prod.variants &&
                    prod.variants.length > 0
                      ? prod.variants.find((v) => v.isDefault && v.availability) ||
                        prod.variants.find((v) => v.availability)
                      : undefined;

                  updatedCartData = this.cartOrderService.addItem(
                    activeSessionId,
                    prod.id,
                    quantityToAdd,
                    {
                      variantId:
                        extracted.selected_variant_id || defaultVariant?.id,
                      selectedSize:
                        extracted.selected_size || defaultVariant?.size,
                      selectedColor:
                        extracted.selected_color || defaultVariant?.color,
                    }
                  );
                  const resolvedSize =
                    extracted.selected_size || defaultVariant?.size;
                  const resolvedColor =
                    extracted.selected_color || defaultVariant?.color;
                  const variantNote =
                    resolvedSize || resolvedColor
                      ? ` (${[resolvedSize, resolvedColor].filter(Boolean).join(' · ')})`
                      : '';
                  const confirmMsg = `Added **${quantityToAdd} × ${prod.name}${variantNote}** (₹${prod.price.toLocaleString('en-IN')}) to your shopping cart! Your cart now has **${updatedCartData.totalQuantity} item(s)** with a subtotal of **₹${updatedCartData.pricing.subtotal.toLocaleString('en-IN')}**.`;
                  cartActionData = {
                    action: 'added',
                    product: prod,
                    quantity: quantityToAdd,
                    cart: updatedCartData,
                    message: confirmMsg,
                  };
                  assistantResponseText = confirmMsg;
                } catch (err: any) {
                  const errMsg =
                    err?.message || `Could not add ${prod.name} to your cart.`;
                  cartActionData = {
                    action: 'failed',
                    product: prod,
                    quantity: quantityToAdd,
                    message: errMsg,
                  };
                  assistantResponseText = `I couldn't add **${prod.name}** to your cart: ${errMsg}`;
                }
              } else {
                const confirmMsg = `Added **${quantityToAdd} × ${prod.name}** (₹${prod.price.toLocaleString('en-IN')}) to your shopping cart!`;
                cartActionData = {
                  action: 'added',
                  product: prod,
                  quantity: quantityToAdd,
                  message: confirmMsg,
                };
                assistantResponseText = confirmMsg;
              }
            }
          } else if (lastRecommendedIds.length > 1) {
            // Multiple products in context and user gave an ambiguous reference ("Add it to my cart" / "Add to cart")
            const contextProds = this.productRepo.findByIds(lastRecommendedIds);
            returnProducts = contextProds;
            newRecommendedIds = lastRecommendedIds;
            const numberedOptions = contextProds
              .slice(0, 4)
              .map(
                (p, idx) =>
                  `${idx + 1}. **${p.name}** (₹${p.price.toLocaleString('en-IN')})`
              )
              .join('\n');
            const clarifyMsg = `Which product from your current recommendations would you like to add to your cart?\n\n${numberedOptions}\n\nPlease reply with **"Add the first one to my cart"** or **"Add the second one to my cart"** (or click **Add to Cart** directly on the product card).`;
            cartActionData = {
              action: 'clarification_needed',
              message:
                'Multiple products are in your current recommendations. Please specify which one to add.',
            };
            assistantResponseText = clarifyMsg;
          } else {
            returnProducts = [];
            newRecommendedIds = [];
            const noPriorMsg = buildNoPriorProductsMessage();
            cartActionData = {
              action: 'failed',
              message: noPriorMsg,
            };
            assistantResponseText = noPriorMsg;
          }
          break;
        }

        case 'PRODUCT_DETAILS': {
          let resolvedTargetId = targetProductId;
          if (
            !resolvedTargetId &&
            !hasExplicitOrdinal &&
            !hasSingularPronoun &&
            !hasPluralPronoun
          ) {
            const resolvedFromCat = this.filterService.resolveProductByModelQuery(
              extracted.explicit_product_query || userMessage
            );
            if (resolvedFromCat.product) {
              resolvedTargetId = resolvedFromCat.product.id;
            }
          }
          if (resolvedTargetId) {
            const prod = this.productRepo.findById(resolvedTargetId);
            if (prod) {
              targetProductData = prod;
              returnProducts = [prod];
              newRecommendedIds =
                lastRecommendedIds.length > 1 ? lastRecommendedIds : [prod.id];
              persistedReferencedIds = [prod.id];
              generationResult = await runExplanation({
                userMessage,
                intent: 'PRODUCT_DETAILS',
                targetProduct: prod,
                conversationContext: history,
              });
              assistantResponseText = generationResult.text;
            }
          }
          if (!targetProductData) {
            assistantResponseText =
              lastRecommendedIds.length === 0 &&
              (hasExplicitOrdinal || hasSingularPronoun || hasPluralPronoun)
                ? buildNoPriorProductsMessage()
                : "I couldn't identify which product you were referring to. Please specify the product name or choose from the recommendations!";
          }
          break;
        }

        case 'ALTERNATIVES': {
          let resolvedAltTargetId = targetProductId;
          if (
            !resolvedAltTargetId &&
            !hasExplicitOrdinal &&
            !hasSingularPronoun &&
            !hasPluralPronoun
          ) {
            const resolvedFromCat = this.filterService.resolveProductByModelQuery(
              extracted.explicit_product_query || userMessage
            );
            if (resolvedFromCat.product) {
              resolvedAltTargetId = resolvedFromCat.product.id;
            }
          }
          if (resolvedAltTargetId) {
            const targetProdObj = this.productRepo.findById(resolvedAltTargetId);
            const wantsCheaper =
              /\b(cheaper|less\s+expensive|lower\s+price|more\s+affordable|budget\s+alternative)\b/i.test(
                msgLower
              );
            const effectiveMaxPrice =
              wantsCheaper && targetProdObj
                ? Math.min(mergedCriteria.maxPrice ?? Infinity, Math.max(1, targetProdObj.price - 1))
                : mergedCriteria.maxPrice;

            let altResult = this.alternativesService.findAlternatives(
              resolvedAltTargetId,
              3,
              {
                maxPrice: effectiveMaxPrice,
                minPrice: mergedCriteria.minPrice,
                useCases: mergedCriteria.useCases,
              }
            );
            // If no strictly cheaper alternative exists in that category, fall back to standard alternatives
            if ((!altResult || altResult.alternatives.length === 0) && wantsCheaper) {
              altResult = this.alternativesService.findAlternatives(
                resolvedAltTargetId,
                3,
                {
                  maxPrice: mergedCriteria.maxPrice,
                  minPrice: mergedCriteria.minPrice,
                  useCases: mergedCriteria.useCases,
                }
              );
            }
            if (altResult && altResult.alternatives.length > 0) {
              alternativesData = altResult;
              targetProductData = altResult.targetProduct;
              returnProducts = altResult.alternatives.map((a) => ({
                ...a.product,
                matchExplanation: a.similarityReason,
              }));
              newRecommendedIds = returnProducts.map((p) => p.id);
              persistedReferencedIds =
                returnProducts.length > 0
                  ? [returnProducts[0].id]
                  : [resolvedAltTargetId];
              generationResult = await runExplanation({
                userMessage,
                intent: 'ALTERNATIVES',
                alternatives: altResult,
                conversationContext: history,
              });
              assistantResponseText = generationResult.text;
            }
          }
          if (!alternativesData) {
            assistantResponseText =
              lastRecommendedIds.length === 0 &&
              (hasExplicitOrdinal || hasSingularPronoun || hasPluralPronoun)
                ? buildNoPriorProductsMessage()
                : "I couldn't find suitable alternatives for that product in our catalogue. Try searching for a different category or price range!";
          }
          break;
        }

        case 'COMPARE': {
          const explicitComparisonQueries =
            extracted.comparison_queries && extracted.comparison_queries.length >= 2
              ? extracted.comparison_queries
              : FilterService.extractExplicitComparisonQueries(userMessage);

          let compareIds = resolvedProductIds;
          let missingExplicitQueries: string[] = [];

          if (explicitComparisonQueries.length >= 2) {
            const filterStart = Date.now();
            const explicitResolution =
              this.filterService.resolveExplicitProductsFromQueries(
                explicitComparisonQueries
              );
            filterDurationMs = Date.now() - filterStart;

            compareIds = explicitResolution.matchedProducts.map((p) => p.id);
            missingExplicitQueries = explicitResolution.unmatchedQueries;

            // Case 1: Only 1 of the explicitly named products exists in the catalogue
            if (
              explicitResolution.matchedProducts.length === 1 &&
              missingExplicitQueries.length >= 1
            ) {
              const foundProd = explicitResolution.matchedProducts[0];
              targetProductData = foundProd;
              returnProducts = [foundProd];
              newRecommendedIds = [foundProd.id];
              persistedReferencedIds = [foundProd.id];

              const isMoto =
                (foundProd.product_type || '').toLowerCase() === 'motorcycle' ||
                (foundProd.product_type || '').toLowerCase() === 'scooter' ||
                /\b(motorcycle|roadster|cruiser|scrambler|scooter)\b/i.test(
                  foundProd.name
                );

              const priceDisplay = `₹${foundProd.price.toLocaleString('en-IN')}${isMoto ? ' (Ex-Showroom)' : ''}`;
              const specEntries = Object.entries(foundProd.specifications || {})
                .slice(0, 5)
                .map(([k, v]) => `**${k.replace(/_/g, ' ')}**: ${v}`)
                .join(' • ');

              const missingLinksBlocks = missingExplicitQueries.map((missingQ) => {
                const encoded = encodeURIComponent(missingQ);
                const links = isMoto
                  ? [
                      `[Search on BikeWale](https://www.bikewale.com/m/search/?q=${encoded})`,
                      `[Search on Amazon India](https://www.amazon.in/s?k=${encoded})`,
                      `[Search on Flipkart](https://www.flipkart.com/search?q=${encoded})`,
                    ]
                  : [
                      `[Search on Amazon India](https://www.amazon.in/s?k=${encoded})`,
                      `[Search on Flipkart](https://www.flipkart.com/search?q=${encoded})`,
                      `[Search on Croma](https://www.croma.com/searchB?q=${encoded}%3Arelevance)`,
                    ];
                return `• **${missingQ}**: Not found in the SmartCart AI internal catalogue — ${links.join(' • ')}`;
              });

              const altResult = this.alternativesService.findAlternatives(
                foundProd.id,
                2
              );
              const altPrompt =
                altResult && altResult.alternatives.length > 0
                  ? `\n\nWould you like to compare **${foundProd.name}** against verified models available in our catalogue instead, such as **${altResult.alternatives.map((a) => `${a.product.name} (₹${a.product.price.toLocaleString('en-IN')})`).join('** or **')}**?`
                  : '';

              assistantResponseText =
                `I found **${foundProd.name}** in the SmartCart AI catalogue, but **${missingExplicitQueries.join(' and ')}** ${missingExplicitQueries.length > 1 ? 'are' : 'is'} not currently in our internal catalogue.\n\n` +
                `### **Found in SmartCart AI Catalogue**\n` +
                `• **${foundProd.name}** (${foundProd.brand}) — **${priceDisplay}** (${foundProd.rating}★ from ${foundProd.review_count.toLocaleString('en-IN')} reviews)\n` +
                (specEntries ? `• **Verified Specifications**: ${specEntries}\n` : '') +
                `• **Key Features**: ${foundProd.features.join(', ')}\n` +
                (isMoto
                  ? `• **Fulfillment**: Verified Catalogue Record • Dealer Enquiry / Specification View\n`
                  : '') +
                `\n### **Not in Internal Catalogue (External Search Links)**\n` +
                `${missingLinksBlocks.join('\n')}` +
                altPrompt;
              break;
            }

            // Case 2: None of the explicitly named products exist in the catalogue
            if (explicitResolution.matchedProducts.length === 0) {
              returnProducts = [];
              newRecommendedIds = [];
              const missingLinksBlocks = explicitComparisonQueries.map((missingQ) => {
                const encoded = encodeURIComponent(missingQ);
                return `• **${missingQ}**: [Search on Amazon India](https://www.amazon.in/s?k=${encoded}) • [Search on Flipkart](https://www.flipkart.com/search?q=${encoded})`;
              });
              assistantResponseText =
                `Neither **${explicitComparisonQueries.join('** nor **')}** was found in the SmartCart AI internal product catalogue, so I cannot generate a verified side-by-side specification comparison.\n\n` +
                `### **External Retailer Search Links**\n` +
                `${missingLinksBlocks.join('\n')}\n\n` +
                `You can also use the **Request this product** button below to ask us to add these models to our catalogue.`;
              break;
            }
          }

          if (compareIds.length < 2 && lastRecommendedIds.length >= 2) {
            compareIds = lastRecommendedIds.slice(0, 2);
          }

          if (compareIds.length < 2 && lastRecommendedIds.length === 0) {
            returnProducts = [];
            newRecommendedIds = [];
            assistantResponseText = buildNoPriorProductsMessage();
            break;
          }

          const compResult = this.comparisonService.compareProducts(
            compareIds,
            mergedCriteria.useCases
          );
          if (compResult.success) {
            comparisonData = compResult.data;
            returnProducts = compResult.data.products;
            newRecommendedIds =
              explicitComparisonQueries.length >= 2
                ? returnProducts.map((p) => p.id)
                : lastRecommendedIds.length >= returnProducts.length
                  ? lastRecommendedIds
                  : returnProducts.map((p) => p.id);
            persistedReferencedIds = compareIds;

            const partialMissingNote =
              missingExplicitQueries.length > 0
                ? `Note: **${missingExplicitQueries.join(', ')}** was not found in our internal catalogue (${missingExplicitQueries
                    .map(
                      (q) =>
                        `[Search on Amazon India](https://www.amazon.in/s?k=${encodeURIComponent(q)}) • [Search on Flipkart](https://www.flipkart.com/search?q=${encodeURIComponent(q)})`
                    )
                    .join(' | ')}), so I have compared the ${returnProducts.length} matched products from our catalogue.`
                : undefined;

            generationResult = await runExplanation({
              userMessage,
              intent: 'COMPARE',
              comparison: compResult.data,
              clarificationNote: partialMissingNote,
              conversationContext: history,
            });
            assistantResponseText = generationResult.text;
          } else {
            assistantResponseText = `To compare products, please select or name 2 to 4 products from our catalogue or your previous recommendations. (${compResult.error})`;
          }
          break;
        }

        case 'QUESTION_ON_PREVIOUS': {
          if (
            lastRecommendedIds.length === 0 &&
            !currentTurnHasExplicitProductSubject
          ) {
            returnProducts = [];
            newRecommendedIds = [];
            assistantResponseText = buildNoPriorProductsMessage();
            break;
          }
          if (
            lastRecommendedIds.length > 0 &&
            !currentTurnHasExplicitProductSubject
          ) {
            const focusProd =
              hasExplicitOrdinal && targetProductId
                ? (this.productRepo.findById(targetProductId) ?? undefined)
                : undefined;
            const contextProds = this.productRepo.findByIds(lastRecommendedIds);
            targetProductData = focusProd;
            returnProducts = focusProd ? [focusProd] : contextProds;
            newRecommendedIds = lastRecommendedIds;
            if (focusProd) {
              persistedReferencedIds = [focusProd.id];
            }
            generationResult = await runExplanation({
              userMessage,
              intent: 'QUESTION_ON_PREVIOUS',
              targetProduct: focusProd,
              products: contextProds,
              conversationContext: history,
            });
            assistantResponseText = generationResult.text;
            break;
          }
          // Fall through to SEARCH/REFINE if a new product subject was specified
        }
        // eslint-disable-next-line no-fallthrough
        case 'SEARCH':
        case 'REFINE':
        default: {
          if (
            lastRecommendedIds.length === 0 &&
            !currentTurnHasExplicitProductSubject &&
            (hasExplicitOrdinal ||
              hasMultiOrdinal ||
              hasSingularPronoun ||
              hasPluralPronoun)
          ) {
            returnProducts = [];
            newRecommendedIds = [];
            assistantResponseText = buildNoPriorProductsMessage();
            break;
          }

          const filterStart = Date.now();
          const relaxationResult =
            this.relaxationService.searchWithRelaxation(mergedCriteria);
          filterDurationMs = Date.now() - filterStart;

          isRelaxedMatch = relaxationResult.isRelaxed;
          relaxedExplanation = relaxationResult.explanation;
          returnScoredProducts = relaxationResult.products;
          returnProducts = relaxationResult.products.map((sp) => sp.product);
          newRecommendedIds = returnProducts.map((p) => p.id);

          if (returnProducts.length === 0) {
            const uncataloguedInfo = buildUncataloguedInfo();
            generationResult = await runExplanation({
              userMessage,
              intent: extracted.intent,
              products: [],
              uncataloguedItemInfo: uncataloguedInfo,
              isRelaxedMatch: false,
              relaxedExplanation,
              conversationContext: history,
            });
            assistantResponseText = generationResult.text;
          } else {
            generationResult = await runExplanation({
              userMessage,
              intent: extracted.intent,
              products: relaxationResult.products,
              isRelaxedMatch,
              relaxedExplanation,
              conversationContext: history,
            });
            assistantResponseText = generationResult.text;
          }
          break;
        }
      }
    }

    // Enrich returned products with purchase links when PriceComparisonService is available
    if (this.priceComparisonService) {
      returnProducts =
        this.priceComparisonService.enrichProductsWithPurchaseLinks(
          returnProducts
        );
      if (returnScoredProducts) {
        returnScoredProducts = returnScoredProducts.map((sp) => ({
          ...sp,
          product:
            this.priceComparisonService!.enrichProductWithPurchaseLinks(
              sp.product
            ),
        }));
      }
      if (targetProductData) {
        targetProductData =
          this.priceComparisonService.enrichProductWithPurchaseLinks(
            targetProductData
          );
      }
    }

    // 6. STEP 5: Post-Generation Security Sanitization & Catalogue Grounding Verification
    assistantResponseText = this.securityService.sanitizeOutput(assistantResponseText);
    returnProducts = returnProducts.filter((p) => Boolean(p && p.id && this.productRepo.findById(p.id)));
    returnScoredProducts = returnScoredProducts?.filter((sp) =>
      Boolean(sp && sp.product && sp.product.id && this.productRepo.findById(sp.product.id))
    );

    // 7. STEP 6: Session History & Context Persistence
    // Do NOT persist brand/category/filter constraints from a COMPARE turn
    // so they never pollute subsequent independent shopping searches.
    const shouldPersistFilterCriteria =
      extracted.intent !== 'COMPARE' &&
      extracted.intent !== 'PRODUCT_REQUEST';

    const isSessionStillCurrent =
      (this.sessionGenerationMap.get(activeSessionId) ?? 0) === sessionGenerationAtStart;

    if (isSessionStillCurrent) {
      this.sessionRepo.addMessage({
        sessionId: activeSessionId,
        role: 'assistant',
        content: assistantResponseText,
        recommendedProductIds: shouldPersistRecommendedList
          ? newRecommendedIds
          : undefined,
        extractedRequirements: {
          ...extracted,
          category: shouldPersistFilterCriteria ? mergedCriteria.category : undefined,
          requested_subtype: shouldPersistFilterCriteria ? mergedCriteria.requestedSubtype : undefined,
          excluded_product_types: shouldPersistFilterCriteria ? mergedCriteria.excludedProductTypes : undefined,
          referenced_product_ids: persistedReferencedIds,
          max_price: shouldPersistFilterCriteria ? mergedCriteria.maxPrice : undefined,
          min_price: shouldPersistFilterCriteria ? mergedCriteria.minPrice : undefined,
          brand: shouldPersistFilterCriteria ? mergedCriteria.brand : undefined,
          features: shouldPersistFilterCriteria ? mergedCriteria.features : undefined,
          use_cases: shouldPersistFilterCriteria ? mergedCriteria.useCases : undefined,
        },
      });
    }

    // 8. Generate dynamic follow-up suggestions
    const suggestions = this.generateSuggestions(
      extracted.intent,
      returnProducts,
      isRelaxedMatch
    );

    // 9. Build RequestDiagnostics
    const totalDurationMs = Date.now() - overallStartTime;
    const consideredCount = mergedCriteria.category
      ? this.productRepo.findMany({ category: mergedCriteria.category }).length
      : this.productRepo.count();

    const combinedTokenUsage = this.geminiService.combineTokenUsage(
      extractionResult.tokenUsage,
      generationResult?.tokenUsage
    );
    const budgetStatus = this.geminiService.getBudgetStatus();
    const quotaExhausted = Boolean(
      extractionResult.quotaExhausted || generationResult?.quotaExhausted
    );
    const budgetExhausted = Boolean(
      extractionResult.budgetExhausted ||
        generationResult?.budgetExhausted ||
        budgetStatus.budgetExhausted
    );

    const diagnostics: RequestDiagnostics = {
      correlationId,
      detectedIntent: extracted.intent,
      structuredIntent: extracted.structured_intent,
      extractionSource: extractionResult.source,
      explanationSource: generationResult ? generationResult.source : 'fallback',
      model:
        generationResult?.model ||
        extractionResult.model ||
        this.geminiService.getModelName(),
      durationMs: totalDurationMs,
      stageDurationsMs: {
        extractionMs: extractionResult.durationMs,
        filteringMs: filterDurationMs,
        rankingMs: rankingDurationMs,
        explanationMs: generationResult ? generationResult.durationMs : 0,
      },
      productsConsidered: consideredCount,
      productsSelected: returnProducts.length,
      isCached: false,
      throttled: isSessionThrottled || undefined,
      duplicateSubmitBlocked: false,
      quotaExhausted: quotaExhausted || undefined,
      budgetExhausted: budgetExhausted || undefined,
      tokenUsage: combinedTokenUsage,
      budgetStatus,
      fallbackReason: extractionResult.fallbackReason || generationResult?.fallbackReason,
    };

    const outOfStockProd =
      (targetProductData && (!targetProductData.availability || (targetProductData.stock_count ?? 25) <= 0)
        ? targetProductData
        : undefined) ||
      returnProducts.find((p) => !p.availability || (p.stock_count ?? 25) <= 0) ||
      (extracted.intent === 'RESTOCK_NOTIFY' ? targetProductData || returnProducts[0] : undefined);

    const offerRestockNotification = outOfStockProd
      ? {
          productId: outOfStockProd.id,
          productName: outOfStockProd.name,
          variantId: extracted.selected_variant_id || undefined,
          variantLabel:
            [extracted.selected_size, extracted.selected_color].filter(Boolean).join(' · ') || undefined,
        }
      : undefined;

    const offerProductRequestForm =
      returnProducts.length === 0 &&
      ['SEARCH', 'REFINE', 'PRODUCT_REQUEST'].includes(extracted.intent)
        ? {
            suggestedName: buildUncataloguedInfo().requestedItemLabel,
            suggestedCategory: mergedCriteria.category,
            reason:
              relaxedExplanation ||
              'Item is not currently in our internal catalogue.',
          }
        : undefined;

    const responseDto: ChatResponseDTO = {
      sessionId: activeSessionId,
      message: assistantResponseText,
      products: returnProducts,
      scoredProducts: returnScoredProducts,
      targetProduct: targetProductData,
      comparison: comparisonData,
      alternatives: alternativesData,
      priceComparison: priceComparisonData,
      priceComparisons: priceComparisonsData,
      cartAction: cartActionData,
      cart: updatedCartData,
      offerProductRequestForm,
      offerRestockNotification,
      activeRequirements: {
        category: mergedCriteria.category,
        requested_subtype: mergedCriteria.requestedSubtype,
        excluded_product_types: mergedCriteria.excludedProductTypes,
        max_price: mergedCriteria.maxPrice,
        min_price: mergedCriteria.minPrice,
        brand: mergedCriteria.brand,
        features: mergedCriteria.features,
        use_cases: mergedCriteria.useCases,
      },
      intent: extracted.intent,
      isRelaxedMatch,
      relaxedExplanation,
      suggestions,
      diagnostics,
    };

    // Update per-session rate state only if session was not reset while in-flight
    if (isSessionStillCurrent) {
      this.sessionRateMap.set(activeSessionId, {
        lastRequestAt: now,
        lastNormalizedMessage: normalizedMessage,
        lastResponse: responseDto,
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[ShoppingAssistant] Correlation: ${correlationId} | Intent: ${extracted.intent} | Extraction: ${extractionResult.source} (${extractionResult.durationMs}ms) | Generation: ${diagnostics.explanationSource} (${diagnostics.stageDurationsMs?.explanationMs}ms) | Tokens: ${combinedTokenUsage.totalTokenCount} (${combinedTokenUsage.usageSource}) | Total: ${totalDurationMs}ms`
      );
    }

    return responseDto;
  }

  /**
   * Generates intelligent, contextual quick-reply chips for the frontend
   */
  private generateSuggestions(
    _intent: ShoppingIntent,
    products: Product[],
    isRelaxedMatch: boolean
  ): string[] {
    if (products.length >= 2) {
      return [
        'Compare the first two',
        'Add the second one to my cart',
        'Which is better for me?',
        'Where can I buy the first one?',
      ];
    }
    if (products.length === 1) {
      return [
        'Add this to my cart',
        'Where can I buy this?',
        'Compare this on Amazon and Flipkart',
        'Show me an alternative to this',
      ];
    }
    if (isRelaxedMatch) {
      return [
        'Show options with higher budget',
        'Show without brand constraint',
        'What else can you recommend?',
      ];
    }
    return [
      'Wireless headphones under ₹3000 for gym',
      'Best phones under ₹25000',
      'Smartwatches with Bluetooth calling',
      'Gaming laptops under ₹70000',
    ];
  }
}

