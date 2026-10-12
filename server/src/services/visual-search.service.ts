import { IProductRepository } from '../db/repositories/product.repository.js';
import { ISessionRepository } from '../db/repositories/session.repository.js';
import {
  ImageQualityAssessment,
  Product,
  VisualMatchClassification,
  VisualMatchedProduct,
  VisualSearchClues,
  VisualSearchCorrectionInput,
  VisualSearchResponseDTO,
} from '../types/index.js';
import { GeminiService } from './gemini.service.js';
import { PriceComparisonService } from './price-comparison.service.js';

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MIN_IMAGE_SIZE_BYTES = 16;

export class VisualSearchValidationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, code = 'INVALID_IMAGE', statusCode = 400) {
    super(message);
    this.name = 'VisualSearchValidationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface VisualSearchInput {
  sessionId?: string;
  imageData?: string; // base64 string or data:image/...;base64,...
  mimeType?: string;
  fileName?: string;
  userHint?: string;
  correction?: VisualSearchCorrectionInput;
}

export class VisualSearchService {
  constructor(
    private productRepo: IProductRepository,
    private sessionRepo: ISessionRepository,
    private geminiService: GeminiService,
    private priceComparisonService?: PriceComparisonService
  ) {}

  /**
   * Validates image MIME type, base64 encoding, magic bytes, and byte size.
   * Never logs raw image bytes.
   */
  public validateAndDecodeImage(
    imageData: string | undefined,
    declaredMimeType?: string
  ): { mimeType: string; base64Payload: string; byteLength: number } {
    if (!imageData || typeof imageData !== 'string' || imageData.trim().length === 0) {
      throw new VisualSearchValidationError(
        'Image data is required for visual product search.',
        'MISSING_IMAGE_DATA',
        400
      );
    }

    let rawMime = (declaredMimeType || '').toLowerCase().trim();
    let base64Payload = imageData.trim();

    // Parse data URL if provided: data:image/png;base64,iVBOR...
    const dataUrlMatch = base64Payload.match(/^data:([^;,]+);base64,(.+)$/is);
    if (dataUrlMatch) {
      if (!rawMime) {
        rawMime = dataUrlMatch[1].toLowerCase().trim();
      }
      base64Payload = dataUrlMatch[2].trim();
    }

    if (!rawMime) {
      throw new VisualSearchValidationError(
        'Image MIME type is required (supported: image/jpeg, image/png, image/webp).',
        'MISSING_MIME_TYPE',
        400
      );
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(rawMime)) {
      throw new VisualSearchValidationError(
        `Unsupported image format '${rawMime}'. Please upload a JPEG, PNG, or WebP image.`,
        'UNSUPPORTED_IMAGE_FORMAT',
        400
      );
    }

    const normalizedMime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;

    // Strip whitespace and validate base64 alphabet
    const cleanBase64 = base64Payload.replace(/\s+/g, '');
    if (
      cleanBase64.length === 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(cleanBase64)
    ) {
      throw new VisualSearchValidationError(
        'Invalid or corrupted base64 image payload.',
        'CORRUPTED_IMAGE_DATA',
        400
      );
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.byteLength < MIN_IMAGE_SIZE_BYTES) {
      throw new VisualSearchValidationError(
        'Uploaded image file is too small or empty to be a valid image.',
        'IMAGE_TOO_SMALL',
        400
      );
    }

    if (buffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      throw new VisualSearchValidationError(
        `Image exceeds maximum allowed size of 5 MB (uploaded ${(buffer.byteLength / (1024 * 1024)).toFixed(2)} MB).`,
        'IMAGE_TOO_LARGE',
        400
      );
    }

    // Verify magic bytes for JPEG, PNG, or WebP
    const isJpeg =
      buffer.byteLength >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
    const isPng =
      buffer.byteLength >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;
    const isWebp =
      buffer.byteLength >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    if (!isJpeg && !isPng && !isWebp) {
      throw new VisualSearchValidationError(
        'Uploaded file header does not match a valid JPEG, PNG, or WebP image.',
        'CORRUPTED_IMAGE_DATA',
        400
      );
    }

    return {
      mimeType: normalizedMime,
      base64Payload: cleanBase64,
      byteLength: buffer.byteLength,
    };
  }

