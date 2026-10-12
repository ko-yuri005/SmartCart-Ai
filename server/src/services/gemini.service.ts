import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { env } from '../config/env.js';
import {
  BudgetStatusTelemetry,
  ExtractedRequirements,
  Message,
  Product,
  ProductPriceComparisonResult,
  ScoredProduct,
  ShoppingIntent,
  TokenUsageTelemetry,
} from '../types/index.js';
import { ComparisonResult } from './comparison.service.js';
import { AlternativeResult } from './alternatives.service.js';
import { FilterService } from './filter.service.js';

// Schema validating the extraction output
const ExtractedRequirementsSchema = z.object({
  intent: z
    .enum([
      'SEARCH',
      'REFINE',
      'COMPARE',
      'PRODUCT_DETAILS',
      'ALTERNATIVES',
      'QUESTION_ON_PREVIOUS',
      'ADD_TO_CART',
      'RESTOCK_NOTIFY',
      'PRODUCT_REQUEST',
      'CASUAL',
      'CONFIDENTIALITY_PROBE',
    ])
    .default('SEARCH'),
  category: z.string().optional(),
  categories: z.array(z.string()).optional(),
  min_price: z.number().optional(),
  max_price: z.number().optional(),
  brand: z.string().optional(),
  features: z.array(z.string()).optional(),
  use_cases: z.array(z.string()).optional(),
  attributes: z.record(z.union([z.string(), z.number()])).optional(),
  referenced_product_ids: z.array(z.string()).optional(),
  referenced_index: z.number().optional(),
  referenced_indices: z.array(z.number()).optional(),
  requested_subtype: z.string().optional(),
  excluded_product_types: z.array(z.string()).optional(),
  sort_preference: z.enum(['price_asc', 'price_desc', 'rating', 'relevance']).optional(),
  quantity_requested: z.number().optional(),
  selected_size: z.string().optional(),
  selected_color: z.string().optional(),
  selected_variant_id: z.string().optional(),
  query_summary: z.string().optional(),
});


export interface UncataloguedItemInfo {
  requestedItemLabel: string;
  searchQuery: string;
  relatedCategoryDescription?: string;
  externalSearchLinks: {
    retailerId: string;
    retailerName: string;
    searchUrl: string;
    categoryFit: string;
  }[];
}

export interface GroundedResponseParams {
  userMessage: string;
  intent: ShoppingIntent;
  products?: Product[] | ScoredProduct[];
  targetProduct?: Product;
  comparison?: ComparisonResult;
  alternatives?: AlternativeResult;
  priceComparisons?: ProductPriceComparisonResult[];
  uncataloguedItemInfo?: UncataloguedItemInfo;
  clarificationNote?: string;
  isRelaxedMatch?: boolean;
  relaxedExplanation?: string;
  conversationContext?: Message[];
}

export interface ExtractionTelemetryResult {
  requirements: ExtractedRequirements;
  source: 'gemini' | 'fallback';
  model?: string;
  durationMs: number;
  tokenUsage: TokenUsageTelemetry;
  quotaExhausted?: boolean;
  budgetExhausted?: boolean;
  fallbackReason?: string;
}

export interface GenerationTelemetryResult {
  text: string;
  source: 'gemini' | 'fallback';
  model?: string;
  durationMs: number;
  tokenUsage: TokenUsageTelemetry;
  quotaExhausted?: boolean;
  budgetExhausted?: boolean;
  fallbackReason?: string;
}

export interface GeminiGuardrailConfig {
  maxOutputTokensExtraction?: number;
  maxOutputTokensExplanation?: number;
  maxRetries?: number;
  dailyRequestBudget?: number;
  dailyTokenBudget?: number;
  inputCostPer1MUsd?: number;
  outputCostPer1MUsd?: number;
}

export interface GeminiServiceOptions extends GeminiGuardrailConfig {
  apiKey?: string;
  modelName?: string;
  client?: {
    models: {
      generateContent: (params: any) => Promise<any>;
    };
  } | null;
}

export class GeminiService {
  private client: { models: { generateContent: (params: any) => Promise<any> } } | null = null;
  private modelName: string;
  private maxOutputTokensExtraction: number;
  private maxOutputTokensExplanation: number;
  private maxRetries: number;
  private dailyRequestBudget: number;
  private dailyTokenBudget: number;
  private inputCostPer1MUsd: number;
  private outputCostPer1MUsd: number;

  private dailyRequestsUsed = 0;
  private dailyTokensUsed = 0;
  private currentBudgetDay: string = new Date().toISOString().slice(0, 10);

  constructor(
    apiKeyOrOptions: string | GeminiServiceOptions = env.GEMINI_API_KEY,
    modelName = env.GEMINI_MODEL,
    guardrails: GeminiGuardrailConfig = {}
  ) {
    const isOptionsObj =
      typeof apiKeyOrOptions === 'object' && apiKeyOrOptions !== null;
    const resolvedApiKey = isOptionsObj
      ? apiKeyOrOptions.apiKey ?? ''
      : apiKeyOrOptions;
    const resolvedModelName = isOptionsObj
      ? apiKeyOrOptions.modelName ?? env.GEMINI_MODEL
      : modelName;
    const resolvedGuardrails: GeminiGuardrailConfig = isOptionsObj
      ? apiKeyOrOptions
      : guardrails;

    this.modelName = resolvedModelName || 'gemini-2.5-flash';
    this.maxOutputTokensExtraction =
      resolvedGuardrails.maxOutputTokensExtraction ??
      env.GEMINI_MAX_OUTPUT_TOKENS_EXTRACTION;
    this.maxOutputTokensExplanation =
      resolvedGuardrails.maxOutputTokensExplanation ??
      env.GEMINI_MAX_OUTPUT_TOKENS_EXPLANATION;
    this.maxRetries = Math.max(
      0,
      resolvedGuardrails.maxRetries ?? env.GEMINI_MAX_RETRIES
    );
    this.dailyRequestBudget = Math.max(
      0,
      resolvedGuardrails.dailyRequestBudget ?? env.GEMINI_DAILY_REQUEST_BUDGET
    );
    this.dailyTokenBudget = Math.max(
      0,
      resolvedGuardrails.dailyTokenBudget ?? env.GEMINI_DAILY_TOKEN_BUDGET
    );
    this.inputCostPer1MUsd =
      resolvedGuardrails.inputCostPer1MUsd ?? env.GEMINI_INPUT_COST_PER_1M_USD;
    this.outputCostPer1MUsd =
      resolvedGuardrails.outputCostPer1MUsd ?? env.GEMINI_OUTPUT_COST_PER_1M_USD;

    if (isOptionsObj && apiKeyOrOptions.client !== undefined) {
      this.client = apiKeyOrOptions.client;
    } else if (
      typeof resolvedApiKey === 'string' &&
      resolvedApiKey.trim().length > 0 &&
      resolvedApiKey !== 'your_gemini_api_key_here'
    ) {
      try {
        this.client = new GoogleGenAI({ apiKey: resolvedApiKey });
      } catch {
        console.warn('[GeminiService] Failed to initialize GoogleGenAI client.');
        this.client = null;
      }
    }
  }

  public isClientConfigured(): boolean {
    return this.client !== null;
  }

  public isAvailable(): boolean {
    return this.client !== null;
  }

  public getModelName(): string {
    return this.modelName;
  }

  public getGuardrailConfig(): Required<GeminiGuardrailConfig> {
    return {
      maxOutputTokensExtraction: this.maxOutputTokensExtraction,
      maxOutputTokensExplanation: this.maxOutputTokensExplanation,
      maxRetries: this.maxRetries,
      dailyRequestBudget: this.dailyRequestBudget,
      dailyTokenBudget: this.dailyTokenBudget,
      inputCostPer1MUsd: this.inputCostPer1MUsd,
      outputCostPer1MUsd: this.outputCostPer1MUsd,
    };
  }

