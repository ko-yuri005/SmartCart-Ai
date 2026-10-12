import { Product } from '../types/index.js';
import { IProductRepository } from '../db/repositories/product.repository.js';

export interface ComparisonIndicators {
  cheapestProductId: string;
  highestRatedProductId: string;
  mostReviewedProductId: string;
  strongestUseCaseMatchId?: string;
  priceSpread: number; // Max price - min price in ₹
}

export interface SpecRow {
  key: string;
  values: Record<string, string | number>;
}

export type ComparisonCategoryGroup =
  | 'electronics'
  | 'food_nutrition'
  | 'clothing_apparel'
  | 'footwear'
  | 'personal_care'
  | 'home_kitchen_furniture'
  | 'sports_automotive_other'
  | 'mixed';


export interface ComparisonAttributeRow {
  key: string;
  label: string;
  section: 'common' | 'category_specific';
  values: Record<string, string>;
}

export interface ProductEvidenceBreakdown {
  productId: string;
  productName: string;
  verifiedFacts: string[];
  sellerClaims: string[];
  aiInterpretations: string[];
}

export interface ProductCertificationAudit {
  productId: string;
  productName: string;
  isOrganicCertified: boolean;
  organicStatus:
    | 'certified_organic'
    | 'not_certified_organic'
    | 'not_applicable'
    | 'unknown';
  organicCertificationLabel: string;
  verifiedCertifications: string[];
  unverifiedMarketingTerms: string[];
  auditNote: string;
}

export type ComparisonPriorityKey =
  | 'budget'
  | 'quality_performance'
  | 'sustainability_certifications'
  | 'everyday_convenience';

export interface PriorityVerdict {
  priority: ComparisonPriorityKey;
  priorityLabel: string;
  recommendedProductId: string;
  recommendedProductName: string;
  rationale: string;
}

export interface ComparisonResult {
  products: Product[];
  indicators: ComparisonIndicators;
  sharedFeatures: string[];
  uniqueFeatures: Record<string, string[]>;
  specMatrix: SpecRow[];
  // Phase 4 structured extensions
  categoryGroup: ComparisonCategoryGroup;
  commonMatrix: ComparisonAttributeRow[];
  categorySpecificMatrix: ComparisonAttributeRow[];
  evidenceBreakdown: Record<string, ProductEvidenceBreakdown>;
  certificationAudit: Record<string, ProductCertificationAudit>;
  verdictsByPriority: Record<ComparisonPriorityKey, PriorityVerdict>;
  priorityVerdictSummary: string;
  comparisonScopeNote: string;
}

const RECOGNIZED_ORGANIC_CERT_REGEX =
  /\b(usda\s+organic|india\s+organic|npop\s+certified|npop\s+organic|ecocert\s+organic|cosmos\s+organic|jaivik\s+bharat|eu\s+organic|soil\s+association\s+organic|gots\s+certified(?:\s+organic)?)\b/i;

const NEGATED_ORGANIC_REGEX =
  /\b(not\s+organic|non-?organic|no\s+organic\s+certification|not\s+certified\s+organic|unverified\s+organic)\b/i;

const MARKETING_BUZZWORDS: { label: string; regex: RegExp }[] = [
  { label: 'natural', regex: /\b(?:100%\s+)?natural\b/i },
  { label: 'green', regex: /\bgreen\b/i },
  { label: 'eco-friendly', regex: /\beco[\s-]?friendly\b/i },
  { label: 'herbal', regex: /\bherbal\b/i },
  { label: 'botanical', regex: /\bbotanicals?\b/i },
  { label: 'plant-based', regex: /\bplant[\s-]?based\b/i },
  { label: 'chemical-free', regex: /\bchemical[\s-]?free\b/i },
  { label: 'clean beauty', regex: /\bclean\s+beauty\b/i },
  { label: 'pure', regex: /\b100%\s+pure\b/i },
  { label: 'sustainable', regex: /\bsustainabl(?:e|y)\b/i },
];

const RECOGNIZED_TECHNICAL_CERTS: { label: string; regex: RegExp }[] = [
  { label: 'ISI Certified', regex: /\bisi\b/i },
  { label: 'DOT Certified', regex: /\bdot\b/i },
  { label: 'ECE 22.05 / 22.06', regex: /\bece(?:\s*22\.0[56])?\b/i },
  { label: 'BIS Approved', regex: /\bbis\b/i },
  { label: 'BIFMA Certified', regex: /\bbifma\b/i },
  { label: 'Dermatologically Tested', regex: /\bdermatologically\s+tested\b/i },
  { label: 'SPF 50 PA++++', regex: /\bspf\s*50\s*(?:pa\+*)?\b/i },
  { label: 'IP68 Water Resistance', regex: /\bip68\b/i },
  { label: 'IP67 Water Resistance', regex: /\bip67\b/i },
  { label: 'IPX5 Water Resistance', regex: /\bipx5\b/i },
  { label: 'IPX4 Water Resistance', regex: /\bipx4\b/i },
  { label: 'Dolby Atmos / Audio', regex: /\bdolby\b/i },
  { label: 'Hi-Res Audio', regex: /\bhi-?res\s+audio\b/i },
  { label: 'TÜV Rheinland', regex: /\bt[uü]v\b/i },
];