  /**
   * Executes visual product discovery from an uploaded image and/or user correction.
   */
  public async searchByImage(
    input: VisualSearchInput
  ): Promise<VisualSearchResponseDTO> {
    const session = this.sessionRepo.getOrCreateSession(input.sessionId);
    const activeSessionId = session.id;

    const hasCorrectionOnly =
      !input.imageData &&
      input.correction &&
      Boolean(
        input.correction.brand ||
          input.correction.model ||
          input.correction.category ||
          input.correction.keywords
      );

    let decodedImage:
      | { mimeType: string; base64Payload: string; byteLength: number }
      | undefined;

    if (!hasCorrectionOnly) {
      decodedImage = this.validateAndDecodeImage(input.imageData, input.mimeType);
    }

    // 1. Extract visual clues via Gemini Vision (when image is present) or deterministic fallback
    let clues: VisualSearchClues | undefined;

    if (decodedImage) {
      const visionResult = await this.geminiService.analyzeProductImage({
        mimeType: decodedImage.mimeType,
        base64Data: decodedImage.base64Payload,
        userHint: input.userHint || input.fileName,
      });

      if (visionResult.ok && visionResult.rawJson) {
        clues = this.parseVisionJson(
          visionResult.rawJson,
          input.fileName,
          input.userHint
        );
      }
    }

    if (!clues) {
      clues = this.extractDeterministicClues(
        input.fileName,
        input.userHint,
        input.correction
      );
    }

    // 2. Apply user-supplied corrections (brand, model, category, keywords) on top of extracted clues
    const appliedCorrection = this.normalizeCorrection(input.correction);
    if (appliedCorrection) {
      if (appliedCorrection.brand) {
        clues.brand = appliedCorrection.brand;
      }
      if (appliedCorrection.model) {
        clues.model = appliedCorrection.model;
      }
      if (appliedCorrection.category) {
        clues.category = appliedCorrection.category;
      }
      if (appliedCorrection.keywords) {
        const extraKws = appliedCorrection.keywords
          .split(/[\s,]+/)
          .map((k) => k.trim())
          .filter((k) => k.length >= 2);
        clues.keywords = Array.from(new Set([...extraKws, ...clues.keywords]));
      }
      // If user explicitly corrected the clues, upgrade quality from unrecognizable/blurry
      if (clues.imageQuality === 'unrecognizable') {
        clues.imageQuality = 'clear';
      }
      clues.confidence = Math.max(clues.confidence, 0.85);
    }

    // 3. Search catalogue and classify matches
    const { matches, overallClassification, classificationSummary } =
      this.rankAndClassifyCatalogueMatches(clues);

    const enrichedProducts: Product[] = matches.map((m) =>
      this.priceComparisonService
        ? this.priceComparisonService.enrichProductWithPurchaseLinks(m.product)
        : m.product
    );

    const enrichedMatches: VisualMatchedProduct[] = matches.map((m, idx) => ({
      ...m,
      product: enrichedProducts[idx],
    }));

    // 4. Persist visual search results into session context (without storing raw image bytes!)
    const safeUserSummary = `[Visual Search${input.fileName ? `: ${input.fileName.slice(0, 80)}` : ''}${input.userHint ? ` — "${input.userHint.slice(0, 120)}"` : ''}]`;
    this.sessionRepo.addMessage({
      sessionId: activeSessionId,
      role: 'user',
      content: safeUserSummary,
    });

    this.sessionRepo.addMessage({
      sessionId: activeSessionId,
      role: 'assistant',
      content: classificationSummary,
      recommendedProductIds: enrichedProducts.map((p) => p.id),
      extractedRequirements: {
        intent: 'SEARCH',
        category: clues.category,
        brand: clues.brand,
      },
    });

    const suggestions =
      enrichedProducts.length >= 2
        ? [
            'Compare the first two',
            'Add the first one to my cart',
            'Add the second one to my cart',
            'Which is better for me?',
          ]
        : enrichedProducts.length === 1
          ? [
              'Add this to my cart',
              'Show me an alternative to this',
              'Where can I buy this?',
            ]
          : [
              'Wireless headphones under ₹3000',
              'Running shoes for beginners',
              'Gaming laptops under ₹70000',
            ];

    return {
      sessionId: activeSessionId,
      clues,
      appliedCorrection,
      overallClassification,
      classificationSummary,
      matches: enrichedMatches,
      products: enrichedProducts,
      suggestions,
    };
  }