  private ensureBudgetDayCurrent(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.currentBudgetDay) {
      this.currentBudgetDay = today;
      this.dailyRequestsUsed = 0;
      this.dailyTokensUsed = 0;
    }
  }

  public getBudgetStatus(): BudgetStatusTelemetry {
    this.ensureBudgetDayCurrent();
    const budgetExhausted =
      this.dailyRequestsUsed >= this.dailyRequestBudget ||
      this.dailyTokensUsed >= this.dailyTokenBudget;
    return {
      dailyRequestsUsed: this.dailyRequestsUsed,
      dailyRequestBudget: this.dailyRequestBudget,
      dailyTokensUsed: this.dailyTokensUsed,
      dailyTokenBudget: this.dailyTokenBudget,
      budgetExhausted,
    };
  }

  public resetDailyBudget(): void {
    this.dailyRequestsUsed = 0;
    this.dailyTokensUsed = 0;
    this.currentBudgetDay = new Date().toISOString().slice(0, 10);
  }

  public emptyTokenUsage(): TokenUsageTelemetry {
    return {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
      usageSource: 'none',
      estimatedCostUsd: 0,
      costIsEstimate: true,
    };
  }

  public combineTokenUsage(
    a?: TokenUsageTelemetry,
    b?: TokenUsageTelemetry
  ): TokenUsageTelemetry {
    const promptTokenCount = (a?.promptTokenCount ?? 0) + (b?.promptTokenCount ?? 0);
    const candidatesTokenCount =
      (a?.candidatesTokenCount ?? 0) + (b?.candidatesTokenCount ?? 0);
    const totalTokenCount = (a?.totalTokenCount ?? 0) + (b?.totalTokenCount ?? 0);
    const hasActual =
      a?.usageSource === 'actual_provider' || b?.usageSource === 'actual_provider';
    const estimatedCostUsd = Number(
      ((a?.estimatedCostUsd ?? 0) + (b?.estimatedCostUsd ?? 0)).toFixed(8)
    );
    return {
      promptTokenCount,
      candidatesTokenCount,
      totalTokenCount,
      usageSource: hasActual ? 'actual_provider' : 'none',
      estimatedCostUsd,
      costIsEstimate: true,
    };
  }

  public isQuotaOrRateLimitError(error: any): boolean {
    if (!error) return false;
    const status = error.status ?? error.statusCode ?? error.code ?? error?.error?.code;
    if (status === 429 || status === 'RESOURCE_EXHAUSTED') return true;
    const msg = String(error.message || error?.error?.message || error).toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('resource_exhausted') ||
      msg.includes('quota') ||
      msg.includes('rate limit') ||
      msg.includes('rate_limit') ||
      msg.includes('too many requests')
    );
  }

  private extractUsageFromResponse(response: any): TokenUsageTelemetry {
    const meta = response?.usageMetadata;
    if (
      meta &&
      (typeof meta.promptTokenCount === 'number' ||
        typeof meta.candidatesTokenCount === 'number' ||
        typeof meta.totalTokenCount === 'number')
    ) {
      const promptTokenCount = meta.promptTokenCount ?? 0;
      const candidatesTokenCount = meta.candidatesTokenCount ?? 0;
      const totalTokenCount =
        meta.totalTokenCount ?? promptTokenCount + candidatesTokenCount;
      this.dailyTokensUsed += totalTokenCount;
      const estimatedCostUsd = Number(
        (
          (promptTokenCount / 1_000_000) * this.inputCostPer1MUsd +
          (candidatesTokenCount / 1_000_000) * this.outputCostPer1MUsd
        ).toFixed(8)
      );
      return {
        promptTokenCount,
        candidatesTokenCount,
        totalTokenCount,
        usageSource: 'actual_provider',
        estimatedCostUsd,
        costIsEstimate: true,
      };
    }
    return this.emptyTokenUsage();
  }

  /**
   * Executes a Gemini generateContent call with strict budget checks, explicit maxOutputTokens,
   * bounded retries, and zero-retry stop on HTTP 429 / quota-exhaustion errors.
   */
  private async callModelWithGuardrails(params: {
    contents: string;
    temperature: number;
    maxOutputTokens: number;
    responseMimeType?: string;
  }): Promise<{
    ok: boolean;
    text?: string;
    tokenUsage: TokenUsageTelemetry;
    quotaExhausted?: boolean;
    budgetExhausted?: boolean;
    fallbackReason?: string;
  }> {
    if (!this.client) {
      return {
        ok: false,
        tokenUsage: this.emptyTokenUsage(),
        fallbackReason: 'GEMINI_API_KEY is not configured or client is offline',
      };
    }

    const budgetBefore = this.getBudgetStatus();
    if (budgetBefore.budgetExhausted) {
      return {
        ok: false,
        tokenUsage: this.emptyTokenUsage(),
        budgetExhausted: true,
        fallbackReason: `Daily Gemini API budget exhausted (requests: ${budgetBefore.dailyRequestsUsed}/${budgetBefore.dailyRequestBudget}, tokens: ${budgetBefore.dailyTokensUsed}/${budgetBefore.dailyTokenBudget}). Using deterministic fallback.`,
      };
    }

    let lastError: any;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const currentBudget = this.getBudgetStatus();
      if (currentBudget.budgetExhausted) {
        return {
          ok: false,
          tokenUsage: this.emptyTokenUsage(),
          budgetExhausted: true,
          fallbackReason: `Daily Gemini API budget exhausted (requests: ${currentBudget.dailyRequestsUsed}/${currentBudget.dailyRequestBudget}, tokens: ${currentBudget.dailyTokensUsed}/${currentBudget.dailyTokenBudget}). Using deterministic fallback.`,
        };
      }

      this.dailyRequestsUsed += 1;

      try {
        const config: Record<string, any> = {
          temperature: params.temperature,
          maxOutputTokens: params.maxOutputTokens,
        };
        if (params.responseMimeType) {
          config.responseMimeType = params.responseMimeType;
        }
        if (this.modelName.includes('2.5')) {
          config.thinkingConfig = { thinkingBudget: 0 };
        }

        const response = await this.client.models.generateContent({
          model: this.modelName,
          contents: params.contents,
          config,
        });

        const tokenUsage = this.extractUsageFromResponse(response);
        return {
          ok: true,
          text: response.text || '',
          tokenUsage,
        };
      } catch (err: any) {
        lastError = err;
        // NEVER retry HTTP 429 or quota exhaustion errors
        if (this.isQuotaOrRateLimitError(err)) {
          return {
            ok: false,
            tokenUsage: this.emptyTokenUsage(),
            quotaExhausted: true,
            fallbackReason:
              'Gemini API rate limit or quota exceeded (HTTP 429). Automatically switched to deterministic fallback.',
          };
        }
        if (attempt >= this.maxRetries) {
          break;
        }
      }
    }

    return {
      ok: false,
      tokenUsage: this.emptyTokenUsage(),
      fallbackReason: lastError?.message || 'Model API call failed',
    };
  }

  /**
   * Extracts shopping requirements and returns safe telemetry on model execution.
   */
  public async extractWithTelemetry(
    userMessage: string,
    conversationContext: Message[] = []
  ): Promise<ExtractionTelemetryResult> {
    const startTime = Date.now();
    if (!userMessage || userMessage.trim().length === 0) {
      return {
        requirements: { intent: 'CASUAL' },
        source: 'fallback',
        durationMs: Date.now() - startTime,
        tokenUsage: this.emptyTokenUsage(),
      };
    }

    // Keep conversation context compact: at most 4 recent messages, max 250 chars each
    const recentHistoryText = conversationContext
      .slice(-4)
      .map((m) => `${m.role.toUpperCase()}: ${(m.content || '').slice(0, 250)}`)
      .join('\n');

    const compactUserMessage = userMessage.slice(0, 600);

    const systemPrompt = `You are a deterministic shopping intent and requirement extractor for a general-purpose online shopping assistant.
Extract structured requirements into a single compact JSON object.

Allowed intents: SEARCH, REFINE, COMPARE, PRODUCT_DETAILS, ALTERNATIVES, QUESTION_ON_PREVIOUS, CASUAL, CONFIDENTIALITY_PROBE.
Supported categories: "automotive", "fashion", "kurtis-kurtas", "sarees", "ethnic-sets-festive-wear", "womens-ethnic-wear", "western-wear", "womens-outerwear", "footwear", "furniture", "kitchen-appliances", "beauty-personal-care", "sports-fitness", "headphones", "smartphones", "smartwatches", "laptops", "keyboards-mice", "power-accessories", "books", "travel-luggage", "gifts".

RULES:
1. Do NOT parse non-monetary unit constraints (350cc, 16GB RAM, 15-inch, 1 litre, family of 4, six hours) as min_price or max_price.
2. Parse Indian currency: "1.5 lakh" -> 150000, "1.2L" -> 120000, "70k" -> 70000, "under ₹1500" -> 1500.
3. If budget is vague ("not too expensive", "cheap"), omit max_price and set sort_preference = "price_asc".
4. NEVER map an accessory query ("laptop cooling pad", "laptop stand", "phone case", "screen protector", "camera tripod", "helmet visor", "watch strap") to its parent device category ("laptops", "smartphones", "automotive", "smartwatches"). Omit category and set requested_subtype instead.
5. Output ONLY valid JSON matching: { intent, category?, requested_subtype?, min_price?, max_price?, brand?, features?, use_cases?, attributes?, referenced_index?, referenced_indices?, referenced_product_ids?, sort_preference? }.`;

    const userContent = `Recent Context:\n${recentHistoryText || 'None'}\n\nUser Message: "${compactUserMessage}"`;

    const callResult = await this.callModelWithGuardrails({
      contents: `${systemPrompt}\n\n${userContent}`,
      temperature: 0.0,
      maxOutputTokens: this.maxOutputTokensExtraction,
      responseMimeType: 'application/json',
    });

    if (!callResult.ok || !callResult.text) {
      const fallbackReqs = this.fallbackDeterministicExtraction(userMessage, conversationContext);
      return {
        requirements: fallbackReqs,
        source: 'fallback',
        model: this.modelName,
        durationMs: Date.now() - startTime,
        tokenUsage: callResult.tokenUsage,
        quotaExhausted: callResult.quotaExhausted,
        budgetExhausted: callResult.budgetExhausted,
        fallbackReason: callResult.fallbackReason,
      };
    }

    const parsed = this.parseAndValidateExtraction(
      callResult.text,
      userMessage,
      conversationContext
    );
    return {
      requirements: parsed,
      source: 'gemini',
      model: this.modelName,
      durationMs: Date.now() - startTime,
      tokenUsage: callResult.tokenUsage,
    };
  }

  /**
   * Deterministically extracts structured shopping requirements from user message.
   * Runs at temperature = 0.0 with JSON validation.
   */
  public async extractShoppingRequirements(
    userMessage: string,
    conversationContext: Message[] = []
  ): Promise<ExtractedRequirements> {
    const res = await this.extractWithTelemetry(userMessage, conversationContext);
    return res.requirements;
  }

  /**
   * Safely parses and validates JSON output from Gemini, falling back if malformed
   */
  public parseAndValidateExtraction(
    rawJson: string,
    userMessage: string,
    conversationContext: Message[] = []
  ): ExtractedRequirements {
    try {
      // Clean possible markdown code fences if model enclosed it
      const cleaned = rawJson
        .replace(/^```json/im, '')
        .replace(/^```/im, '')
        .replace(/```$/im, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      const validated = ExtractedRequirementsSchema.safeParse(parsed);

      if (validated.success) {
        return this.postProcessExtractedRequirements(
          validated.data,
          userMessage,
          conversationContext
        );
      }
      console.warn('[GeminiService] Extraction schema validation warning:', validated.error);
      return this.fallbackDeterministicExtraction(userMessage, conversationContext);
    } catch (err) {
      console.warn('[GeminiService] Failed to parse model output as JSON:', err);
      return this.fallbackDeterministicExtraction(userMessage, conversationContext);
    }
  }

  /**
   * Enforces deterministic post-extraction guardrails on both LLM and fallback outputs:
   * 1. Prevents accessory queries ("laptop cooling pad", "phone case", "camera tripod", "helmet visor")
   *    from being classified into parent device categories ("laptops", "smartphones", "automotive").
   * 2. Normalizes multi-ordinal ("first two") and single-ordinal ("first one") references and COMPARE intent.
   */
  public postProcessExtractedRequirements(
    reqs: ExtractedRequirements,
    userMessage: string,
    _conversationContext: Message[] = []
  ): ExtractedRequirements {
    const text = (userMessage || '').toLowerCase().trim();
    const result: ExtractedRequirements = { ...reqs, currency: 'INR' };

    // 1. Accessory / specific subtype disambiguation
    const combinedText = [
      userMessage,
      result.requested_subtype,
      result.category,
      ...(result.features || []),
    ]
      .filter(Boolean)
      .join(' ');

    const matchedRule =
      FilterService.findAccessoryRuleById(result.requested_subtype) ||
      FilterService.detectAccessoryRule(combinedText);

    if (matchedRule) {
      result.requested_subtype = matchedRule.subtypeId;
      result.excluded_product_types = Array.from(
        new Set([
          ...(result.excluded_product_types || []),
          ...matchedRule.excludedProductTypes,
        ])
      );

      // Clear parent device category if LLM or fallback mapped accessory to parent category
      if (
        result.category &&
        (matchedRule.parentCategoriesToOverride.includes(
          result.category.toLowerCase().trim()
        ) ||
          matchedRule.triggerRegex.test(result.category))
      ) {
        result.category = undefined;
      }

      // Remove the accessory noun itself from secondary features so RelaxationService never relaxes it away
      if (result.features && result.features.length > 0) {
        const cleanedFeatures = result.features.filter((f) => {
          const fl = f.toLowerCase().trim();
          if (matchedRule.triggerRegex.test(fl)) return false;
          if (
            matchedRule.matchKeywords.some(
              (kw) => kw.includes(fl) || fl.includes(kw)
            )
          ) {
            return false;
          }
          return true;
        });
        result.features = cleanedFeatures.length > 0 ? cleanedFeatures : undefined;
      }
    } else if (result.requested_subtype) {
      // If Gemini set an unrecognized requested_subtype (such as "wireless headphones" or "smartphones")
      // that is NOT a valid accessory rule, map it to category and clear requested_subtype
      if (!result.category) {
        result.category = FilterService.prototype.normalizeCategory(
          result.requested_subtype
        );
      }
      result.requested_subtype = undefined;
    }

    // 1b. Track explicit audio product subtype ("headphones" vs "earbuds" vs "neckband")
    if (
      /\bheadphones?\b/i.test(text) &&
      !/\b(earbuds?|neckbands?|tws|airpods?)\b/i.test(text) &&
      !matchedRule
    ) {
      result.requested_product_type = 'headphones';
      if (!result.category) {
        result.category = 'headphones';
      }
    } else if (/\b(earbuds?|tws|airpods?)\b/i.test(text) && !matchedRule) {
      result.requested_product_type = 'earbuds';
      if (!result.category) {
        result.category = 'headphones';
      }
    } else if (/\bneckbands?\b/i.test(text) && !matchedRule) {
      result.requested_product_type = 'neckband';
      if (!result.category) {
        result.category = 'headphones';
      }
    }

    // 2. Ensure intent, explicit comparison queries, and ordinal references are accurately captured across both Gemini and fallback
    const isPriceLink = this.isPriceOrPurchaseLinkQuery(userMessage);
    const isAddCart = this.isAddToCartQuery(userMessage);
    const isRestockNotify = this.isRestockNotifyQuery(userMessage);
    const explicitComparisonQueries =
      FilterService.extractExplicitComparisonQueries(userMessage);
    const explicitSingleProductQuery =
      FilterService.extractSingleExplicitProductQuery(userMessage);

    if (explicitComparisonQueries.length >= 2) {
      result.comparison_queries = explicitComparisonQueries;
    }
    if (explicitSingleProductQuery) {
      result.explicit_product_query = explicitSingleProductQuery;
    }

    const variantSel = this.extractVariantSelectionFromMessage(userMessage);
    if (variantSel.size) result.selected_size = variantSel.size;
    if (variantSel.color) result.selected_color = variantSel.color;

    if (isRestockNotify) {
      result.intent = 'RESTOCK_NOTIFY';
    } else if (isAddCart) {
      result.intent = 'ADD_TO_CART';
      result.quantity_requested = this.extractCartQuantity(userMessage);
    } else if (isPriceLink && result.intent === 'COMPARE') {
      result.intent =
        _conversationContext.length > 0 ? 'QUESTION_ON_PREVIOUS' : 'PRODUCT_DETAILS';
    } else if (explicitComparisonQueries.length >= 2 && !isPriceLink) {
      result.intent = 'COMPARE';
    } else if (
      !isPriceLink &&
      /\b(alternatives?|similar\s+to|something\s+similar|other\s+options?|different\s+options?|another\s+option|cheaper\s+alternative)\b/i.test(
        text
      )
    ) {
      result.intent = 'ALTERNATIVES';
    } else if (
      !isPriceLink &&
      /\b(compare|comparison|difference\s+between|trade-?offs?|\bvs\.?\b|\bversus\b|\bv\/s\b)\b/i.test(text)
    ) {
      result.intent = 'COMPARE';
    } else if (
      !isPriceLink &&
      /\b(full\s+specifications?|what\s+are\s+the\s+specifications?|tell\s+me\s+more|details?\s+on|specs?\s+of)\b/i.test(
        text
      )
    ) {
      result.intent = 'PRODUCT_DETAILS';
    } else if (
      !isPriceLink &&
      _conversationContext.length > 0 &&
      /\b(which\s+(?:one\s+|product\s+)?(?:is|has)\s+(?:a\s+)?(?:better|best|longer)\b|which\s+should\s+i\s+(?:buy|choose|pick|get)|help\s+me\s+(?:choose|decide)|better\s+warranty)\b/i.test(
        text
      )
    ) {
      result.intent = 'QUESTION_ON_PREVIOUS';
    }

    const hasExplicitOrdinalWord =
      /\b(first|1st|top\s+one|top\s+pick|top\s+two|top\s+2|top\s+three|top\s+3|second|2nd|third|3rd|fourth|4th|fifth|5th|last|bottom|option\s*\d|#\d)\b/i.test(
        text
      );

    if (/\b(?:first|top)\s+(?:two|2)\b/i.test(text)) {
      result.referenced_indices = [1, 2];
      result.referenced_index = undefined;
    } else if (/\b(?:first|top)\s+(?:three|3)\b/i.test(text)) {
      result.referenced_indices = [1, 2, 3];
      result.referenced_index = undefined;
    } else if (/\b(?:last|bottom)\s+(?:two|2)\b/i.test(text)) {
      result.referenced_index = undefined;
    } else if (hasExplicitOrdinalWord) {
      // Single-ordinal normalization
      if (/\b(first\s+one|the\s+first|1st|top\s+one|top\s+pick|first)\b/i.test(text)) {
        result.referenced_index = 1;
      } else if (/\b(second\s+one|the\s+second|2nd|second)\b/i.test(text)) {
        result.referenced_index = 2;
      } else if (/\b(third\s+one|the\s+third|3rd|third)\b/i.test(text)) {
        result.referenced_index = 3;
      } else if (/\b(fourth\s+one|the\s+fourth|4th|fourth)\b/i.test(text)) {
        result.referenced_index = 4;
      } else if (/\b(last\s+one|the\s+last|last)\b/i.test(text)) {
        result.referenced_index = 999;
      }
    } else {
      // Prevent pronoun-only follow-ups ("this", "it") from being assigned an explicit ordinal index by the LLM
      result.referenced_index = undefined;
      result.referenced_indices = undefined;
    }

    // 3. Prevent context-leaked brand or category from polluting referential follow-ups
    if (result.brand && !text.includes(result.brand.toLowerCase())) {
      result.brand = undefined;
    }

    const isReferentialFollowUp =
      isPriceLink ||
      isAddCart ||
      isRestockNotify ||
      result.intent === 'ADD_TO_CART' ||
      result.intent === 'RESTOCK_NOTIFY' ||
      result.intent === 'ALTERNATIVES' ||
      result.intent === 'PRODUCT_DETAILS' ||
      result.intent === 'COMPARE' ||
      result.intent === 'QUESTION_ON_PREVIOUS' ||
      hasExplicitOrdinalWord ||
      /\b(this|it|that\s+one|this\s+one|this\s+product|these|them|those)\b/i.test(text);

    if (isReferentialFollowUp && result.category && !matchedRule) {
      const hasCategoryKeywordInMessage =
        /\b(headphones?|earbuds?|earphones?|neckbands?|tws|airpods|audio|phones?|mobiles?|smartphones?|watch|watches|smartwatch|smartwatches|laptops?|notebooks?|macbooks?|keyboards?|mouse|mice|power\s*banks?|chargers?|adapters?|bikes?|motorcycles?|scooters?|helmets?|dash\s*cams?|hoodies?|jackets?|shirts?|t-?shirts?|jeans|kurta|saree|apparel|clothes|clothing|shoes?|sneakers?|boots?|sandals?|footwear|chairs?|tables?|desks?|bookshelf|sofa|furniture|cookers?|air\s*fryers?|mixers?|blenders?|induction|kettle|cookware|kitchen|sunscreens?|face\s*wash|cleansers?|moisturizers?|serums?|trimmer|dryer|skincare|beauty|yoga\s*mats?|dumbbells?|badminton|cycles?|bicycles?|footballs?|bottles?|gym\s*bag|sports|books?|novels?|backpacks?|luggage|trolleys?|suitcases?|gifts?|perfumes?|wallets?|necklaces?)\b/i.test(
          text
        );
      if (!hasCategoryKeywordInMessage) {
        result.category = undefined;
      }
    }

    // 4. Populate structured_intent for Phase 2 Structured Intent Detection
    if (/\brequest\s+(?:this\s+|a\s+)?product\b/i.test(text)) {
      result.structured_intent = 'MISSING_PRODUCT_REQUEST';
    } else if (isAddCart || result.intent === 'ADD_TO_CART') {
      result.structured_intent = 'ADD_TO_CART';
    } else if (isPriceLink) {
      result.structured_intent = 'PRODUCT_PRICE_LOOKUP';
    } else if (
      result.intent === 'COMPARE' &&
      (!result.comparison_queries || result.comparison_queries.length === 0) &&
      (hasExplicitOrdinalWord ||
        Boolean(result.referenced_index || result.referenced_indices?.length) ||
        /\b(them|these|those|both|the\s+two)\b/i.test(text))
    ) {
      result.structured_intent = 'FOLLOW_UP_REFERENCE';
    } else if (result.intent === 'COMPARE') {
      result.structured_intent = 'PRODUCT_COMPARISON';
    } else if (result.intent === 'PRODUCT_DETAILS' && !hasExplicitOrdinalWord) {
      result.structured_intent = 'PRODUCT_DETAILS';
    } else if (
      result.intent === 'QUESTION_ON_PREVIOUS' ||
      result.intent === 'ALTERNATIVES' ||
      result.intent === 'REFINE' ||
      hasExplicitOrdinalWord ||
      Boolean(result.referenced_index || result.referenced_indices?.length)
    ) {
      result.structured_intent = 'FOLLOW_UP_REFERENCE';
    } else if (result.intent === 'CASUAL') {
      result.structured_intent = 'GENERAL_SHOPPING_QUESTION';
    } else {
      result.structured_intent = 'PRODUCT_SEARCH';
    }

    return result;
  }

  /**
   * Detects if a user query is requesting a restock notification
   * (e.g., "Notify me when this product is back in stock", "Alert me when size XXL is available").
   */
  public isRestockNotifyQuery(userMessage: string): boolean {
    const text = (userMessage || '').toLowerCase().trim();
    if (!text) return false;
    return (
      /\b(?:notify|alert|email|ping|tell|remind)\s+me\b.*\b(?:stock|available|restock|back)\b/i.test(
        text
      ) ||
      /\bback\s+in\s+stock\s+(?:notification|alert|request)\b/i.test(text) ||
      /\bwhen\s+(?:is\s+it|it\s+is|this\s+is)\s+back\s+in\s+stock\b/i.test(text)
    );
  }

  /**
   * Extracts explicit size or colour mentioned in a conversational command
   * (e.g., "in size L", "size UK 9", "in XXL").
   */
  public extractVariantSelectionFromMessage(userMessage: string): {
    size?: string;
    color?: string;
  } {
    const text = (userMessage || '').trim();
    let size: string | undefined;
    const ukMatch = text.match(/\b(UK\s*(?:6|7|8|9|10|11|12))\b/i);
    const alphaMatch = text.match(
      /\b(?:size\s+|in\s+)(XS|S|M|L|XL|XXL)\b/i
    ) || text.match(/\b(XS|XXL|XL)\b/);
    if (ukMatch) {
      size = ukMatch[1].toUpperCase().replace(/\s+/g, ' ');
    } else if (alphaMatch) {
      size = alphaMatch[1].toUpperCase();
    }

    let color: string | undefined;
    const colorMatch = text.match(
      /\b(?:in\s+|color\s+|colour\s+)(black|white|blue|navy|red|crimson|grey|gray|charcoal|green|brown)\b/i
    );
    if (colorMatch) {
      color = colorMatch[1];
    }
    return { size, color };
  }

  /**
   * Detects if a user query is requesting to add a product to the shopping cart
   * (e.g., "Add the second one to my cart", "Add this to cart", "Put 2 of the first one in my cart").
   */
  public isAddToCartQuery(userMessage: string): boolean {
    const text = (userMessage || '').toLowerCase().trim();
    if (!text) return false;

    return (
      /\b(?:add|put|place)\b.*\b(?:to|in|into)\s+(?:my\s+|the\s+)?(?:shopping\s+)?(?:cart|bag|basket)\b/i.test(
        text
      ) ||
      /\b(?:add\s+to\s+cart|put\s+in\s+cart)\b/i.test(text)
    );
  }

  /**
   * Extracts requested item quantity for cart commands (defaults to 1).
   */
  public extractCartQuantity(userMessage: string): number {
    const text = (userMessage || '').toLowerCase().trim();
    const numMatch =
      text.match(/\b(?:add|put|place)\s+(\d+)\s+(?:of\b|units?\b|items?\b|pieces?\b)/i) ||
      text.match(/\b(\d+)\s+(?:units?|items?|pieces?|quantities)\b/i);
    if (numMatch) {
      const parsed = parseInt(numMatch[1], 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 25) {
        return parsed;
      }
    }
    const wordMap: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
    };
    const wordMatch = text.match(
      /\b(?:add|put|place)\s+(one|two|three|four|five)\s+(?:of\b|units?\b|items?\b)/i
    );
    if (wordMatch && wordMap[wordMatch[1].toLowerCase()]) {
      return wordMap[wordMatch[1].toLowerCase()];
    }
    return 1;
  }

  /**
   * Extracts specific retailer names mentioned in a user query
   * (e.g., "Compare this on Amazon and Flipkart" -> ["Amazon India", "Flipkart"]).
   */
  public extractRequestedRetailers(userMessage: string): string[] {
    const text = (userMessage || '').toLowerCase();
    if (!text) return [];

    const patterns: { name: string; regex: RegExp }[] = [
      { name: 'Amazon India', regex: /\bamazon(?:\s+india|\.in)?\b/i },
      { name: 'Flipkart', regex: /\bflipkart\b/i },
      { name: 'Croma', regex: /\bcroma\b/i },
      { name: 'Reliance Digital', regex: /\breliance(?:\s+digital)?\b/i },
      { name: 'Vijay Sales', regex: /\bvijay\s+sales\b/i },
      { name: 'Myntra', regex: /\bmyntra\b/i },
      { name: 'Ajio', regex: /\bajio\b/i },
      { name: 'Nykaa', regex: /\bnykaa\b/i },
      { name: 'Decathlon', regex: /\bdecathlon\b/i },
      { name: 'Pepperfry', regex: /\bpepperfry\b/i },
      { name: 'Urban Ladder', regex: /\burban\s+ladder\b/i },
      { name: 'Bookswagon', regex: /\bbookswagon\b/i },
      { name: 'BikeWale', regex: /\bbikewale\b/i },
      { name: 'Tata CLiQ', regex: /\btata\s*cliq\b/i },
    ];

    return patterns.filter((p) => p.regex.test(text)).map((p) => p.name);
  }

  /**
   * Detects if a user query is asking for product purchase links or cross-website retailer price comparison
   * (e.g., "Where can I buy this?", "Find the cheapest website", "Compare this on Amazon and Flipkart",
   * "Is this cheaper anywhere else?", "Give me the purchase link").
   */
  public isPriceOrPurchaseLinkQuery(userMessage: string): boolean {
    const text = (userMessage || '').toLowerCase().trim();
    if (!text) return false;
    if (this.isAddToCartQuery(userMessage) || this.isRestockNotifyQuery(userMessage)) return false;

    const directPatterns = [
      /\bwhere\s+(?:can\s+i|to|do\s+i|should\s+i)\s+(?:buy|purchase|get|order)\b/i,
      /\b(?:give|show|send|get|share|find)\s+(?:me\s+)?(?:the\s+)?(?:purchase|buy|buying|shopping|product|store|retailer)\s+links?\b/i,
      /\b(?:purchase|buy|buying)\s+links?\b/i,
      /\b(?:cheapest|best|lowest\s+price)\s+(?:website|site|online\s+store|retailer|platform)\b/i,
      /\b(?:which|what)\s+(?:website|site|retailer|online\s+store)\s+(?:is\s+)?(?:cheapest|cheaper|best|has\s+the\s+lowest\s+price)\b/i,
      /\bcheaper\s+(?:anywhere\s+else|on\s+another\s+site|on\s+other\s+websites|elsewhere)\b/i,
      /\b(?:compare\s+prices|price\s+comparison)\s*(?:across|on|between)?\b/i,
    ];

    if (directPatterns.some((rx) => rx.test(text))) {
      return true;
    }

    const mentionsRetailer =
      /\b(amazon|flipkart|croma|reliance\s+digital|vijay\s+sales|myntra|ajio|nykaa|decathlon|pepperfry|urban\s+ladder|bookswagon|bikewale|tata\s*cliq)\b/i.test(
        text
      );
    const mentionsAction =
      /\b(compare|comparison|buy|purchase|price|prices|cheaper|cheapest|link|links|available|availability|offer|offers|check|cost|website|site)\b/i.test(
        text
      );

    return mentionsRetailer && mentionsAction;
  }

  /**
   * Fallback deterministic requirement extractor using regex & heuristic analysis.
   * Ensures the backend continues functioning reliably if Gemini is unavailable or returns invalid JSON.
   */
  public fallbackDeterministicExtraction(
    userMessage: string,
    conversationContext: Message[] = []
  ): ExtractedRequirements {
    const text = userMessage.toLowerCase();

    // 1. Detect Intent
    let intent: ShoppingIntent = 'SEARCH';
    let referencedIndex: number | undefined;
    let referencedIndices: number[] | undefined;
    let sort_preference: 'price_asc' | 'price_desc' | 'rating' | 'relevance' | undefined;

    if (/^(hi|hello|hey|greetings|who are you|what can you do|help)\b/i.test(text.trim())) {
      intent = 'CASUAL';
    } else if (this.isRestockNotifyQuery(userMessage)) {
      intent = 'RESTOCK_NOTIFY';
    } else if (this.isAddToCartQuery(userMessage)) {
      intent = 'ADD_TO_CART';
    } else if (this.isPriceOrPurchaseLinkQuery(userMessage)) {
      intent = conversationContext.length > 0 ? 'QUESTION_ON_PREVIOUS' : 'PRODUCT_DETAILS';
    } else if (
      text.includes('compare') ||
      text.includes('comparison') ||
      text.includes('difference between') ||
      text.includes('trade-off') ||
      text.includes('tradeoff') ||
      /\b(vs\.?|versus|v\/s)\b/i.test(text)
    ) {
      intent = 'COMPARE';
    } else if (
      text.includes('alternative') ||
      text.includes('similar to') ||
      text.includes('something similar') ||
      text.includes('cheaper option') ||
      text.includes('cheaper alternative') ||
      text.includes('other option') ||
      text.includes('different option')
    ) {
      intent = 'ALTERNATIVES';
    } else if (
      text.includes('tell me more') ||
      text.includes('details on') ||
      text.includes('specs of') ||
      text.includes('specification')
    ) {
      intent = 'PRODUCT_DETAILS';
    } else if (
      text.includes('which one') ||
      text.includes('which product') ||
      text.includes('which is best') ||
      text.includes('which is better') ||
      text.includes('better warranty') ||
      text.includes('which should i') ||
      text.includes('help me choose') ||
      text.includes('between these') ||
      text.includes('best for')
    ) {
      intent = conversationContext.length > 0 ? 'QUESTION_ON_PREVIOUS' : 'SEARCH';
    } else if (
      conversationContext.length > 0 &&
      (text.includes('what about') ||
        text.includes('something with') ||
        text.includes('better') ||
        text.includes('cheaper') ||
        text.includes('sasta') ||
        text.includes('instead') ||
        text.includes('actually'))
    ) {
      intent = 'REFINE';
    }


    // Sort preferences
    if (
      text.includes('cheapest') ||
      text.includes('anything cheap') ||
      text.includes('sasta') ||
      text.includes('lowest price') ||
      text.includes('cheaper') ||
      text.includes('not too expensive') ||
      text.includes('without going overboard') ||
      text.includes('budget-friendly') ||
      text.includes('budget sensitive') ||
      text.includes('affordable')
    ) {
      sort_preference = 'price_asc';
    } else if (text.includes('premium') || text.includes('expensive') || text.includes('high end')) {
      sort_preference = 'price_desc';
    } else if (text.includes('best rated') || text.includes('top rated') || text.includes('highest rated')) {
      sort_preference = 'rating';
    }

    // Detect multi-ordinal ("first two" = [1, 2], "first three" = [1, 2, 3]) before single ordinal
    if (/\b(?:first|top)\s+(?:two|2)\b/i.test(text)) {
      referencedIndices = [1, 2];
    } else if (/\b(?:first|top)\s+(?:three|3)\b/i.test(text)) {
      referencedIndices = [1, 2, 3];
    } else if (/\b(?:last|bottom)\s+(?:two|2)\b/i.test(text)) {
      referencedIndex = undefined;
    } else if (text.includes('first') || text.includes('top one') || text.includes('top pick') || text.includes('that one')) {
      referencedIndex = 1;
    } else if (text.includes('second')) {
      referencedIndex = 2;
    } else if (text.includes('third')) {
      referencedIndex = 3;
    } else if (text.includes('fourth')) {
      referencedIndex = 4;
    } else if (text.includes('last')) {
      referencedIndex = 999;
    }

    // 2. Extract Price & Specifications (Unit vs Currency disambiguation)
    const { min_price, max_price, attributes } = this.parsePriceAndAttributes(text);

    // 3. Extract Accessory Subtype FIRST (so "laptop cooling pad" never becomes category = "laptops")
    const accessoryRule = FilterService.detectAccessoryRule(text);
    let requested_subtype: string | undefined;
    let excluded_product_types: string[] | undefined;
    let category: string | undefined;

    if (accessoryRule) {
      requested_subtype = accessoryRule.subtypeId;
      excluded_product_types = [...accessoryRule.excludedProductTypes];
      category = undefined;
    } else if (
      text.includes('power bank') ||
      text.includes('powerbank') ||
      text.includes('charger') ||
      text.includes('adapter') ||
      text.includes('🔋')
    ) {
      category = 'power-accessories';
    } else if (
      text.includes('keyboard') ||
      text.includes('mouse') ||
      text.includes('mice') ||
      text.includes('⌨') ||
      text.includes('🖱')
    ) {
      category = 'keyboards-mice';
    } else if (
      text.includes('bike') ||
      text.includes('motorcycle') ||
      text.includes('scooter') ||
      text.includes('two wheeler') ||
      text.includes('two-wheeler') ||
      text.includes('commuter') ||
      text.includes('helmet') ||
      text.includes('riding gear') ||
      text.includes('dash cam') ||
      text.includes('hunter 350') ||
      text.includes('speed 400') ||
      text.includes('scrambler') ||
      text.includes('himalayan') ||
      text.includes('royal enfield') ||
      text.includes('triumph') ||
      text.includes('🏍') ||
      text.includes('🛵')
    ) {
      category = 'automotive';
    } else if (
      text.includes('saree') ||
      text.includes('sarees') ||
      text.includes('sari') ||
      text.includes('kanjivaram') ||
      text.includes('banarasi')
    ) {
      category = 'sarees';
    } else if (
      text.includes('kurta set') ||
      text.includes('ethnic set') ||
      text.includes('salwar') ||
      text.includes('sharara') ||
      text.includes('festive wear')
    ) {
      category = 'ethnic-sets-festive-wear';
    } else if (
      text.includes('kurti') ||
      text.includes('kurtis') ||
      text.includes('anarkali') ||
      text.includes('chikankari')
    ) {
      category = 'kurtis-kurtas';
    } else if (
      text.includes('ethnic wear') ||
      text.includes("women's ethnic")
    ) {
      category = 'womens-ethnic-wear';
    } else if (
      text.includes('western wear') ||
      text.includes('co-ord') ||
      text.includes('jumpsuit') ||
      text.includes('midi dress') ||
      text.includes('maxi dress') ||
      text.includes('pleated skirt')
    ) {
      category = 'western-wear';
    } else if (
      text.includes("women's outerwear") ||
      text.includes('womens outerwear') ||
      text.includes('trench coat') ||
      text.includes('shrug') ||
      text.includes('poncho') ||
      text.includes('blazer')
    ) {
      category = 'womens-outerwear';
    } else if (
      text.includes('hoodie') ||
      text.includes('jacket') ||
      text.includes('t-shirt') ||
      text.includes('tshirt') ||
      text.includes('shirt') ||
      text.includes('jeans') ||
      text.includes('sweatshirt') ||
      text.includes('apparel') ||
      text.includes('clothing') ||
      text.includes('clothes') ||
      text.includes('kurta') ||
      text.includes('dress') ||
      text.includes('🧥') ||
      text.includes('👕')
    ) {
      category = 'fashion';
    } else if (
      text.includes('running shoe') ||
      text.includes('shoe') ||
      text.includes('shoes') ||
      text.includes('sneaker') ||
      text.includes('sneakers') ||
      text.includes('footwear') ||
      text.includes('boots') ||
      text.includes('sandals') ||
      text.includes('loafers') ||
      text.includes('👟')
    ) {
      category = 'footwear';
    } else if (
      text.includes('table') ||
      text.includes('chair') ||
      text.includes('desk') ||
      text.includes('sofa') ||
      text.includes('bookshelf') ||
      text.includes('bed') ||
      text.includes('furniture') ||
      text.includes('🪑')
    ) {
      category = 'furniture';
    } else if (
      text.includes('cooker') ||
      text.includes('air fryer') ||
      text.includes('blender') ||
      text.includes('mixer') ||
      text.includes('pan') ||
      text.includes('kadai') ||
      text.includes('induction') ||
      text.includes('appliances') ||
      text.includes('kitchen') ||
      text.includes('🍳')
    ) {
      category = 'kitchen-appliances';
    } else if (
      text.includes('sunscreen') ||
      text.includes('sunblock') ||
      text.includes('facewash') ||
      text.includes('face wash') ||
      text.includes('moisturizer') ||
      text.includes('serum') ||
      text.includes('shampoo') ||
      text.includes('perfume') ||
      text.includes('fragrance') ||
      text.includes('skincare') ||
      text.includes('beauty') ||
      text.includes('personal care') ||
      text.includes('🧴')
    ) {
      category = 'beauty-personal-care';
    } else if (
      text.includes('yoga mat') ||
      text.includes('dumbbell') ||
      text.includes('cycle') ||
      text.includes('bicycle') ||
      text.includes('badminton') ||
      text.includes('cricket') ||
      text.includes('water bottle') ||
      text.includes('bottle') ||
      text.includes('sipper') ||
      text.includes('flask') ||
      text.includes('sports') ||
      text.includes('gym equipment') ||
      text.includes('fitness equipment') ||
      text.includes('🏸') ||
      text.includes('🧘')
    ) {
      category = 'sports-fitness';
    } else if (
      text.includes('headphone') ||
      text.includes('earbud') ||
      text.includes('earphone') ||
      text.includes('neckband') ||
      text.includes('tws') ||
      text.includes('airpods') ||
      text.includes('audio') ||
      text.includes('🎧')
    ) {
      category = 'headphones';
    } else if (
      text.includes('phone') ||
      text.includes('mobile') ||
      text.includes('smartphone') ||
      text.includes('cellphone') ||
      text.includes('📱')
    ) {
      category = 'smartphones';
    } else if (
      text.includes('watch') ||
      text.includes('smartwatch') ||
      text.includes('fitness band') ||
      text.includes('⌚')
    ) {
      category = 'smartwatches';
    } else if (
      text.includes('laptop') ||
      text.includes('notebook') ||
      text.includes('macbook') ||
      text.includes('💻')
    ) {
      category = 'laptops';
    } else if (
      text.includes('book') ||
      text.includes('novel') ||
      text.includes('textbook') ||
      text.includes('coding book') ||
      text.includes('programming book') ||
      text.includes('📚')
    ) {
      category = 'books';
    } else if (
      text.includes('backpack') ||
      text.includes('luggage') ||
      text.includes('trolley') ||
      text.includes('suitcase') ||
      text.includes('travel bag') ||
      text.includes('🎒')
    ) {
      category = 'travel-luggage';
    } else if (
      text.includes('gift') ||
      text.includes('birthday') ||
      text.includes('anniversary') ||
      text.includes('girlfriend') ||
      text.includes('🎁')
    ) {
      category = 'gifts';
    } else {
      // Capture unknown category request to avoid returning random products across categories
      const nounMatch = text.match(
        /(?:need|want|find|show|looking for|search for|buy|suggest|recommend)\s+(?:a\s+|an\s+|some\s+)?([a-z0-9_-]+(?:\s+[a-z0-9_-]+)?)\s+(?:under|below|for|with|in|around)/i
      );
      if (nounMatch) {
        const candidateNoun = nounMatch[1].trim().toLowerCase();
        const genericNonCategories = new Set([
          'organic products',
          'organic product',
          'organic items',
          'organic item',
          'certified organic',
          'discounted products',
          'discounted items',
          'sale items',
          'products',
          'product',
          'items',
          'item',
          'options',
          'something',
          'anything',
        ]);
        if (!genericNonCategories.has(candidateNoun) && !candidateNoun.startsWith('organic ')) {
          category = candidateNoun;
        }
      }
    }

    // 4. Extract Brand across all sectors
    let brand: string | undefined;
    const brands = [
      'sony',
      'jbl',
      'boat',
      'oneplus',
      'apple',
      'samsung',
      'realme',
      'noise',
      'soundcore',
      'sennheiser',
      'bose',
      'lenovo',
      'asus',
      'acer',
      'hp',
      'dell',
      'logitech',
      'anker',
      'xiaomi',
      'redmi',
      'poco',
      'motorola',
      'google',
      'nothing',
      'boult',
      'puma',
      'nike',
      'adidas',
      'asics',
      'decathlon',
      'h&m',
      'bewakoof',
      'allen solly',
      'green soul',
      'savya home',
      'featherlite',
      'deckup',
      'urban ladder',
      'prestige',
      'hawkins',
      'pigeon',
      'instant pot',
      'philips',
      'dot & key',
      'minimalist',
      'derma co',
      'la shield',
      'neutrogena',
      'plum',
      'forest essentials',
      'tvs',
      'bajaj',
      'honda',
      'hero',
      'yamaha',
      'royal enfield',
      'triumph',
      'ktm',
      'vega',
      'axor',
      'steelbird',
      'giva',
      'titan',
      'fossil',
      'milton',
      'boldfit',
    ];
    for (const b of brands) {
      if (new RegExp(`\\b${b}\\b`, 'i').test(text)) {
        brand = b;
        break;
      }
    }

    // 5. Extract Features across all sectors
    const features: string[] = [];
    if (text.includes('organic')) features.push('organic');
    if (text.includes('comfortable') || text.includes('cushioned')) features.push('comfortable');
    if (text.includes('black')) features.push('black');
    if (text.includes('cotton')) features.push('cotton');
    if (text.includes('fleece')) features.push('fleece');
    if (text.includes('mesh')) features.push('mesh');
    if (text.includes('ergonomic')) features.push('ergonomic');
    if (text.includes('lumbar')) features.push('lumbar support');
    if (text.includes('spf 50') || text.includes('spf50')) features.push('spf 50');
    if (text.includes('oil free') || text.includes('oil-free') || text.includes('matte')) features.push('oil free');
    if (text.includes('induction')) features.push('induction');
    if (text.includes('isi')) features.push('isi');
    if (text.includes('dot')) features.push('dot');
    if (text.includes('ece')) features.push('ece');
    if (text.includes('abs')) features.push('abs');
    if (text.includes('wireless') || text.includes('bluetooth')) features.push('wireless');
    if (text.includes('anc') || text.includes('noise cancellation')) features.push('anc');
    if (text.includes('bass')) features.push('bass');
    if (
      text.includes('waterproof') ||
      text.includes('water resistant') ||
      text.includes('ipx') ||
      text.includes('ip68')
    )
      features.push('waterproof');
    if (text.includes('fast charge') || text.includes('fast charging')) features.push('fast charging');
    if (text.includes('5g')) features.push('5g');
    if (text.includes('amoled') || text.includes('oled')) features.push('amoled');

    // 6. Extract Use Cases across all sectors
    const use_cases: string[] = [];
    if (text.includes('commuting') || text.includes('commute') || text.includes('daily commute'))
      use_cases.push('daily commuting');
    if (text.includes('walking') || text.includes('daily walking')) use_cases.push('daily walking');
    if (text.includes('running') || text.includes('jogging')) use_cases.push('running');
    if (text.includes('beginner') || text.includes('beginners')) use_cases.push('beginners');
    if (text.includes('small room') || text.includes('compact') || text.includes('small space'))
      use_cases.push('small room');
    if (text.includes('oily skin')) use_cases.push('oily skin');
    if (text.includes('family of 4') || text.includes('family of four') || text.includes('family'))
      use_cases.push('family of 4');
    if (text.includes('gift') || text.includes('girlfriend') || text.includes('birthday') || text.includes('anniversary'))
      use_cases.push('gift');
    if (text.includes('gym') || text.includes('workout') || text.includes('fitness')) use_cases.push('gym');
    if (text.includes('call') || text.includes('calling') || text.includes('meeting')) use_cases.push('calls');
    if (text.includes('gaming') || text.includes('game') || text.includes('gamer')) use_cases.push('gaming');
    if (text.includes('coding') || text.includes('programming') || text.includes('developer'))
      use_cases.push('coding');
    if (text.includes('travel') || text.includes('flights')) use_cases.push('travel');
    if (text.includes('student') || text.includes('college') || text.includes('study'))
      use_cases.push('study');
    if (text.includes('office') || text.includes('work from home') || text.includes('wfh'))
      use_cases.push('office');

    return this.postProcessExtractedRequirements(
      {
        intent,
        category,
        requested_subtype,
        excluded_product_types,
        min_price,
        max_price,
        brand,
        features: features.length > 0 ? features : undefined,
        use_cases: use_cases.length > 0 ? use_cases : undefined,
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
        referenced_index: referencedIndex,
        referenced_indices: referencedIndices,
        sort_preference,
      },
      userMessage,
      conversationContext
    );
  }

  /**
   * Disambiguates monetary budget from non-monetary unit constraints.
   * Prevents queries like "bike under 350cc" from setting max_price: 350,
   * or "water bottle under 1 litre" from setting max_price: 1,
   * or "laptop with 16GB RAM under 70000" from confusing 16GB with budget.
   * Handles Indian denomination formats (e.g. "1.5 lakh" -> 150000, "70k" -> 70000).
   */
  public parsePriceAndAttributes(text: string): {
    min_price?: number;
    max_price?: number;
    attributes: Record<string, string | number>;
  } {
    const attributes: Record<string, string | number> = {};

    // 1. Extract non-monetary specifications and attributes first
    // Engine displacement (e.g. 350cc, 125cc)
    const ccMatch = text.match(/\b(\d+)\s*cc\b/i);
    if (ccMatch) {
      attributes.engine_cc = parseInt(ccMatch[1], 10);
    }

    // Capacity / Volume (e.g. 1 litre, 3.5 litre, 500ml)
    const capMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:litres?|liters?|ltrs?|ml)\b/i);
    if (capMatch) {
      attributes.capacity = capMatch[0];
    }

    // Capacity by people (e.g. family of 4, 4 persons)
    const familyMatch = text.match(/\b(?:family\s+of\s+(\d+)|(\d+)\s*(?:persons?|people|seaters?))\b/i);
    if (familyMatch) {
      attributes.capacity = familyMatch[0];
    }

    // RAM (e.g. 16GB RAM, 8GB)
    const ramMatch = text.match(/\b(\d+)\s*(?:gb|tb)\s*(?:ram)?\b/i);
    if (ramMatch) {
      attributes.ram = ramMatch[0];
    }

    // Display size (e.g. 55 inches, 15.6 inch)
    const screenMatch = text.match(/\b(\d+(?:\.\d+)?)\s*inch(?:es)?\b/i);
    if (screenMatch) {
      attributes.display_size = screenMatch[0];
    }

    // Clothing / Shoe Size (e.g. size 9, size M)
    const sizeMatch = text.match(/\bsize\s+(\d+|[smlx]+)\b/i);
    if (sizeMatch) {
      attributes.size = sizeMatch[1];
    }

    // 2. Create a sanitized copy of text where non-monetary unit quantities are masked
    // so generic price patterns never falsely match non-monetary units.
    // NOTE: We do NOT mask 'lakh', 'lac', or 'k' because those are currency multipliers!
    const sanitizedText = text.replace(
      /\b(\d+(?:\.\d+)?)\s*(cc|ml|ltrs?|litres?|liters?|kgs?|grams?|gms?|mg|lbs?|pounds?|gb|mb|tb|kb|inch(?:es)?|in\b|cms?|mms?|meters?|ft|feet|hz|khz|mhz|ghz|watts?|w\b|kw|volts?|v\b|rpm|fps|mp|megapixels?|mah|ah|persons?|seaters?|people|family\s+of\s+\d+|sizes?\s+\d+|hours?|hrs?|days?|months?|weeks?|mins?|minutes?)\b/gi,
      '__NON_PRICE_UNIT__'
    );

    // Helper to calculate Indian denomination multipliers (lakh = 100,000, k = 1,000, cr = 10,000,000)
    const parseAmount = (numStr: string, multiplier?: string): number => {
      const clean = parseFloat(numStr.replace(/,/g, ''));
      if (isNaN(clean)) return 0;
      if (multiplier) {
        const m = multiplier.toLowerCase().trim();
        if (m.startsWith('lakh') || m.startsWith('lac') || m === 'l') return Math.round(clean * 100000);
        if (m === 'k') return Math.round(clean * 1000);
        if (m.startsWith('cr')) return Math.round(clean * 10000000);
      }
      return Math.round(clean);
    };

    let min_price: number | undefined;
    let max_price: number | undefined;

    // A. Range pattern: "between ₹2000 and ₹5000", "from 10k to 20k", "2000 - 5000"
    const rangeMatch = sanitizedText.match(
      /(?:between|from)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|l\b|k\b)?\s*(?:to|and|-)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|l\b|k\b)?/i
    );
    if (rangeMatch) {
      min_price = parseAmount(rangeMatch[1], rangeMatch[2]);
      max_price = parseAmount(rangeMatch[3], rangeMatch[4]);
    }

    // B. Max price patterns: "under ₹3000", "under ₹1,000", "below 1.5 lakh", "budget 70k", "with a budget of 3000", "around 1.2L"
    if (!max_price) {
      const maxPriceMatch =
        sanitizedText.match(
          /(?:under|below|less than|within|max|upto|up to|budget(?: of)?|with\s+(?:a\s+)?budget(?:\s+of)?|make\s+(?:that|it)|change\s+to|increase\s+to|around)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|l\b|k\b)?/i
        ) ||
        sanitizedText.match(/(?:with\s+)?(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|l\b|k\b)?\s*(?:to spend|to spend on it)/i) ||
        // Suffix currency e.g. "1.5 lakh budget", "1.2L", "1500 rupees"
        sanitizedText.match(/\b(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|l\b)\b/i) ||
        sanitizedText.match(/(?:₹|rs\.?|inr)\s*(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|l\b|k\b)?/i) ||
        sanitizedText.match(/\b(\d[\d,]*(?:\.\d+)?)\s*(?:k\b)\s*(?:budget|price)?/i) ||
        sanitizedText.match(/\b(\d[\d,]*(?:\.\d+)?)\s*(?:₹|rs\.?|inr|rupees)/i);

      if (maxPriceMatch) {
        max_price = parseAmount(maxPriceMatch[1], maxPriceMatch[2]);
      }
    }

    // C. Min price patterns: "above 1000", "starting from 5000", "more than 10k", "at least 1500"
    if (!min_price) {
      const minPriceMatch = sanitizedText.match(
        /(?:above|more than|at least|min|minimum|starting from)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|k\b)?/i
      );
      if (minPriceMatch) {
        min_price = parseAmount(minPriceMatch[1], minPriceMatch[2]);
      }
    }

    // Swap if contradictory min > max
    if (min_price !== undefined && max_price !== undefined && min_price > max_price) {
      const temp = min_price;
      min_price = max_price;
      max_price = temp;
    }

    return { min_price, max_price, attributes };
  }

  /**
   * Rewrites any generic markdown link labels like [Search Link](url) or [Link](url)
   * into explicit retailer labels like [Search on Amazon India](url).
   */
  public sanitizeRetailerMarkdownLinks(text: string): string {
    if (!text) return text;
    return text.replace(
      /\[\s*(?:search\s+link|link|search|retailer\s+link|store\s+link)\s*\]\((https?:\/\/[^)\s]+)\)/gi,
      (_match, url: string) => {
        const lowerUrl = url.toLowerCase();
        let retailerName = 'Retailer';
        if (lowerUrl.includes('amazon.in') || lowerUrl.includes('amazon.com')) {
          retailerName = 'Amazon India';
        } else if (lowerUrl.includes('flipkart.com')) {
          retailerName = 'Flipkart';
        } else if (lowerUrl.includes('croma.com')) {
          retailerName = 'Croma';
        } else if (lowerUrl.includes('reliancedigital.in')) {
          retailerName = 'Reliance Digital';
        } else if (lowerUrl.includes('myntra.com')) {
          retailerName = 'Myntra';
        } else if (lowerUrl.includes('nykaa.com')) {
          retailerName = 'Nykaa';
        } else if (lowerUrl.includes('tatacliq.com')) {
          retailerName = 'Tata CLiQ';
        } else if (lowerUrl.includes('vijaysales.com')) {
          retailerName = 'Vijay Sales';
        } else if (lowerUrl.includes('ajio.com')) {
          retailerName = 'AJIO';
        } else if (lowerUrl.includes('bikewale.com')) {
          retailerName = 'BikeWale';
        } else if (lowerUrl.includes('zigwheels.com')) {
          retailerName = 'ZigWheels';
        }
        return `[Search on ${retailerName}](${url})`;
      }
    );
  }

  /**
   * Generates grounded response and returns safe telemetry on model execution.
   */
  public async generateWithTelemetry(params: GroundedResponseParams): Promise<GenerationTelemetryResult> {
    const startTime = Date.now();

    const systemInstruction = `You are the lead AI shopping concierge for SmartCart AI ("Shop Smarter. Choose Better.").
Your tone is helpful, friendly, natural, and grounded in verified catalogue facts.

CRITICAL RULES:
1. Ground all statements, product names, prices (formatted in ₹), ratings, and specs ONLY in the verified data provided in this prompt.
2. NEVER hallucinate, invent, or assume products, prices, ratings, discounts, shipping costs, stock status, or retailer URLs that are not in the provided verified data.
3. If no products matched and constraints were relaxed, explain the relaxation honestly and clearly without claiming an exact match.
4. Explain clearly WHY each product fits the user's requirements.
5. For comparisons, explain the factual differences (price, rating, key specs) based strictly on the comparison matrix provided. For motorcycles and two-wheelers, explicitly label prices as Ex-Showroom, note Dealer Enquiry / Specification View fulfillment, and state "Not specified in catalogue" for any missing attribute (such as seat height or warranty).
6. When products include both exact over-ear headphones and items marked isRelatedAlternative (wireless earbuds or neckbands), present exact over-ear headphones first (honestly noting if gym/sweat resistance is not specified in their catalogue record) and present wireless earbuds/neckbands in a clearly labelled "Related alternatives" section without claiming an earbud is an over-ear headphone.
7. When CROSS-WEBSITE PRICE COMPARISON & PURCHASE LINKS or UNCATALOGUED ITEM search links are provided:
   - Strictly distinguish between a confirmed live verified price, a cached verified price, a stale cached price, an incomplete price (unknown shipping), and an unverified retailer search link.
   - NEVER claim that a retailer has the lowest price unless lowestVerifiedOffer is explicitly populated in the verified data.
   - Always format retailer search links as [Search on <Retailer Name>](<searchUrl>) (e.g. [Search on Amazon India](https://...)). NEVER write generic labels like [Search Link] or [Link].
8. Keep recommendations concise, engaging, and easy to read with bullet points or short paragraphs.`;

    const requestedRetailers = this.extractRequestedRetailers(params.userMessage || '');
    const dataContext = this.formatDataContextForPrompt(params);
    const compactQuestion = (params.userMessage || '').slice(0, 600);
    const prompt = `${systemInstruction}\n\n${dataContext}\n\nUser Question: "${compactQuestion}"\n\nAssistant Response:`;

    const callResult = await this.callModelWithGuardrails({
      contents: prompt,
      temperature: 0.7,
      maxOutputTokens: this.maxOutputTokensExplanation,
    });

    const rawTrimmedText = (callResult.text || '').trim();
    const trimmedText = this.sanitizeRetailerMarkdownLinks(rawTrimmedText);
    const isTruncatedOrTooShort =
      params.intent !== 'CASUAL' &&
      (trimmedText.length < 45 ||
        /[a-zA-Z0-9,:;]$/.test(trimmedText.replace(/\*+|`+/g, '')));
    const isMissingRequiredLinks =
      Boolean(params.priceComparisons && params.priceComparisons.length > 0) &&
      (!trimmedText.includes('](https://') ||
        (requestedRetailers.length > 0 &&
          requestedRetailers.some(
            (r) => !trimmedText.toLowerCase().includes(r.split(' ')[0].toLowerCase())
          )));

    if (!callResult.ok || !trimmedText || isTruncatedOrTooShort || isMissingRequiredLinks) {
      const text = this.fallbackGroundedResponse(params);
      return {
        text,
        source: 'fallback',
        model: this.modelName,
        durationMs: Date.now() - startTime,
        tokenUsage: callResult.tokenUsage,
        quotaExhausted: callResult.quotaExhausted,
        budgetExhausted: callResult.budgetExhausted,
        fallbackReason:
          callResult.fallbackReason ||
          (isTruncatedOrTooShort
            ? 'Model output was truncated; used complete grounded fallback.'
            : isMissingRequiredLinks
              ? 'Model output omitted required retailer links; used complete grounded fallback.'
              : undefined),
      };
    }

    return {
      text: trimmedText,
      source: 'gemini',
      model: this.modelName,
      durationMs: Date.now() - startTime,
      tokenUsage: callResult.tokenUsage,
    };
  }

  /**
   * Generates grounded, natural-language conversational response explaining recommendations.
   * Grounded EXCLUSIVELY in the provided verified database data.
   */
  public async generateGroundedResponse(params: GroundedResponseParams): Promise<string> {
    const res = await this.generateWithTelemetry(params);
    return res.text;
  }

  /**
   * Formats structured database records into compact verified facts for the LLM prompt.
   * Sends only top selected product fields—never the full catalogue.
   */
  public formatDataContextForPrompt(params: GroundedResponseParams): string {
    const parts: string[] = [];

    if (params.intent) {
      parts.push(`USER INTENT: ${params.intent}`);
    }

    if (params.isRelaxedMatch && params.relaxedExplanation) {
      parts.push(`CONSTRAINT RELAXATION NOTICE: ${params.relaxedExplanation}`);
    }

    if (params.targetProduct) {
      parts.push(
        `REFERENCED PRODUCT DETAILS:\n${JSON.stringify({
          id: params.targetProduct.id,
          name: params.targetProduct.name,
          brand: params.targetProduct.brand,
          product_type: params.targetProduct.product_type,
          price: `₹${params.targetProduct.price.toLocaleString('en-IN')}`,
          rating: `${params.targetProduct.rating}/5 (${params.targetProduct.review_count} reviews)`,
          features: params.targetProduct.features.slice(0, 5),
          specifications: params.targetProduct.specifications,
          use_cases: params.targetProduct.use_cases.slice(0, 5),
        })}`
      );
    }

    if (params.products && params.products.length > 0) {
      const simplifiedProducts = params.products.slice(0, 6).map((p) => {
        const prod = 'product' in p ? p.product : p;
        const reasons = 'rankingReasons' in p ? p.rankingReasons : undefined;
        const isRelatedAlternative =
          'isRelatedAlternative' in p ? Boolean(p.isRelatedAlternative) : false;
        const alternativeSectionLabel =
          'alternativeSectionLabel' in p ? p.alternativeSectionLabel : undefined;
        return {
          id: prod.id,
          name: prod.name,
          brand: prod.brand,
          product_type: prod.product_type,
          isRelatedAlternative,
          alternativeSectionLabel,
          price: `₹${prod.price.toLocaleString('en-IN')}`,
          rating: `${prod.rating}/5 (${prod.review_count} reviews)`,
          features: prod.features.slice(0, 5),
          specifications: prod.specifications,
          use_cases: prod.use_cases,
          whyMatches: reasons ? reasons.slice(0, 3) : undefined,
        };
      });

      parts.push(`VERIFIED TOP CANDIDATES:\n${JSON.stringify(simplifiedProducts)}`);
    }

    if (params.comparison) {
      parts.push(
        `STRUCTURED COMPARISON DATA:\n${JSON.stringify({
          indicators: params.comparison.indicators,
          sharedFeatures: params.comparison.sharedFeatures.slice(0, 5),
          uniqueFeatures: params.comparison.uniqueFeatures,
          commonMatrix: params.comparison.commonMatrix,
          categorySpecificMatrix: params.comparison.categorySpecificMatrix,
          specMatrix: params.comparison.specMatrix.slice(0, 8),
        })}`
      );
    }

    if (params.alternatives && Array.isArray(params.alternatives.alternatives)) {
      parts.push(
        `STRUCTURED ALTERNATIVES DATA:\n${JSON.stringify(
          params.alternatives.alternatives.slice(0, 3).map((a) => ({
            name: a.product.name,
            brand: a.product.brand,
            price: `₹${a.product.price.toLocaleString('en-IN')}`,
            rating: a.product.rating,
            similarityReason: a.similarityReason,
          }))
        )}`
      );
    }

    if (params.priceComparisons && params.priceComparisons.length > 0) {
      const requestedRetailers = this.extractRequestedRetailers(params.userMessage || '');
      const compactPriceComparisons = params.priceComparisons.slice(0, 3).map((pc) => ({
        productId: pc.productId,
        productName: pc.productName,
        catalogueReferencePrice: `₹${pc.cataloguePrice.toLocaleString('en-IN')}`,
        requestedRetailers: requestedRetailers.length > 0 ? requestedRetailers : undefined,
        hasComparableVerifiedPrices: pc.hasComparableVerifiedPrices,
        lowestVerifiedOffer: pc.lowestVerifiedOffer
          ? {
              retailerName: pc.lowestVerifiedOffer.retailerName,
              totalPrice: `₹${pc.lowestVerifiedOffer.totalPrice!.toLocaleString('en-IN')}`,
              itemPrice: `₹${pc.lowestVerifiedOffer.price!.toLocaleString('en-IN')}`,
              shippingCost:
                pc.lowestVerifiedOffer.shippingCost === 0
                  ? 'Free'
                  : `₹${pc.lowestVerifiedOffer.shippingCost}`,
              verificationStatus: pc.lowestVerifiedOffer.verificationStatus,
              listingUrl: pc.lowestVerifiedOffer.listingUrl,
              lastCheckedAt: pc.lowestVerifiedOffer.lastCheckedAt,
            }
          : null,
        honestStatusMessage: pc.providerStatus.honestStatusMessage,
        offers: pc.offers.slice(0, 4).map((o) => ({
          retailerName: o.retailerName,
          linkType: o.linkType,
          verificationStatus: o.verificationStatus,
          price: o.price !== null ? `₹${o.price.toLocaleString('en-IN')}` : null,
          shippingCost:
            o.shippingKnown && o.shippingCost !== null
              ? o.shippingCost === 0
                ? 'Free'
                : `₹${o.shippingCost}`
              : 'Unknown',
          totalPrice:
            o.totalPrice !== null ? `₹${o.totalPrice.toLocaleString('en-IN')}` : null,
          totalIsIncomplete: o.totalIsIncomplete,
          availability: o.availability,
          url: o.listingUrl || o.searchUrl,
          lastCheckedAt: o.lastCheckedAt,
          statusMessage: o.statusMessage,
        })),
      }));

      parts.push(
        `CROSS-WEBSITE PRICE COMPARISON & PURCHASE LINKS:\n${JSON.stringify(
          compactPriceComparisons
        )}`
      );
    }

    if (params.uncataloguedItemInfo) {
      parts.push(
        `UNCATALOGUED ITEM / ZERO INTERNAL MATCHES:\n${JSON.stringify({
          requestedItem: params.uncataloguedItemInfo.requestedItemLabel,
          internalCatalogueMatches: 0,
          instruction:
            'Clearly explain that this item is not currently in our internal catalogue and do NOT recommend parent-category devices instead. Offer the provided unverified external retailer search links using the exact format [Search on <Retailer Name>](<searchUrl>) (never [Search Link]) and ask if the user wants to explore the related internal catalogue categories.',
          relatedCatalogueCategories:
            params.uncataloguedItemInfo.relatedCategoryDescription,
          externalSearchLinks:
            params.uncataloguedItemInfo.externalSearchLinks.map((s) => ({
              retailerName: s.retailerName,
              markdownLabel: `Search on ${s.retailerName}`,
              searchUrl: s.searchUrl,
              note: 'Unverified retailer search query — live price unavailable',
            })),
        })}`
      );
    }

    if (params.clarificationNote) {
      parts.push(`CLARIFICATION NOTE: ${params.clarificationNote}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Deterministic fallback response synthesizer.
   * Produces high quality, grounded natural language responses when Gemini API is offline/unavailable.
   */
  public fallbackGroundedResponse(params: GroundedResponseParams): string {
    const {
      intent,
      products,
      targetProduct,
      comparison,
      alternatives,
      priceComparisons,
      uncataloguedItemInfo,
      clarificationNote,
      isRelaxedMatch,
      relaxedExplanation,
    } = params;

    if (intent === 'CASUAL') {
      return (
        "Hello! I am your SmartCart AI Shopping Concierge. I can help you find products within your budget, compare options side by side, and recommend top picks across electronics, fashion, footwear, furniture, kitchen appliances, beauty, sports, automotive, and more. What are you looking to buy today?"
      );
    }

    if (priceComparisons && priceComparisons.length > 0) {
      const requestedRetailers = this.extractRequestedRetailers(params.userMessage || '');
      const suffix = clarificationNote ? `\n\n${clarificationNote}` : '';

      if (requestedRetailers.length > 0) {
        const retailerBlocks = priceComparisons.map((pc) => {
          const lines: string[] = [];
          lines.push(
            `### **${pc.productName}** (${pc.brand} • Catalogue Reference: ₹${pc.cataloguePrice.toLocaleString('en-IN')})`
          );

          const matchedOffers = pc.offers.filter((o) =>
            requestedRetailers.some(
              (req) => o.retailerName.toLowerCase() === req.toLowerCase()
            )
          );

          const finalRequestedOffers = [...matchedOffers];
          for (const reqName of requestedRetailers) {
            if (
              !finalRequestedOffers.some(
                (o) => o.retailerName.toLowerCase() === reqName.toLowerCase()
              )
            ) {
              const queryEncoded = encodeURIComponent(
                `${pc.brand} ${pc.productName}`.trim()
              );
              const fallbackSearchUrl =
                reqName === 'Amazon India'
                  ? `https://www.amazon.in/s?k=${queryEncoded}`
                  : reqName === 'Flipkart'
                    ? `https://www.flipkart.com/search?q=${queryEncoded}`
                    : `https://www.google.com/search?q=${encodeURIComponent(`${pc.brand} ${pc.productName} ${reqName}`)}`;
              finalRequestedOffers.push({
                id: `search_${pc.productId}_${reqName.toLowerCase().replace(/\s+/g, '-')}`,
                productId: pc.productId,
                retailerId: reqName.toLowerCase().replace(/\s+/g, '-'),
                retailerName: reqName,
                listingTitle: `Search "${pc.productName}" on ${reqName}`,
                linkType: 'search_link',
                matchType: 'exact',
                matchConfidence: 0,
                verificationStatus: 'unverified_search',
                price: null,
                originalPrice: null,
                currency: 'INR',
                shippingCost: null,
                shippingKnown: false,
                totalPrice: null,
                totalIsIncomplete: true,
                availability: 'unknown',
                listingUrl: null,
                searchUrl: fallbackSearchUrl,
                sourceProvider: 'search_fallback',
                lastCheckedAt: null,
                statusMessage:
                  "Live price unavailable — check the retailer's listing via search.",
              });
            }
          }

          const verifiedRequested = finalRequestedOffers.filter(
            (o) => o.linkType === 'direct_listing' && o.price !== null
          );

          if (verifiedRequested.length > 0) {
            const sortedVerified = [...verifiedRequested].sort(
              (a, b) => (a.totalPrice ?? a.price ?? 0) - (b.totalPrice ?? b.price ?? 0)
            );
            if (sortedVerified.length >= 2) {
              const cheapest = sortedVerified[0];
              const cheapestTotal = cheapest.totalPrice ?? cheapest.price ?? 0;
              lines.push(
                `• **Lowest Verified Offer (${requestedRetailers.join(' vs ')})**: **₹${cheapestTotal.toLocaleString('en-IN')}** on **${cheapest.retailerName}** — [Buy now on ${cheapest.retailerName}](${cheapest.listingUrl})`
              );
            }
            for (const off of finalRequestedOffers) {
              if (off.linkType === 'direct_listing' && off.price !== null) {
                const statusBadge =
                  off.verificationStatus === 'live_verified'
                    ? 'Live Verified'
                    : off.verificationStatus === 'cached_verified'
                      ? 'Cached Verified'
                      : 'Stale Cached Price';
                const shipLabel =
                  off.shippingKnown && off.shippingCost !== null
                    ? off.shippingCost === 0
                      ? 'Free shipping'
                      : `₹${off.shippingCost} shipping`
                    : 'Shipping unknown';
                const totalLabel =
                  off.totalPrice !== null
                    ? `₹${off.totalPrice.toLocaleString('en-IN')} total (₹${off.price.toLocaleString('en-IN')} + ${shipLabel})`
                    : `₹${off.price.toLocaleString('en-IN')} (${shipLabel})`;
                lines.push(
                  `• **${off.retailerName}**: ${totalLabel} [${statusBadge}] — [View listing on ${off.retailerName}](${off.listingUrl})`
                );
              } else {
                lines.push(
                  `• **${off.retailerName}**: Live verified price unavailable — [Search on ${off.retailerName}](${off.searchUrl}) *(unverified retailer search link)*`
                );
              }
            }
          } else {
            lines.push(
              `• **${requestedRetailers.join(' vs ')} Price Status**: Live verified prices from **${requestedRetailers.join(' and ')}** are currently unavailable for **${pc.productName}** (no verified direct product listings are cached). I cannot confirm which retailer is cheaper without a live verified feed.`
            );
            for (const off of finalRequestedOffers) {
              lines.push(
                `• **${off.retailerName}**: Live price unavailable — [Search on ${off.retailerName}](${off.searchUrl}) *(unverified retailer search link, not a verified product listing)*`
              );
            }
          }

          return lines.join('\n');
        });

        return `Here is the comparison status for **${priceComparisons[0].productName}** on **${requestedRetailers.join(' and ')}**:\n\n${retailerBlocks.join('\n\n')}${suffix}`;
      }

      const blocks = priceComparisons.map((pc) => {
        const lines: string[] = [];
        lines.push(
          `### **${pc.productName}** (${pc.brand} • Catalogue Reference: ₹${pc.cataloguePrice.toLocaleString('en-IN')})`
        );

        if (pc.lowestVerifiedOffer && pc.lowestVerifiedOffer.totalPrice !== null) {
          const best = pc.lowestVerifiedOffer;
          const bestTotal = best.totalPrice ?? best.price ?? 0;
          const shipLabel =
            best.shippingCost === 0
              ? 'Free shipping'
              : `₹${best.shippingCost?.toLocaleString('en-IN')} shipping`;
          const statusLabel =
            best.verificationStatus === 'live_verified'
              ? 'Live Verified Price'
              : 'Cached Verified Price';
          lines.push(
            `• **Best Verified Total Price**: **₹${bestTotal.toLocaleString('en-IN')}** at **${best.retailerName}** (Item: ₹${best.price?.toLocaleString('en-IN')} + ${shipLabel} • ${statusLabel}) — [Buy now on ${best.retailerName}](${best.listingUrl})`
          );
        } else {
          lines.push(`• **Price Status**: ${pc.providerStatus.honestStatusMessage}`);
        }

        const directOffers = pc.offers.filter((o) => o.linkType === 'direct_listing');
        for (const off of directOffers) {
          if (pc.lowestVerifiedOffer && off.id === pc.lowestVerifiedOffer.id) continue;
          const statusBadge =
            off.verificationStatus === 'live_verified'
              ? 'Live Verified'
              : off.verificationStatus === 'cached_verified'
                ? 'Cached Verified'
                : 'Stale Cached Price';
          const priceLabel =
            off.totalPrice !== null
              ? `₹${off.totalPrice.toLocaleString('en-IN')} total (₹${off.price?.toLocaleString('en-IN')} + ${off.shippingCost === 0 ? 'Free shipping' : `₹${off.shippingCost} shipping`})`
              : off.price !== null
                ? `₹${off.price.toLocaleString('en-IN')} (Shipping unknown — total price incomplete)`
                : 'Price unavailable';
          lines.push(
            `• **${off.retailerName}**: ${priceLabel} [${statusBadge}] — [View listing on ${off.retailerName}](${off.listingUrl})`
          );
        }

        const searchOffers = pc.offers.filter((o) => o.linkType === 'search_link');
        if (searchOffers.length > 0) {
          const searchLinksFormatted = searchOffers
            .map((s) => `[Search on ${s.retailerName}](${s.searchUrl})`)
            .join(' • ');
          lines.push(`• **Retailer Search Links** *(unverified search queries)*: ${searchLinksFormatted}`);
        }

        if (pc.similarAlternativeOffers.length > 0) {
          const simNotes = pc.similarAlternativeOffers
            .slice(0, 2)
            .map(
              (s) =>
                `${s.listingTitle} on ${s.retailerName} (${s.matchedVariantSummary || 'Similar alternative / different variant'})`
            )
            .join('; ');
          lines.push(
            `• *Note on variants/similar listings (not compared as identical)*: ${simNotes}`
          );
        }

        return lines.join('\n');
      });

      return `Here are the cross-website purchase links and price comparison details:\n\n${blocks.join('\n\n')}${suffix}`;
    }

    if (targetProduct) {
      return (
        `Here are the verified details for **${targetProduct.name}**:\n\n` +
        `• **Price**: ₹${targetProduct.price.toLocaleString('en-IN')}\n` +
        `• **Rating**: ${targetProduct.rating} / 5 (${targetProduct.review_count.toLocaleString('en-IN')} reviews)\n` +
        `• **Brand**: ${targetProduct.brand}\n` +
        `• **Best for**: ${targetProduct.use_cases.join(', ')}\n` +
        `• **Key Features**: ${targetProduct.features.join(', ')}\n\n` +
        `${targetProduct.description}`
      );
    }

    if (comparison && comparison.products.length >= 2) {
      const p1 = comparison.products[0];
      const p2 = comparison.products[1];
      const cheapest = comparison.products.find((p) => p.id === comparison.indicators.cheapestProductId) || p1;
      const highestRated = comparison.products.find((p) => p.id === comparison.indicators.highestRatedProductId) || p2;
      const isMotorcycleComparison = comparison.products.every((p) => {
        const pt = (p.product_type || '').toLowerCase();
        return (
          pt === 'motorcycle' ||
          pt === 'scooter' ||
          /\b(motorcycle|roadster|cruiser|scrambler|scooter)\b/i.test(p.name)
        );
      });

      if (isMotorcycleComparison) {
        const getCatRowVal = (key: string, prodId: string): string => {
          const row = comparison.categorySpecificMatrix?.find((r) => r.key === key);
          return row?.values?.[prodId] || 'Not specified in catalogue';
        };
        const suffix = clarificationNote ? `\n\n${clarificationNote}` : '';
        return (
          `Here is the verified side-by-side motorcycle comparison between **${p1.name}** (${p1.brand}) and **${p2.name}** (${p2.brand}):\n\n` +
          `• **Ex-Showroom Price**: **${p1.name}** at **₹${p1.price.toLocaleString('en-IN')} (Ex-Showroom)** vs **${p2.name}** at **₹${p2.price.toLocaleString('en-IN')} (Ex-Showroom)** (${cheapest.name} is ₹${comparison.indicators.priceSpread.toLocaleString('en-IN')} lower).\n` +
          `• **Engine & Displacement**: ${p1.brand}: **${getCatRowVal('engine_displacement', p1.id)}** vs ${p2.brand}: **${getCatRowVal('engine_displacement', p2.id)}**.\n` +
          `• **Power & Torque**: ${p1.brand}: **${getCatRowVal('power_torque', p1.id)}** vs ${p2.brand}: **${getCatRowVal('power_torque', p2.id)}**.\n` +
          `• **Transmission / Gearbox**: ${p1.brand}: **${getCatRowVal('transmission', p1.id)}** vs ${p2.brand}: **${getCatRowVal('transmission', p2.id)}**.\n` +
          `• **Kerb Weight**: ${p1.brand}: **${getCatRowVal('kerb_weight', p1.id)}** vs ${p2.brand}: **${getCatRowVal('kerb_weight', p2.id)}**.\n` +
          `• **Seat Height**: ${p1.brand}: **${getCatRowVal('seat_height', p1.id)}** vs ${p2.brand}: **${getCatRowVal('seat_height', p2.id)}**.\n` +
          `• **Braking & Safety**: ${p1.brand}: **${getCatRowVal('braking_safety', p1.id)}** vs ${p2.brand}: **${getCatRowVal('braking_safety', p2.id)}**.\n` +
          `• **Intended Riding Use**: ${p1.brand}: *${getCatRowVal('intended_riding_use', p1.id)}* vs ${p2.brand}: *${getCatRowVal('intended_riding_use', p2.id)}*.\n` +
          `• **Warranty / Service Info**: ${p1.brand}: **${getCatRowVal('warranty_service', p1.id)}** vs ${p2.brand}: **${getCatRowVal('warranty_service', p2.id)}**.\n` +
          `• **Fulfillment & Verification**: Verified Catalogue Records • Available via **Dealer Enquiry / Specification View** (two-wheelers are not parcel-shippable).\n` +
          (comparison.priorityVerdictSummary ? `\n**Verdict**: ${comparison.priorityVerdictSummary}` : '') +
          suffix
        );
      }

      const suffix = clarificationNote ? `\n\n${clarificationNote}` : '';
      return (
        `Here is how **${p1.name}** compares to **${p2.name}**:\n\n` +
        `• **Price Winner**: ${cheapest.name} is more affordable at ₹${cheapest.price.toLocaleString('en-IN')} (₹${comparison.indicators.priceSpread.toLocaleString('en-IN')} difference).\n` +
        `• **Rating Winner**: ${highestRated.name} leads with ${highestRated.rating}/5 stars from ${highestRated.review_count.toLocaleString('en-IN')} reviews.\n` +
        (comparison.sharedFeatures.length > 0 ? `• **Shared Features**: ${comparison.sharedFeatures.slice(0, 3).join(', ')}.\n` : '') +
        (comparison.priorityVerdictSummary ? `• **Recommendation by Priority**: ${comparison.priorityVerdictSummary}\n` : '') +
        `\nCheck the comparison card for a detailed side-by-side specification breakdown!` +
        suffix
      );
    }

    if (alternatives && alternatives.alternatives.length > 0) {
      const lines = alternatives.alternatives.map(
        (alt, i) => `${i + 1}. **${alt.product.name}** (₹${alt.product.price.toLocaleString('en-IN')}, ${alt.product.rating}★) — ${alt.similarityReason}`
      );
      return (
        `Here are the closest alternatives to **${alternatives.targetProduct.name}**:\n\n` +
        lines.join('\n\n') +
        `\n\nAll options are currently in stock and match similar features and price points.`
      );
    }

    if (
      intent === 'QUESTION_ON_PREVIOUS' &&
      products &&
      products.length >= 1 &&
      /\bwarranty\b/i.test(params.userMessage || '')
    ) {
      const unwrapped = products.map((p) => ('product' in p ? p.product : p));
      const extractWarranty = (p: Product): { label: string; months: number } => {
        const specs = p.specifications || {};
        const raw =
          specs.warranty ??
          specs.Warranty ??
          specs.manufacturer_warranty ??
          p.features.find((f) => /\bwarranty\b/i.test(f));
        if (!raw) {
          return { label: 'Warranty not specified in product documentation (check manufacturer terms)', months: 0 };
        }
        const s = String(raw);
        const yrMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);
        if (yrMatch) return { label: s, months: Math.round(parseFloat(yrMatch[1]) * 12) };
        const moMatch = s.match(/(\d+)\s*(?:months?|mos?)/i);
        if (moMatch) return { label: s, months: parseInt(moMatch[1], 10) };
        return { label: s, months: 12 };
      };

      const warrantyLines = unwrapped.slice(0, 4).map((p, idx) => {
        const w = extractWarranty(p);
        return `${idx + 1}. **${p.name}** (₹${p.price.toLocaleString('en-IN')}): **${w.label}**`;
      });

      const withWarranty = unwrapped
        .map((p) => ({ product: p, ...extractWarranty(p) }))
        .filter((x) => x.months > 0)
        .sort((a, b) => b.months - a.months || b.product.rating - a.product.rating);

      const verdict =
        withWarranty.length > 0
          ? `\n\n**Warranty Verdict**: **${withWarranty[0].product.name}** offers the strongest documented warranty coverage (**${withWarranty[0].label}**).`
          : `\n\n**Warranty Note**: Explicit warranty duration is not specified in the catalogue specifications for these items; standard brand manufacturer warranty terms apply.`;

      return `Here is the documented warranty breakdown for your current products:\n\n${warrantyLines.join('\n')}${verdict}`;
    }

    if (
      intent === 'QUESTION_ON_PREVIOUS' &&
      products &&
      products.length >= 2 &&
      /\b(which\s+(?:one\s+)?is\s+(?:better|best)|which\s+should\s+i|help\s+me\s+(?:choose|decide)|between\s+these)\b/i.test(
        params.userMessage || ''
      )
    ) {
      const unwrapped = products.map((p) => ('product' in p ? p.product : p));
      const byPrice = [...unwrapped].sort((a, b) => a.price - b.price);
      const byRating = [...unwrapped].sort((a, b) => b.rating - a.rating || b.review_count - a.review_count);
      const budgetPick = byPrice[0];
      const topPick = byRating[0];

      return (
        `Here is how to choose between your current recommendations based on your priorities:\n\n` +
        `• **Best for Quality & Performance**: **${topPick.name}** (₹${topPick.price.toLocaleString('en-IN')}, **${topPick.rating}★** from ${topPick.review_count.toLocaleString('en-IN')} reviews) — ideal for ${topPick.use_cases.slice(0, 3).join(', ')} with ${topPick.features.slice(0, 3).join(', ')}.\n` +
        `• **Best for Budget Savings**: **${budgetPick.name}** (**₹${budgetPick.price.toLocaleString('en-IN')}**, ${budgetPick.rating}★) — saves ₹${(topPick.price - budgetPick.price).toLocaleString('en-IN')} while covering ${budgetPick.use_cases.slice(0, 2).join(' and ')}.\n\n` +
        `Tell me which one you'd like to add to your cart (e.g., *"Add the first one to my cart"* or *"Add the second one to my cart"*), or ask *"Compare the first two"* for a full side-by-side matrix!`
      );
    }

    if (products && products.length > 0) {
      const hasRelatedAlternatives = products.some(
        (p) => 'isRelatedAlternative' in p && p.isRelatedAlternative
      );

      if (hasRelatedAlternatives) {
        const exactItems = products.filter(
          (p) => !('isRelatedAlternative' in p && p.isRelatedAlternative)
        );
        const relatedItems = products.filter(
          (p) => 'isRelatedAlternative' in p && p.isRelatedAlternative
        );

        const sections: string[] = [];
        if (exactItems.length > 0) {
          const exactLines = exactItems.map((p, idx) => {
            const prod = 'product' in p ? p.product : p;
            const reasons =
              'rankingReasons' in p && p.rankingReasons
                ? p.rankingReasons.join('. ')
                : prod.description;
            return `${idx + 1}. **${prod.name}** (${prod.brand}) — **₹${prod.price.toLocaleString('en-IN')}** (${prod.rating}★)\n   ${reasons}`;
          });
          sections.push(
            `### **Over-Ear Wireless Headphones Under Budget**\n\n${exactLines.join('\n\n')}`
          );
        }

        if (relatedItems.length > 0) {
          const altLines = relatedItems.slice(0, 4).map((p, idx) => {
            const prod = 'product' in p ? p.product : p;
            const reasons =
              'rankingReasons' in p && p.rankingReasons
                ? p.rankingReasons.join('. ')
                : prod.description;
            return `${idx + 1}. **${prod.name}** (${prod.brand}) — **₹${prod.price.toLocaleString('en-IN')}** (${prod.rating}★)\n   ${reasons}`;
          });
          sections.push(
            `### **Related alternatives (Wireless Earbuds & Neckbands with Gym/Sweat Ratings)**\n\n${altLines.join('\n\n')}`
          );
        }

        return sections.join('\n\n');
      }

      let prefix = 'Here are the best matching recommendations based on your requirements:\n\n';
      if (isRelaxedMatch && relaxedExplanation) {
        prefix = `${relaxedExplanation}\n\nHere are the closest options available:\n\n`;
      }

      const list = products.slice(0, 3).map((p, idx) => {
        const prod = 'product' in p ? p.product : p;
        const reasons = 'rankingReasons' in p && p.rankingReasons ? p.rankingReasons.join('. ') : prod.description;
        return `${idx + 1}. **${prod.name}** — ₹${prod.price.toLocaleString('en-IN')} (${prod.rating}★)\n   ${reasons}`;
      });

      return `${prefix}${list.join('\n\n')}`;
    }

    if (relaxedExplanation && /certified organic/i.test(relaxedExplanation)) {
      return `${relaxedExplanation}\n\nYou can also use the **Request this product** option below if you'd like us to log a request for a specific certified organic item.`;
    }

    if (uncataloguedItemInfo) {
      const searchLinksSection =
        uncataloguedItemInfo.externalSearchLinks.length > 0
          ? `\n\nYou can search for **${uncataloguedItemInfo.requestedItemLabel}** on these online retailers *(unverified retailer search links — check the retailer's listing for live availability and pricing)*:\n` +
            uncataloguedItemInfo.externalSearchLinks
              .map(
                (s) =>
                  `• [Search on ${s.retailerName}](${s.searchUrl})`
              )
              .join('\n')
          : '';
      const relatedPrompt = uncataloguedItemInfo.relatedCategoryDescription
        ? `\n\nWould you like me to recommend similar or compatible accessories available in our catalogue instead, such as **${uncataloguedItemInfo.relatedCategoryDescription}**?`
        : `\n\nWould you like to search for a different product, explore related categories in our catalogue, or use the **Request this product** button below?`;

      return `We don't currently have **${uncataloguedItemInfo.requestedItemLabel}** in our internal product catalogue (so I won't substitute unrelated parent-category devices).${searchLinksSection}${relatedPrompt}`;
    }

    return (
      relaxedExplanation ||
      "I couldn't find any products in our catalogue that meet all your specified criteria. Try relaxing your budget or broadening your search terms."
    );
  }

  /**
   * Analyzes an uploaded product image using Gemini multimodal vision with strict budget
   * and retry guardrails. Never logs raw image bytes.
   */
  public async analyzeProductImage(params: {
    mimeType: string;
    base64Data: string;
    userHint?: string;
  }): Promise<{
    ok: boolean;
    rawJson?: string;
    tokenUsage: TokenUsageTelemetry;
    fallbackReason?: string;
  }> {
    if (!this.client) {
      return {
        ok: false,
        tokenUsage: this.emptyTokenUsage(),
        fallbackReason: 'GEMINI_API_KEY is not configured or client is offline',
      };
    }

    const budget = this.getBudgetStatus();
    if (budget.budgetExhausted) {
      return {
        ok: false,
        tokenUsage: this.emptyTokenUsage(),
        fallbackReason: 'Daily Gemini API budget exhausted',
      };
    }

    this.dailyRequestsUsed += 1;

    try {
      const visionPrompt = `You are a product identification specialist for an online shopping marketplace.
Inspect this product image and extract structured JSON clues.
Supported catalogue categories: "automotive", "fashion", "footwear", "furniture", "kitchen-appliances", "beauty-personal-care", "sports-fitness", "headphones", "smartphones", "smartwatches", "laptops", "keyboards-mice", "power-accessories", "books", "travel-luggage", "gifts".
${params.userHint ? `User hint: "${params.userHint.slice(0, 200)}"` : ''}

Return ONLY valid JSON with:
{
  "brand": string | null,
  "model": string | null,
  "productType": string | null,
  "category": string | null,
  "color": string | null,
  "packagingText": string[],
  "visualAttributes": string[],
  "keywords": string[],
  "confidence": number (0.0 to 1.0),
  "imageQuality": "clear" | "blurry" | "multiple_products" | "unrecognizable",
  "detectedProductCount": number,
  "additionalDetectedItems": string[]
}`;

      const config: Record<string, any> = {
        temperature: 0.0,
        maxOutputTokens: 350,
        responseMimeType: 'application/json',
      };
      if (this.modelName.includes('2.5')) {
        config.thinkingConfig = { thinkingBudget: 0 };
      }

      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: params.mimeType,
                  data: params.base64Data,
                },
              },
              { text: visionPrompt },
            ],
          },
        ],
        config,
      });

      const tokenUsage = this.extractUsageFromResponse(response);
      return {
        ok: true,
        rawJson: response.text || '',
        tokenUsage,
      };
    } catch (err: any) {
      return {
        ok: false,
        tokenUsage: this.emptyTokenUsage(),
        fallbackReason: err?.message || 'Vision model API call failed',
      };
    }
  }
}