export class ComparisonService {
  constructor(private productRepo: IProductRepository) {}

  /**
   * Strictly audits a product's organic and technical certifications.
   * CRITICAL RULE: Never infer organic certification from marketing words like
   * "natural", "green", "herbal", "botanical", or "eco-friendly".
   */
  public auditProductCertifications(
    product: Pick<
      Product,
      'id' | 'name' | 'category' | 'description' | 'features' | 'specifications'
    >
  ): ProductCertificationAudit {
    const specs = product.specifications || {};
    const specEntriesText = Object.entries(specs)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');
    const featuresText = (product.features || []).join(' | ');
    const fullText = `${product.name} | ${product.description || ''} | ${featuresText} | ${specEntriesText}`;

    const explicitOrganicSpec = String(
      specs.organic_certification ??
        specs.organicCertification ??
        specs['Organic Certification'] ??
        ''
    ).trim();

    const hasNegatedOrganic =
      NEGATED_ORGANIC_REGEX.test(fullText) ||
      NEGATED_ORGANIC_REGEX.test(explicitOrganicSpec);

    const matchedOrganicCertMatch =
      !hasNegatedOrganic &&
      (RECOGNIZED_ORGANIC_CERT_REGEX.exec(explicitOrganicSpec) ||
        RECOGNIZED_ORGANIC_CERT_REGEX.exec(specEntriesText) ||
        RECOGNIZED_ORGANIC_CERT_REGEX.exec(featuresText));

    const isOrganicCertified = Boolean(matchedOrganicCertMatch && !hasNegatedOrganic);

    // Collect unverified marketing terms ("natural", "green", "eco-friendly", etc.)
    const unverifiedMarketingTerms: string[] = [];
    for (const term of MARKETING_BUZZWORDS) {
      if (term.regex.test(fullText)) {
        unverifiedMarketingTerms.push(term.label);
      }
    }

    // Collect verified technical / safety / quality certifications
    const verifiedCertifications: string[] = [];
    if (isOrganicCertified && matchedOrganicCertMatch) {
      verifiedCertifications.push(matchedOrganicCertMatch[0].toUpperCase());
    }
    for (const cert of RECOGNIZED_TECHNICAL_CERTS) {
      if (cert.regex.test(fullText)) {
        verifiedCertifications.push(cert.label);
      }
    }
    if (specs.certification && typeof specs.certification === 'string') {
      const certVal = specs.certification.trim();
      if (
        certVal &&
        !verifiedCertifications.some(
          (c) => c.toLowerCase() === certVal.toLowerCase()
        ) &&
        !MARKETING_BUZZWORDS.some((b) => b.regex.test(certVal))
      ) {
        verifiedCertifications.push(certVal);
      }
    }

    const catLower = (product.category || '').toLowerCase();
    const isOrganicRelevantCategory =
      catLower.includes('food') ||
      catLower.includes('grocery') ||
      catLower.includes('nutrition') ||
      catLower.includes('beauty') ||
      catLower.includes('personal-care') ||
      catLower.includes('fashion') ||
      unverifiedMarketingTerms.length > 0 ||
      Boolean(explicitOrganicSpec);

    let organicStatus: ProductCertificationAudit['organicStatus'];
    let organicCertificationLabel: string;
    let auditNote: string;

    if (isOrganicCertified && matchedOrganicCertMatch) {
      organicStatus = 'certified_organic';
      organicCertificationLabel = `Verified (${matchedOrganicCertMatch[0]})`;
      auditNote = `Explicit organic certification documented (${matchedOrganicCertMatch[0]}).`;
    } else if (unverifiedMarketingTerms.length > 0) {
      organicStatus = 'not_certified_organic';
      organicCertificationLabel = `Not certified organic (contains marketing terms: ${unverifiedMarketingTerms.join(', ')})`;
      auditNote = `Contains seller marketing terms (${unverifiedMarketingTerms
        .map((t) => `'${t}'`)
        .join(', ')}) without documented organic certification. Never inferred as organic.`;
    } else if (isOrganicRelevantCategory) {
      organicStatus = 'not_certified_organic';
      organicCertificationLabel = 'Certification not specified (Not certified organic)';
      auditNote = 'Certification not specified — no organic certification is documented in the product specifications.';
    } else {
      organicStatus = 'not_applicable';
      organicCertificationLabel = 'Certification not specified (Not applicable)';
      auditNote =
        verifiedCertifications.length > 0
          ? `Documented technical standards: ${verifiedCertifications.join(', ')}.`
          : 'No external certifications documented in product specifications.';
    }

    return {
      productId: product.id,
      productName: product.name,
      isOrganicCertified,
      organicStatus,
      organicCertificationLabel,
      verifiedCertifications,
      unverifiedMarketingTerms,
      auditNote,
    };
  }