  private normalizeCorrection(
    correction?: VisualSearchCorrectionInput
  ): VisualSearchCorrectionInput | undefined {
    if (!correction || typeof correction !== 'object') return undefined;
    const brand = correction.brand?.trim() || undefined;
    const model = correction.model?.trim() || undefined;
    const category = correction.category?.trim() || undefined;
    const keywords = correction.keywords?.trim() || undefined;
    if (!brand && !model && !category && !keywords) return undefined;
    return { brand, model, category, keywords };
  }

  private parseVisionJson(
    rawJson: string,
    fileName?: string,
    userHint?: string
  ): VisualSearchClues | undefined {
    try {
      const cleaned = rawJson
        .replace(/^```json/im, '')
        .replace(/^```/im, '')
        .replace(/```$/im, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      if (!parsed || typeof parsed !== 'object') return undefined;

      const quality: ImageQualityAssessment = [
        'clear',
        'blurry',
        'multiple_products',
        'unrecognizable',
      ].includes(parsed.imageQuality)
        ? parsed.imageQuality
        : 'clear';

      const count =
        typeof parsed.detectedProductCount === 'number' &&
        parsed.detectedProductCount >= 0
          ? parsed.detectedProductCount
          : quality === 'multiple_products'
            ? 2
            : 1;

      const fallback = this.extractDeterministicClues(fileName, userHint);

      return {
        brand:
          typeof parsed.brand === 'string' && parsed.brand.trim().length > 0
            ? parsed.brand.trim()
            : fallback.brand,
        model:
          typeof parsed.model === 'string' && parsed.model.trim().length > 0
            ? parsed.model.trim()
            : fallback.model,
        productType:
          typeof parsed.productType === 'string' &&
          parsed.productType.trim().length > 0
            ? parsed.productType.trim()
            : fallback.productType,
        category:
          typeof parsed.category === 'string' && parsed.category.trim().length > 0
            ? parsed.category.trim().toLowerCase()
            : fallback.category,
        color:
          typeof parsed.color === 'string' && parsed.color.trim().length > 0
            ? parsed.color.trim()
            : fallback.color,
        packagingText: Array.isArray(parsed.packagingText)
          ? parsed.packagingText.map(String)
          : fallback.packagingText,
        visualAttributes: Array.isArray(parsed.visualAttributes)
          ? parsed.visualAttributes.map(String)
          : fallback.visualAttributes,
        keywords: Array.isArray(parsed.keywords)
          ? Array.from(new Set([...parsed.keywords.map(String), ...fallback.keywords]))
          : fallback.keywords,
        confidence:
          typeof parsed.confidence === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence))
            : fallback.confidence,
        imageQuality: quality,
        detectedProductCount: count,
        qualityWarning:
          quality === 'blurry'
            ? 'The uploaded image appears blurry or low-resolution. Please verify or correct the identified brand and model below.'
            : quality === 'multiple_products' || count > 1
              ? 'Multiple products were detected in this image. Showing matches for the primary product — use the correction fields below to switch to another item.'
              : quality === 'unrecognizable'
                ? 'Could not clearly identify a product from the image. Please enter the brand, model, or category below.'
                : undefined,
        additionalDetectedItems: Array.isArray(parsed.additionalDetectedItems)
          ? parsed.additionalDetectedItems.map(String)
          : undefined,
        extractionSource: 'gemini_vision',
      };
    } catch {
      return undefined;
    }
  }

  public extractDeterministicClues(
    fileName?: string,
    userHint?: string,
    correction?: VisualSearchCorrectionInput
  ): VisualSearchClues {
    const cleanFileName = (fileName || '')
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/[_-]+/g, ' ')
      .trim();

    const combinedText = [
      cleanFileName,
      userHint || '',
      correction?.brand || '',
      correction?.model || '',
      correction?.category || '',
      correction?.keywords || '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    const lower = combinedText.toLowerCase();

    // Detect image quality anomalies from hints/filenames
    let imageQuality: ImageQualityAssessment = 'clear';
    let detectedProductCount = 1;
    let additionalDetectedItems: string[] | undefined;

    if (
      /\b(blurry|blurred|out\s+of\s+focus|low\s+res|low-resolution|pixelated|unclear|dark)\b/i.test(
        lower
      )
    ) {
      imageQuality = 'blurry';
    } else if (
      /\b(multiple\s+products|multiple\s+items|two\s+products|bundle\s+photo|group\s+shot|desk\s+setup)\b/i.test(
        lower
      )
    ) {
      imageQuality = 'multiple_products';
      detectedProductCount = 2;
      additionalDetectedItems = ['Secondary accessory / companion device in frame'];
    } else if (
      !combinedText ||
      /\b(blank|noise|random|unrecognizable|unknown_image|img_\d+|dsc_\d+|screenshot_\d+)\b/i.test(
        lower
      )
    ) {
      if (!correction?.brand && !correction?.model && !correction?.category && !userHint) {
        imageQuality = 'unrecognizable';
        detectedProductCount = 0;
      }
    }

    const extractedReqs =
      this.geminiService.fallbackDeterministicExtraction(combinedText);

    // Match against known catalogue brands & models if present in combinedText
    const allProducts = this.productRepo.findMany({
      inStockOnly: false,
      limit: 500,
    });

    let matchedBrand = correction?.brand || extractedReqs.brand;
    if (!matchedBrand && lower.length > 0) {
      const brands = this.productRepo.getAllBrands();
      for (const b of brands) {
        if (lower.includes(b.toLowerCase())) {
          matchedBrand = b;
          break;
        }
      }
    }

    let matchedModel = correction?.model;
    let matchedCategory = correction?.category || extractedReqs.category;
    let matchedProductType: string | undefined;

    if (!matchedModel && lower.length >= 3) {
      // Check if any catalogue product name or ID tokens appear in the filename/hint
      let bestProd: Product | undefined;
      let bestTokenScore = 0;
      for (const p of allProducts) {
        const brandMatches = Boolean(
          matchedBrand && p.brand.toLowerCase() === matchedBrand.toLowerCase()
        );
        const nameTokens = p.name
          .toLowerCase()
          .split(/[^a-z0-9+]+/)
          .filter((t) => t.length >= 3 && t !== p.brand.toLowerCase());
        const idTokens = p.id
          .toLowerCase()
          .split(/[^a-z0-9+]+/)
          .filter((t) => t.length >= 3);
        const allProdTokens = Array.from(new Set([...nameTokens, ...idTokens]));
        const matchedTokens = allProdTokens.filter((t) => lower.includes(t));
        
        // Brand matching gives high confidence weighting
        const tokenScore = matchedTokens.length + (brandMatches ? 5 : 0);
        if (matchedTokens.length > 0 && tokenScore > bestTokenScore) {
          bestTokenScore = tokenScore;
          bestProd = p;
        }
      }
      if (bestProd && bestTokenScore >= 1) {
        matchedModel = bestProd.name;
        matchedBrand = matchedBrand || bestProd.brand;
        matchedCategory = matchedCategory || bestProd.category;
        matchedProductType = bestProd.product_type;
      }
    }

    // Color extraction
    const colors = [
      'black',
      'white',
      'silver',
      'grey',
      'gray',
      'blue',
      'red',
      'green',
      'purple',
      'gold',
      'pink',
      'beige',
      'brown',
    ];
    const detectedColor = colors.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(lower));

    const stopWords = new Set([
      'image',
      'photo',
      'picture',
      'upload',
      'product',
      'find',
      'show',
      'search',
      'for',
      'the',
      'and',
      'with',
      'blurry',
      'multiple',
      'products',
      'items',
    ]);
    const keywords = Array.from(
      new Set(
        lower
          .split(/[^a-z0-9+]+/)
          .filter((w) => w.length >= 2 && !stopWords.has(w))
      )
    ).slice(0, 10);

    const confidence =
      imageQuality === 'unrecognizable'
        ? 0.15
        : imageQuality === 'blurry'
          ? 0.45
          : matchedModel
            ? 0.9
            : matchedBrand || matchedCategory
              ? 0.72
              : 0.35;

    return {
      brand: matchedBrand,
      model: matchedModel,
      productType: matchedProductType,
      category: matchedCategory,
      color: detectedColor,
      packagingText: matchedModel ? [matchedModel] : [],
      visualAttributes: [
        ...(detectedColor ? [`Color: ${detectedColor}`] : []),
        ...(extractedReqs.features || []),
      ],
      keywords,
      confidence,
      imageQuality,
      detectedProductCount,
      qualityWarning:
        imageQuality === 'blurry'
          ? 'The uploaded image appears blurry or low-resolution. Please verify or correct the identified brand and model below.'
          : imageQuality === 'multiple_products'
            ? 'Multiple products were detected in this image. Showing matches for the primary product — use the correction fields below to switch to another item.'
            : imageQuality === 'unrecognizable'
              ? 'Could not clearly identify a specific product from the image alone. Please enter the brand, model, or category below to find matches.'
              : undefined,
      additionalDetectedItems,
      extractionSource: 'deterministic_fallback',
    };
  }

  private rankAndClassifyCatalogueMatches(clues: VisualSearchClues): {
    matches: VisualMatchedProduct[];
    overallClassification: VisualMatchClassification;
    classificationSummary: string;
  } {
    if (
      clues.imageQuality === 'unrecognizable' &&
      !clues.brand &&
      !clues.model &&
      !clues.category &&
      clues.keywords.length === 0
    ) {
      return {
        matches: [],
        overallClassification: 'no_match',
        classificationSummary:
          'We could not identify a specific product from this image. Please provide a clearer photo or use the correction fields below to specify the brand, model, or category.',
      };
    }

    const allProducts = this.productRepo.findMany({
      inStockOnly: true,
      limit: 500,
    });

    const clueBrandLower = clues.brand?.toLowerCase().trim();
    const clueModelLower = clues.model?.toLowerCase().trim();
    const clueCategoryLower = clues.category?.toLowerCase().trim();
    const clueColorLower = clues.color?.toLowerCase().trim();

    const modelTokens = (clueModelLower || '')
      .split(/[^a-z0-9+]+/)
      .filter((t) => t.length >= 2 && t !== clueBrandLower);

    const scoredCandidates: VisualMatchedProduct[] = [];

    for (const product of allProducts) {
      let score = 0;
      const reasons: string[] = [];

      const prodBrandLower = product.brand.toLowerCase();
      const prodNameLower = product.name.toLowerCase();
      const prodCatLower = product.category.toLowerCase();
      const prodSearchText = `${prodNameLower} ${prodBrandLower} ${product.description.toLowerCase()} ${product.features.join(' ').toLowerCase()} ${product.product_type || ''}`;

      const brandMatched = Boolean(
        clueBrandLower &&
          (prodBrandLower === clueBrandLower ||
            prodBrandLower.includes(clueBrandLower) ||
            clueBrandLower.includes(prodBrandLower))
      );

      if (brandMatched) {
        score += 35;
        reasons.push(`Brand match (${product.brand})`);
      }

      let modelTokenHits = 0;
      if (modelTokens.length > 0) {
        for (const mt of modelTokens) {
          if (prodNameLower.includes(mt) || product.id.toLowerCase().includes(mt)) {
            modelTokenHits += 1;
          }
        }
        const modelOverlapRatio = modelTokenHits / modelTokens.length;
        if (modelOverlapRatio >= 0.6) {
          score += Math.round(45 * modelOverlapRatio);
          reasons.push(`Model identifier match (${product.name})`);
        } else if (modelTokenHits > 0) {
          score += modelTokenHits * 12;
          reasons.push(`Partial model token match`);
        }
      }

      const categoryMatched = Boolean(
        clueCategoryLower && prodCatLower === clueCategoryLower
      );
      if (categoryMatched) {
        score += 22;
        reasons.push(`Category match (${product.category})`);
      }

      // Keyword overlap
      let kwHits = 0;
      for (const kw of clues.keywords) {
        if (
          kw.length >= 3 &&
          kw !== clueBrandLower &&
          prodSearchText.includes(kw.toLowerCase())
        ) {
          kwHits += 1;
        }
      }
      if (kwHits > 0) {
        score += Math.min(20, kwHits * 6);
        reasons.push(`Matched ${kwHits} visual keyword clue(s)`);
      }

      if (clueColorLower && prodSearchText.includes(clueColorLower)) {
        score += 5;
        reasons.push(`Color match (${clues.color})`);
      }

      if (score < 18) {
        continue;
      }

      // Determine classification strictly:
      // 1. confirmed_exact_match: Brand matches AND model tokens strongly match (or exact product name) AND image is not blurry
      // 2. likely_match: Brand + category match, or high multi-token score (>= 45)
      // 3. relevant_alternative: Category or general keyword match (e.g., uploaded a brand not in catalogue, showing alternatives in same category)
      let matchClassification: Exclude<VisualMatchClassification, 'no_match'>;

      const hasStrongModelMatch =
        Boolean(clueModelLower && prodNameLower.includes(clueModelLower)) ||
        (modelTokens.length > 0 && modelTokenHits / modelTokens.length >= 0.6);

      if (
        brandMatched &&
        hasStrongModelMatch &&
        clues.imageQuality !== 'blurry'
      ) {
        matchClassification = 'confirmed_exact_match';
      } else if (
        (brandMatched && (categoryMatched || kwHits > 0)) ||
        (brandMatched && hasStrongModelMatch && clues.imageQuality === 'blurry') ||
        (!clueBrandLower && hasStrongModelMatch) ||
        (!clueBrandLower && score >= 48)
      ) {
        matchClassification = 'likely_match';
      } else {
        matchClassification = 'relevant_alternative';
        if (clueBrandLower && !brandMatched) {
          reasons.push(
            `Alternative to ${clues.brand}${clues.model ? ` ${clues.model}` : ''} in ${product.category}`
          );
        }
      }

      scoredCandidates.push({
        product,
        matchClassification,
        matchScore: Math.min(100, score),
        matchReasons: reasons,
      });
    }

    scoredCandidates.sort(
      (a, b) =>
        b.matchScore - a.matchScore || b.product.rating - a.product.rating
    );

    const topMatches = scoredCandidates.slice(0, 6);

    if (topMatches.length === 0) {
      const requestedDesc =
        [clues.brand, clues.model, clues.category].filter(Boolean).join(' ') ||
        'the uploaded item';
      return {
        matches: [],
        overallClassification: 'no_match',
        classificationSummary: `We couldn't find any products matching **${requestedDesc}** in our current 150-product catalogue. You can edit the brand, model, or category below to search for related products.`,
      };
    }

    const hasConfirmedExact = topMatches.some(
      (m) => m.matchClassification === 'confirmed_exact_match'
    );
    const hasLikely = topMatches.some(
      (m) => m.matchClassification === 'likely_match'
    );

    const overallClassification: VisualMatchClassification = hasConfirmedExact
      ? 'confirmed_exact_match'
      : hasLikely
        ? 'likely_match'
        : 'relevant_alternative';

    const topProd = topMatches[0].product;
    let classificationSummary = '';

    if (overallClassification === 'confirmed_exact_match') {
      classificationSummary = `**Confirmed Exact Match**: Identified **${topProd.name}** (${topProd.brand}) at **₹${topProd.price.toLocaleString('en-IN')}** (${topProd.rating}★), along with ${Math.max(0, topMatches.length - 1)} related option(s) in our catalogue.`;
    } else if (overallClassification === 'likely_match') {
      classificationSummary = `**Likely Product Match**: Based on the visual clues (${[clues.brand, clues.model, clues.category].filter(Boolean).join(' • ') || 'product features'}), the closest match in our catalogue is **${topProd.name}** (₹${topProd.price.toLocaleString('en-IN')}).${clues.qualityWarning ? ` *${clues.qualityWarning}*` : ''}`;
    } else {
      const requestedLabel =
        [clues.brand, clues.model].filter(Boolean).join(' ') ||
        clues.category ||
        'the uploaded product';
      classificationSummary = `**Relevant Catalogue Alternatives**: We don't have an exact match for **${requestedLabel}** in our catalogue, so here are the closest verified alternatives in **${topProd.category}** starting with **${topProd.name}** (₹${topProd.price.toLocaleString('en-IN')}).`;
    }

    return {
      matches: topMatches,
      overallClassification,
      classificationSummary,
    };
  }
}