  private classifyCategoryGroup(products: Product[]): ComparisonCategoryGroup {
    const groups = new Set<ComparisonCategoryGroup>();

    for (const p of products) {
      const cat = (p.category || '').toLowerCase();
      if (
        [
          'headphones',
          'smartphones',
          'smartwatches',
          'laptops',
          'keyboards-mice',
          'power-accessories',
        ].includes(cat)
      ) {
        groups.add('electronics');
      } else if (
        cat.includes('food') ||
        cat.includes('grocery') ||
        cat.includes('nutrition')
      ) {
        groups.add('food_nutrition');
      } else if (cat === 'footwear' || cat.includes('shoe') || cat.includes('footwear')) {
        groups.add('footwear');
      } else if (
        ['fashion', 'travel-luggage'].includes(cat) ||
        cat.includes('clothing') ||
        cat.includes('apparel') ||
        cat.includes('jersey')
      ) {
        groups.add('clothing_apparel');
      } else if (cat === 'beauty-personal-care') {
        groups.add('personal_care');
      } else if (['kitchen-appliances', 'furniture'].includes(cat)) {
        groups.add('home_kitchen_furniture');
      } else {
        groups.add('sports_automotive_other');
      }
    }

    if (groups.size === 1) {
      return Array.from(groups)[0];
    }
    return 'mixed';
  }

  private isMotorcycleProduct(p: Product): boolean {
    const pt = (p.product_type || '').toLowerCase();
    return (
      pt === 'motorcycle' ||
      pt === 'scooter' ||
      /\b(motorcycle|roadster|cruiser|scrambler|scooter)\b/i.test(p.name)
    );
  }

  private lookupSpecValue(
    product: Product,
    candidateKeys: string[],
    fallbackTextExtractor?: (p: Product) => string | undefined,
    missingLabel: 'Not provided' | 'Unknown' | 'Not specified in catalogue' = 'Not provided'
  ): string {
    const specs = product.specifications || {};
    const lowerMap = new Map<string, string | number>();
    for (const [k, v] of Object.entries(specs)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        lowerMap.set(k.toLowerCase().trim(), v);
      }
    }

    for (const key of candidateKeys) {
      const val = lowerMap.get(key.toLowerCase());
      if (val !== undefined) {
        return String(val);
      }
    }

    if (fallbackTextExtractor) {
      const extracted = fallbackTextExtractor(product);
      if (extracted && extracted.trim().length > 0) {
        return extracted.trim();
      }
    }

    return missingLabel;
  }

  private formatProductVariantsSummary(p: Product): string {
    if (p.variants && p.variants.length > 0) {
      const inStockSizes = p.variants
        .filter((v) => v.availability && v.stockCount > 0)
        .map((v) => v.size || v.label);
      const outOfStockSizes = p.variants
        .filter((v) => !v.availability || v.stockCount <= 0)
        .map((v) => v.size || v.label);
      const parts: string[] = [];
      if (inStockSizes.length > 0) {
        parts.push(`Available: ${inStockSizes.join(', ')}`);
      }
      if (outOfStockSizes.length > 0) {
        parts.push(`Out of stock: ${outOfStockSizes.join(', ')}`);
      }
      return parts.join(' | ') || 'Standard';
    }
    const val = this.lookupSpecValue(
      p,
      ['size', 'sizes', 'available_sizes', 'variants'],
      undefined,
      'Not provided'
    );
    return val === 'Not provided' ? 'Standard (single configuration)' : val;
  }

  private buildCommonMatrix(products: Product[]): ComparisonAttributeRow[] {
    const cheapestPrice = Math.min(...products.map((p) => p.price));
    const allMotorcycles = products.every((p) => this.isMotorcycleProduct(p));

    const priceValues: Record<string, string> = {};
    const discountValues: Record<string, string> = {};
    const ratingValues: Record<string, string> = {};
    const warrantyValues: Record<string, string> = {};
    const availabilityValues: Record<string, string> = {};
    const variantValues: Record<string, string> = {};

    for (const p of products) {
      const isMoto = this.isMotorcycleProduct(p);
      const exShowroomSuffix = isMoto ? ' (Ex-Showroom)' : '';
      if (p.is_on_sale && p.original_price && p.original_price > p.price) {
        priceValues[p.id] = `₹${p.price.toLocaleString('en-IN')}${exShowroomSuffix} (MRP ₹${p.original_price.toLocaleString('en-IN')})`;
      } else {
        priceValues[p.id] = `₹${p.price.toLocaleString('en-IN')}${exShowroomSuffix}`;
      }

      if (p.is_on_sale && p.original_price && p.original_price > p.price) {
        const saved = Math.round(p.original_price - p.price);
        discountValues[p.id] = `${p.discount_percent || Math.round((saved / p.original_price) * 100)}% OFF (Save ₹${saved.toLocaleString('en-IN')})`;
      } else if (p.specifications.discount || p.specifications.discount_percent) {
        discountValues[p.id] = String(
          p.specifications.discount ?? `${p.specifications.discount_percent}% off`
        );
      } else if (p.price === cheapestPrice && products.length > 1) {
        discountValues[p.id] = isMoto
          ? 'Lower ex-showroom price in comparison'
          : 'Lowest catalogue price in comparison';
      } else {
        const diff = p.price - cheapestPrice;
        discountValues[p.id] =
          diff > 0
            ? `+₹${diff.toLocaleString('en-IN')} vs lowest`
            : 'Standard catalogue price';
      }

      ratingValues[p.id] = `${p.rating} / 5 (${p.review_count.toLocaleString('en-IN')} verified reviews)`;

      warrantyValues[p.id] = this.lookupSpecValue(
        p,
        ['warranty', 'warranty_period', 'manufacturer_warranty', 'guarantee', 'service_interval'],
        undefined,
        isMoto ? 'Not specified in catalogue' : 'Not provided'
      );

      if (isMoto) {
        availabilityValues[p.id] =
          'Verified Catalogue Record • Dealer Enquiry / Specification View (Not parcel-shippable)';
      } else {
        const stock =
          typeof p.stock_count === 'number'
            ? p.stock_count
            : p.availability
              ? 25
              : 0;
        availabilityValues[p.id] =
          p.availability && stock > 0
            ? `In Stock (${stock} units available)`
            : 'Out of Stock';
      }

      variantValues[p.id] = this.formatProductVariantsSummary(p);
    }

    return [
      {
        key: 'price',
        label: allMotorcycles ? 'Ex-Showroom Price' : 'Effective Selling Price',
        section: 'common',
        values: priceValues,
      },
      {
        key: 'discount_value',
        label: 'Discount / Relative Value',
        section: 'common',
        values: discountValues,
      },
      {
        key: 'rating',
        label: 'Customer Rating & Reviews',
        section: 'common',
        values: ratingValues,
      },
      {
        key: 'variants_sizes',
        label: 'Sizes & Variants',
        section: 'common',
        values: variantValues,
      },
      {
        key: 'warranty',
        label: allMotorcycles ? 'Warranty / Service Interval' : 'Warranty',
        section: 'common',
        values: warrantyValues,
      },
      {
        key: 'availability',
        label: allMotorcycles ? 'Fulfillment & Dealer Enquiry' : 'Availability & Stock',
        section: 'common',
        values: availabilityValues,
      },
    ];
  }

  private buildCategorySpecificMatrix(
    products: Product[],
    categoryGroup: ComparisonCategoryGroup,
    certAudits: Record<string, ProductCertificationAudit>
  ): ComparisonAttributeRow[] {
    const makeRow = (
      key: string,
      label: string,
      resolver: (p: Product) => string
    ): ComparisonAttributeRow => {
      const values: Record<string, string> = {};
      for (const p of products) {
        values[p.id] = resolver(p);
      }
      return { key, label, section: 'category_specific', values };
    };

    if (categoryGroup === 'food_nutrition') {
      return [
        makeRow('ingredients', 'Ingredients', (p) =>
          this.lookupSpecValue(
            p,
            ['ingredients', 'key_ingredients', 'composition'],
            undefined,
            'Not provided'
          )
        ),
        makeRow('nutrition_info', 'Nutritional Information', (p) =>
          this.lookupSpecValue(
            p,
            ['nutritional_info', 'nutrition', 'calories', 'macros', 'protein'],
            undefined,
            'Not provided'
          )
        ),
        makeRow(
          'organic_certification',
          'Organic Certification',
          (p) => certAudits[p.id]?.organicCertificationLabel || 'Not provided'
        ),
        makeRow('price_per_unit', 'Price Per Unit / Pack Size', (p) => {
          const weight = this.lookupSpecValue(
            p,
            ['weight', 'net_weight', 'volume', 'size', 'pack_size', 'quantity'],
            undefined,
            'Unknown'
          );
          return weight !== 'Unknown'
            ? `₹${p.price.toLocaleString('en-IN')} (${weight})`
            : 'Unknown (pack weight not provided)';
        }),
      ];
    }

    if (categoryGroup === 'footwear') {
      return [
        makeRow('available_sizes', 'Available Sizes (UK / EU)', (p) =>
          this.formatProductVariantsSummary(p)
        ),
        makeRow('materials', 'Materials (Upper & Sole)', (p) =>
          this.lookupSpecValue(
            p,
            ['outer_material', 'sole_material', 'material', 'upper_material', 'midsole'],
            undefined,
            'Not provided'
          )
        ),
        makeRow('intended_use', 'Intended Use', (p) =>
          this.lookupSpecValue(
            p,
            ['intended_use', 'sport_type', 'terrain', 'arch_type'],
            (prod) =>
              prod.use_cases && prod.use_cases.length > 0
                ? prod.use_cases.join(', ')
                : undefined,
            'Not provided'
          )
        ),
        makeRow('comfort_durability', 'Comfort & Durability Features', (p) =>
          this.lookupSpecValue(
            p,
            ['cushioning', 'closure', 'heel_type', 'water_resistance', 'weight'],
            (prod) =>
              prod.features && prod.features.length > 0
                ? prod.features.slice(0, 3).join(', ')
                : undefined,
            'Not provided'
          )
        ),
      ];
    }

    if (categoryGroup === 'clothing_apparel') {
      return [
        makeRow('material_composition', 'Fabric / Material Composition', (p) =>
          this.lookupSpecValue(
            p,
            ['material', 'fabric', 'outer_material', 'sole_material', 'composition'],
            undefined,
            'Not provided'
          )
        ),
        makeRow('fit_sizing', 'Fit & Available Sizes', (p) => {
          const fit = this.lookupSpecValue(
            p,
            ['fit', 'sleeve', 'neck', 'pattern', 'capacity'],
            undefined,
            'Not provided'
          );
          const vars = this.formatProductVariantsSummary(p);
          return fit !== 'Not provided' ? `${fit} (${vars})` : vars;
        }),
        makeRow('care_instructions', 'Care Instructions', (p) =>
          this.lookupSpecValue(
            p,
            ['care', 'care_instructions', 'wash_care', 'maintenance'],
            undefined,
            'Not provided'
          )
        ),
        makeRow('sustainability_claims', 'Documented Sustainability / Certifications', (p) => {
          const audit = certAudits[p.id];
          if (audit?.isOrganicCertified) {
            return audit.organicCertificationLabel;
          }
          if (audit && audit.unverifiedMarketingTerms.length > 0) {
            return `Seller claim only (${audit.unverifiedMarketingTerms.join(', ')}) — Not certified organic`;
          }
          return this.lookupSpecValue(
            p,
            ['sustainability', 'certification', 'eco_certification'],
            undefined,
            'Not provided'
          );
        }),
      ];
    }


    if (categoryGroup === 'personal_care') {
      return [
        makeRow('ingredients', 'Key Ingredients / Actives', (p) =>
          this.lookupSpecValue(
            p,
            ['key_ingredients', 'ingredients', 'active_ingredients', 'formulation'],
            undefined,
            'Not provided'
          )
        ),
        makeRow('size_volume', 'Pack Size / Volume', (p) =>
          this.lookupSpecValue(
            p,
            ['volume', 'weight', 'net_quantity', 'size', 'capacity'],
            undefined,
            'Not provided'
          )
        ),
        makeRow('intended_use', 'Skin / Hair Type & Intended Use', (p) =>
          this.lookupSpecValue(
            p,
            ['skin_type', 'hair_type', 'suitable_for', 'finish', 'spf'],
            (prod) =>
              prod.use_cases && prod.use_cases.length > 0
                ? prod.use_cases.join(', ')
                : undefined,
            'Not provided'
          )
        ),
        makeRow('verified_certifications', 'Verified Certifications & Organic Status', (p) => {
          const audit = certAudits[p.id];
          if (!audit) return 'Unknown';
          const certs =
            audit.verifiedCertifications.length > 0
              ? audit.verifiedCertifications.join(', ')
              : 'None documented';
          return `${certs} • Organic: ${audit.organicCertificationLabel}`;
        }),
      ];
    }

    if (categoryGroup === 'electronics') {
      return [
        makeRow('key_specifications', 'Core Specifications', (p) =>
          this.lookupSpecValue(
            p,
            [
              'processor',
              'driver_size',
              'display',
              'switch_type',
              'sensor',
              'capacity',
              'ram',
            ],
            (prod) => {
              const entries = Object.entries(prod.specifications || {}).slice(0, 2);
              return entries.length > 0
                ? entries.map(([k, v]) => `${k}: ${v}`).join('; ')
                : undefined;
            },
            'Not provided'
          )
        ),
        makeRow('compatibility', 'Compatibility & Connectivity', (p) =>
          this.lookupSpecValue(
            p,
            [
              'connectivity',
              'bluetooth',
              'compatibility',
              'os',
              'ports',
              'interface',
            ],
            undefined,
            'Not provided'
          )
        ),
        makeRow('battery_power', 'Battery & Power', (p) =>
          this.lookupSpecValue(
            p,
            [
              'battery_life',
              'battery',
              'capacity',
              'output_power',
              'charging',
              'power_consumption',
            ],
            undefined,
            'Not provided'
          )
        ),
        makeRow('energy_efficiency', 'Energy Efficiency / Rating', (p) =>
          this.lookupSpecValue(
            p,
            ['energy_rating', 'star_rating', 'efficiency', 'fast_charging'],
            undefined,
            'Not provided'
          )
        ),
      ];
    }

    if (products.every((p) => this.isMotorcycleProduct(p))) {
      return [
        makeRow('manufacturer_model', 'Manufacturer & Model', (p) => `${p.brand} — ${p.name}`),
        makeRow(
          'ex_showroom_price',
          'Ex-Showroom Price',
          (p) => `₹${p.price.toLocaleString('en-IN')} (Ex-Showroom)`
        ),
        makeRow('engine_displacement', 'Engine Capacity / Displacement', (p) =>
          this.lookupSpecValue(
            p,
            ['engine', 'displacement', 'engine_cc'],
            (prod) => {
              const cc = prod.specifications?.engine_cc;
              return cc !== undefined ? `${cc}cc` : undefined;
            },
            'Not specified in catalogue'
          )
        ),
        makeRow('power_torque', 'Power & Torque', (p) => {
          const power = this.lookupSpecValue(
            p,
            ['power', 'max_power'],
            undefined,
            'Not specified in catalogue'
          );
          const torque = this.lookupSpecValue(
            p,
            ['torque', 'max_torque'],
            undefined,
            'Not specified in catalogue'
          );
          if (power === 'Not specified in catalogue' && torque === 'Not specified in catalogue') {
            return 'Not specified in catalogue';
          }
          return `Power: ${power} | Torque: ${torque}`;
        }),
        makeRow('transmission', 'Transmission / Gearbox', (p) =>
          this.lookupSpecValue(
            p,
            ['transmission', 'gearbox'],
            (prod) => {
              const feat = (prod.features || []).find((f) =>
                /\b([56]-speed|slip\s*(?:&|and)\s*assist|cvt|automatic|manual)\b/i.test(f)
              );
              return feat;
            },
            'Not specified in catalogue'
          )
        ),
        makeRow('kerb_weight', 'Weight / Kerb Weight', (p) =>
          this.lookupSpecValue(
            p,
            ['weight', 'kerb_weight'],
            undefined,
            'Not specified in catalogue'
          )
        ),
        makeRow('seat_height', 'Seat Height', (p) =>
          this.lookupSpecValue(
            p,
            ['seat_height'],
            undefined,
            'Not specified in catalogue'
          )
        ),
        makeRow('braking_safety', 'Braking / ABS / Safety Features', (p) =>
          this.lookupSpecValue(
            p,
            ['brakes', 'abs', 'braking'],
            (prod) => {
              const safetyFeats = (prod.features || []).filter((f) =>
                /\b(abs|brakes?|disc|traction\s+control|slip\s*(?:&|and)\s*assist)\b/i.test(f)
              );
              return safetyFeats.length > 0 ? safetyFeats.join(', ') : undefined;
            },
            'Not specified in catalogue'
          )
        ),
        makeRow('intended_riding_use', 'Intended Riding Use', (p) =>
          p.use_cases && p.use_cases.length > 0
            ? p.use_cases.join(', ')
            : 'Not specified in catalogue'
        ),
        makeRow('warranty_service', 'Warranty / Service Info', (p) =>
          this.lookupSpecValue(
            p,
            ['warranty', 'service_interval', 'warranty_period'],
            (prod) => {
              const si = prod.specifications?.service_interval;
              const w = prod.specifications?.warranty;
              if (w && si) return `Warranty: ${w} | Service Interval: ${si}`;
              if (w) return `Warranty: ${w}`;
              if (si) return `Service Interval: ${si} (Warranty not specified in catalogue)`;
              return undefined;
            },
            'Not specified in catalogue'
          )
        ),
        makeRow(
          'verification_status',
          'Verification & Fulfillment Status',
          () =>
            'Verified Catalogue Record • Dealer Enquiry / Specification View (Not parcel-shippable)'
        ),
      ];
    }

    // Home, Kitchen, Furniture, Automotive, Sports, or Mixed
    return [
      makeRow('material_build', 'Material & Build Construction', (p) =>
        this.lookupSpecValue(
          p,
          ['material', 'frame_material', 'shell_material', 'body_material', 'build'],
          undefined,
          'Not provided'
        )
      ),
      makeRow('capacity_dimensions', 'Capacity / Dimensions / Weight', (p) =>
        this.lookupSpecValue(
          p,
          ['capacity', 'weight', 'dimensions', 'engine', 'displacement', 'size'],
          undefined,
          'Not provided'
        )
      ),
      makeRow('safety_certifications', 'Verified Safety & Quality Certifications', (p) => {
        const audit = certAudits[p.id];
        if (audit && audit.verifiedCertifications.length > 0) {
          return audit.verifiedCertifications.join(', ');
        }
        return this.lookupSpecValue(
          p,
          ['certification', 'safety_standard', 'isi_certified'],
          undefined,
          'Not provided'
        );
      }),
      makeRow('intended_use_cases', 'Recommended Use Cases', (p) =>
        p.use_cases && p.use_cases.length > 0
          ? p.use_cases.join(', ')
          : 'Not provided'
      ),
    ];
  }

  private buildEvidenceBreakdown(
    products: Product[],
    certAudits: Record<string, ProductCertificationAudit>
  ): Record<string, ProductEvidenceBreakdown> {
    const result: Record<string, ProductEvidenceBreakdown> = {};

    for (const p of products) {
      const audit = certAudits[p.id];
      const verifiedFacts: string[] = [
        `Catalogue Price: ₹${p.price.toLocaleString('en-IN')}`,
        `Customer Rating: ${p.rating}/5 across ${p.review_count.toLocaleString('en-IN')} reviews`,
        `Stock Status: ${p.availability ? `In Stock (${p.stock_count ?? 25} units)` : 'Out of Stock'}`,
      ];

      for (const [k, v] of Object.entries(p.specifications || {}).slice(0, 5)) {
        verifiedFacts.push(`Specification (${k}): ${v}`);
      }

      if (audit && audit.verifiedCertifications.length > 0) {
        verifiedFacts.push(
          `Documented Certifications: ${audit.verifiedCertifications.join(', ')}`
        );
      }

      const sellerClaims: string[] = [];
      for (const feat of p.features || []) {
        sellerClaims.push(`Feature listing: "${feat}"`);
      }
      if (audit && audit.unverifiedMarketingTerms.length > 0) {
        sellerClaims.push(
          `Marketing descriptor(s): ${audit.unverifiedMarketingTerms
            .map((t) => `"${t}"`)
            .join(', ')} (seller claim; not verified as certified organic)`
        );
      }
      if (sellerClaims.length === 0 && p.description) {
        sellerClaims.push(`Seller description: "${p.description.slice(0, 120)}"`);
      }

      const aiInterpretations: string[] = [
        p.use_cases && p.use_cases.length > 0
          ? `Well suited for ${p.use_cases.join(', ')} workflows based on its specification profile.`
          : `General-purpose option in the ${p.category} category.`,
        p.rating >= 4.5
          ? `Strong buyer satisfaction signal (${p.rating}/5 rating).`
          : `Competitive value option at ₹${p.price.toLocaleString('en-IN')}.`,
      ];

      result[p.id] = {
        productId: p.id,
        productName: p.name,
        verifiedFacts,
        sellerClaims,
        aiInterpretations,
      };
    }

    return result;
  }

  private buildVerdictsByPriority(
    products: Product[],
    certAudits: Record<string, ProductCertificationAudit>,
    targetUseCases?: string[]
  ): {
    verdictsByPriority: Record<ComparisonPriorityKey, PriorityVerdict>;
    priorityVerdictSummary: string;
  } {
    const byPrice = [...products].sort((a, b) => a.price - b.price || b.rating - a.rating);
    const byQuality = [...products].sort(
      (a, b) =>
        b.rating * 100 + Math.min(b.review_count, 5000) / 100 -
        (a.rating * 100 + Math.min(a.review_count, 5000) / 100)
    );
    const byCerts = [...products].sort((a, b) => {
      const aAudit = certAudits[a.id];
      const bAudit = certAudits[b.id];
      const aScore =
        (aAudit?.isOrganicCertified ? 10 : 0) +
        (aAudit?.verifiedCertifications.length || 0) * 2 +
        a.rating;
      const bScore =
        (bAudit?.isOrganicCertified ? 10 : 0) +
        (bAudit?.verifiedCertifications.length || 0) * 2 +
        b.rating;
      return bScore - aScore;
    });

    const byEveryday = [...products].sort((a, b) => {
      const aUseMatch =
        targetUseCases && targetUseCases.length > 0
          ? targetUseCases.filter((u) =>
              a.use_cases.some((pu) => pu.toLowerCase().includes(u.toLowerCase()))
            ).length
          : 0;
      const bUseMatch =
        targetUseCases && targetUseCases.length > 0
          ? targetUseCases.filter((u) =>
              b.use_cases.some((pu) => pu.toLowerCase().includes(u.toLowerCase()))
            ).length
          : 0;
      if (bUseMatch !== aUseMatch) return bUseMatch - aUseMatch;
      // Balance price-to-rating value
      const aValue = a.rating / Math.log10(Math.max(10, a.price));
      const bValue = b.rating / Math.log10(Math.max(10, b.price));
      return bValue - aValue;
    });

    const budgetPick = byPrice[0];
    const qualityPick = byQuality[0];
    const certPick = byCerts[0];
    const everydayPick = byEveryday[0];

    const verdictsByPriority: Record<ComparisonPriorityKey, PriorityVerdict> = {
      budget: {
        priority: 'budget',
        priorityLabel: 'Best for Budget Savings',
        recommendedProductId: budgetPick.id,
        recommendedProductName: budgetPick.name,
        rationale: `Lowest price at ₹${budgetPick.price.toLocaleString('en-IN')} while maintaining a ${budgetPick.rating}/5 rating.`,
      },
      quality_performance: {
        priority: 'quality_performance',
        priorityLabel: 'Best for Quality & Performance',
        recommendedProductId: qualityPick.id,
        recommendedProductName: qualityPick.name,
        rationale: `Highest customer satisfaction (${qualityPick.rating}/5 across ${qualityPick.review_count.toLocaleString('en-IN')} reviews) and strong specification depth.`,
      },
      sustainability_certifications: {
        priority: 'sustainability_certifications',
        priorityLabel: 'Best for Verified Certifications & Standards',
        recommendedProductId: certPick.id,
        recommendedProductName: certPick.name,
        rationale:
          certAudits[certPick.id]?.verifiedCertifications.length > 0
            ? `Backed by documented certifications (${certAudits[certPick.id].verifiedCertifications.join(', ')}).`
            : `Selected based on documented specifications (${certAudits[certPick.id]?.auditNote || 'No external organic certifications documented'}).`,
      },
      everyday_convenience: {
        priority: 'everyday_convenience',
        priorityLabel: 'Best for Everyday Value & Practicality',
        recommendedProductId: everydayPick.id,
        recommendedProductName: everydayPick.name,
        rationale: `Strongest balance of everyday usability (${everydayPick.use_cases.slice(0, 3).join(', ') || everydayPick.category}), ${everydayPick.rating}★ reliability, and ₹${everydayPick.price.toLocaleString('en-IN')} pricing.`,
      },
    };

    const summaryParts = [
      `Choose **${budgetPick.name}** (₹${budgetPick.price.toLocaleString('en-IN')}) if keeping cost low is your top priority`,
      `choose **${qualityPick.name}** (${qualityPick.rating}★) if you prioritize peak rating and specification performance`,
    ];
    if (
      everydayPick.id !== budgetPick.id &&
      everydayPick.id !== qualityPick.id
    ) {
      summaryParts.push(
        `or choose **${everydayPick.name}** for the most balanced everyday fit`
      );
    }

    return {
      verdictsByPriority,
      priorityVerdictSummary: `${summaryParts.join('; ')}.`,
    };
  }

  /**
   * Compares 2 to 4 products deterministically, generating comparative indicators,
   * category-relevant matrices, fact vs claim separation, certification audits,
   * and priority-based verdicts.
   */
  public compareProducts(
    productIds: string[],
    targetUseCases?: string[]
  ):
    | { success: true; data: ComparisonResult }
    | { success: false; error: string; invalidIds?: string[] } {
    if (!Array.isArray(productIds) || productIds.length < 2) {
      return {
        success: false,
        error: 'Comparison requires at least 2 product IDs',
      };
    }

    if (productIds.length > 4) {
      return {
        success: false,
        error: 'Comparison supports a maximum of 4 products at once',
      };
    }

    // Deduplicate IDs
    const uniqueIds = Array.from(new Set(productIds));
    if (uniqueIds.length < 2) {
      return {
        success: false,
        error: 'At least 2 valid unique products are required for comparison',
      };
    }

    const products = this.productRepo.findByIds(uniqueIds);

    // Check for missing / invalid IDs
    const foundIds = new Set(products.map((p) => p.id));
    const invalidIds = uniqueIds.filter((id) => !foundIds.has(id));

    if (invalidIds.length > 0) {
      return {
        success: false,
        error: `Could not find product(s) with ID(s): ${invalidIds.join(', ')}`,
        invalidIds,
      };
    }

    if (products.length < 2) {
      return {
        success: false,
        error: 'At least 2 valid products must exist to generate a comparison',
      };
    }

    // Calculate indicators
    const sortedByPrice = [...products].sort((a, b) => a.price - b.price);
    const sortedByRating = [...products].sort((a, b) => b.rating - a.rating);
    const sortedByReviews = [...products].sort(
      (a, b) => b.review_count - a.review_count
    );

    const cheapest = sortedByPrice[0];
    const mostExpensive = sortedByPrice[sortedByPrice.length - 1];
    const priceSpread = mostExpensive.price - cheapest.price;

    // Strongest use case match (if requested use cases provided)
    let strongestUseCaseMatchId: string | undefined;
    if (targetUseCases && targetUseCases.length > 0) {
      let maxMatches = -1;
      for (const prod of products) {
        const prodUseCases = prod.use_cases.map((u) => u.toLowerCase());
        const count = targetUseCases.filter((req) =>
          prodUseCases.some((p) => p.includes(req.toLowerCase()))
        ).length;
        if (count > maxMatches) {
          maxMatches = count;
          strongestUseCaseMatchId = prod.id;
        }
      }
    }

    // Shared vs Unique features
    const allFeaturesSet = new Set<string>();
    products.forEach((p) => p.features.forEach((f) => allFeaturesSet.add(f)));

    const sharedFeatures: string[] = [];
    const uniqueFeatures: Record<string, string[]> = {};

    products.forEach((p) => {
      uniqueFeatures[p.id] = [];
    });

    allFeaturesSet.forEach((feat) => {
      const prodsWithFeat = products.filter((p) =>
        p.features.some((f) => f.toLowerCase() === feat.toLowerCase())
      );
      if (prodsWithFeat.length === products.length) {
        sharedFeatures.push(feat);
      } else if (prodsWithFeat.length === 1) {
        uniqueFeatures[prodsWithFeat[0].id].push(feat);
      }
    });

    // Specification Matrix (preserving backward compatibility while labelling missing values clearly)
    const allSpecKeys = new Set<string>();
    products.forEach((p) => {
      Object.keys(p.specifications).forEach((k) => allSpecKeys.add(k));
    });

    const specMatrix: SpecRow[] = Array.from(allSpecKeys)
      .sort()
      .map((key) => {
        const values: Record<string, string | number> = {};
        products.forEach((p) => {
          values[p.id] = p.specifications[key] ?? 'Not provided';
        });
        return { key, values };
      });

    // Phase 4 structured extensions
    const categoryGroup = this.classifyCategoryGroup(products);
    const certificationAudit: Record<string, ProductCertificationAudit> = {};
    for (const p of products) {
      certificationAudit[p.id] = this.auditProductCertifications(p);
    }

    const commonMatrix = this.buildCommonMatrix(products);
    const categorySpecificMatrix = this.buildCategorySpecificMatrix(
      products,
      categoryGroup,
      certificationAudit
    );
    const evidenceBreakdown = this.buildEvidenceBreakdown(
      products,
      certificationAudit
    );
    const { verdictsByPriority, priorityVerdictSummary } =
      this.buildVerdictsByPriority(products, certificationAudit, targetUseCases);

    return {
      success: true,
      data: {
        products,
        indicators: {
          cheapestProductId: cheapest.id,
          highestRatedProductId: sortedByRating[0].id,
          mostReviewedProductId: sortedByReviews[0].id,
          strongestUseCaseMatchId,
          priceSpread,
        },
        sharedFeatures,
        uniqueFeatures,
        specMatrix,
        categoryGroup,
        commonMatrix,
        categorySpecificMatrix,
        evidenceBreakdown,
        certificationAudit,
        verdictsByPriority,
        priorityVerdictSummary,
        comparisonScopeNote:
          'Product Feature Comparison evaluates specifications, verified facts, seller claims, and certifications. For cross-website store pricing (Amazon India, Flipkart, Croma, etc.), use Retailer Price Comparison.',
      },
    };
  }
}
