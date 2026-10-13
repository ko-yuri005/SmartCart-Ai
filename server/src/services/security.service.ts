import { CONFIDENTIALITY_REFUSAL_MESSAGE, ProbeCategory } from '../config/security.config.js';

export interface SecurityCheckResult {
  isProbe: boolean;
  category?: ProbeCategory;
  reason?: string;
}

export class SecurityService {
  /**
   * High-confidence regular expressions targeting requests for confidential/internal information.
   * Each regex is specifically tailored to match attacks and probes directed at the assistant/system,
   * without capturing legitimate consumer electronics product queries.
   */
  private static readonly PROBE_PATTERNS: { category: ProbeCategory; regex: RegExp }[] = [
    // 1. System Prompt & Instructions
    {
      category: 'SYSTEM_PROMPT',
      regex: /\bsystem\s+(?:prompt|instructions?|message)\b/i,
    },
    {
      category: 'HIDDEN_INSTRUCTIONS',
      regex: /\bhidden\s+(?:initial\s+|original\s+|system\s+)?(?:instructions?|prompts?|rules?|directives?|policies)\b/i,
    },
    {
      category: 'HIDDEN_INSTRUCTIONS',
      regex: /\b(?:secret|confidential)\s+(?:rules?|instructions?|prompts?|directives?|policies)\b/i,
    },
    {
      category: 'DEVELOPER_INSTRUCTIONS',
      regex: /(?:\bdeveloper\s+(?:instructions?|prompts?|rules?|directives?|mode)\b|act\s+as\s+(?:the\s+)?developer)/i,
    },
    {
      category: 'HIDDEN_INSTRUCTIONS',
      regex: /\binternal\s+(?:prompts?|instructions?|rules?|directives?|policies)\b/i,
    },
    {
      category: 'DEVELOPER_INSTRUCTIONS',
      regex: /ignore\s+(?:all\s+)?(?:previous|prior|above|your)\s+(?:instructions|restrictions|rules|directives)/i,
    },
    {
      category: 'HIDDEN_INSTRUCTIONS',
      regex: /(?:what|how)\s+(?:are\s+you|were\s+you)\s+(?:instructed|told|configured|programmed)\s+to/i,
    },
    {
      category: 'SYSTEM_PROMPT',
      regex: /(?:what\s+(?:is|was)\s+(?:your|the)\s+original\s+prompt|repeat\s+(?:all\s+)?(?:text|words)\s+above|\bbeginning\s+of\s+(?:the|your)\s+prompt\b)/i,
    },
    {
      category: 'SYSTEM_PROMPT',
      regex: /(?:encode|convert|translate|summarize)\s+(?:your\s+)?(?:system\s+(?:prompt|message|instructions?)|(?:hidden|initial)\s+instructions?)/i,
    },

    // 2. API Keys, Passwords & Credentials
    {
      category: 'API_KEYS',
      regex: /\b(?:api[_\s-]?key|secret[_\s-]?key|auth[_\s-]?token)\b/i,
    },
    {
      category: 'CREDENTIALS',
      regex:
        /(?:show|tell|give|reveal|print|what\s+(?:is|are))\s+(?:me\s+)?(?:the\s+)?(?:your\s+)?(?:admin\s+|server\s+)?(?:credentials?|passwords?|secret\s+keys?)/i,
    },
    {
      category: 'PASSWORDS',
      regex: /\b(?:admin\s+password|database\s+password|db\s+password|root\s+password)\b/i,
    },

    // 3. Source Code & Codebase
    {
      category: 'SOURCE_CODE',
      regex: /\b(?:source[_\s-]?code|codebase)\b/i,
    },
    {
      category: 'SOURCE_CODE',
      regex:
        /(?:show|reveal|give|display|print|share|what\s+is)\s+(?:me\s+)?(?:the\s+)?(?:your\s+)?(?:backend\s+code|github\s+repo(?:sitory)?|express\s+code|(?:source\s+)?code\b)/i,
    },
    {
      category: 'SOURCE_CODE',
      regex: /(?:show|reveal|see|give)\s+(?:me\s+)?(?:how\s+you\s+are\s+coded|the\s+code\s+(?:behind|for|responsible\s+for|that\s+(?:ranks?|filters?|scores?))\b)/i,
    },
    {
      category: 'SOURCE_CODE',
      regex: /\bcode\s+(?:responsible\s+for|behind|implementing)\s+(?:ranking|filtering|recommendations?)\b/i,
    },

    // 4. Environment Variables
    {
      category: 'ENVIRONMENT_VARIABLES',
      regex: /(?:\benvironment\s+variables?\b|\benv\s+vars?\b|\.env\b|process\.env)/i,
    },

    // 5. Database Credentials & Internals
    {
      category: 'DATABASE_CREDENTIALS',
      regex:
        /(?:database|sqlite|db|sql)\s+(?:credentials?|passwords?|connection\s+string|user(?:name)?|internals?)/i,
    },
    {
      category: 'DATABASE_CREDENTIALS',
      regex: /\b(?:database\s+credentials|db\s+credentials|database\s+password|db\s+password)\b/i,
    },

    // 6. Internal Architecture & Private Implementation
    {
      category: 'INTERNAL_ARCHITECTURE',
      regex: /\b(?:internal\s+architecture|private\s+architecture|internal\s+infrastructure)\b/i,
    },
    {
      category: 'PRIVATE_IMPLEMENTATION',
      regex:
        /\b(?:internal\s+implementation|private\s+implementation|proprietary\s+project\s+information)\b/i,
    },
    {
      category: 'INTERNAL_ARCHITECTURE',
      regex: /(?:how\s+is\s+this\s+(?:assistant|project)\s+built\s+internally|reveal\s+(?:your\s+)?internal\s+(?:architecture|project\s+details))/i,
    },

    // 7. Security Mechanisms & Guardrails
    {
      category: 'SECURITY_MECHANISMS',
      regex:
        /(?:what\s+are|show|reveal|describe|tell)\s+(?:me\s+)?(?:your\s+|the\s+)?(?:internal\s+)?(?:security\s+mechanisms?|guardrails?|confidentiality\s+rules?)/i,
    },
    {
      category: 'SECURITY_MECHANISMS',
      regex: /\bconfidentiality\s+rules?\b/i,
    },
    {
      category: 'SECURITY_MECHANISMS',
      regex: /(?:how\s+to\s+)?(?:bypass|circumvent|break)\s+(?:your\s+|the\s+)?(?:guardrails?|security\s+mechanisms?|confidentiality\s+rules?)/i,
    },

    // 8. Model Configuration & Hidden Policies
    {
      category: 'MODEL_CONFIGURATION',
      regex:
        /\b(?:model\s+configuration|hidden\s+model\s+instructions?|internal\s+temperature(?:\s+setting)?)\b/i,
    },
  ];

  /**
   * Patterns indicating legitimate shopping queries asking about product specifications,
   * security features of phones/laptops, safety of chargers, helmets, cookware, skincare, water ratings, etc.
   */
  private static readonly PRODUCT_CONTEXT_EXEMPTIONS: RegExp[] = [
    /\b(?:phone|mobile|laptop|smartwatch|watch|charger|power\s*bank|earbuds?|headphones?|device|hardware|battery|helmet|helmets|bike|bikes|motorcycle|motorcycles|scooter|cooker|pressure\s*cooker|pan|pot|skincare|sunscreen|cream|lotion|shoes?|clothes?|hoodie|apparel|furniture|chair|table|desk|bottle|toy|fabric|cosmetics?)\b/i,
    /\b(?:ip6[78]|ip5[45]|ipx[4578]|knox|fingerprint|face\s*unlock|passcode|encryption|safe\s+for|safe\s+to|surge\s+protection|overheat|isi|dot|ece|abs|disc\s*brakes?|food[- ]grade|bpa[- ]free|non[- ]toxic|teflon[- ]free|spf|dermatologically|irritation|allerg(?:y|ies|ic)|child[- ]safe|baby[- ]safe|ergonomic)\b/i,
  ];

  /**
   * Evaluates user input for confidentiality probes.
   * Returns exact refusal if detected, otherwise passes through.
   */
  public isConfidentialityProbe(userQuery: string): SecurityCheckResult {
    if (!userQuery || typeof userQuery !== 'string') {
      return { isProbe: false };
    }

    const trimmed = userQuery.trim();
    if (trimmed.length === 0) {
      return { isProbe: false };
    }

    // Check each probe pattern
    for (const pattern of SecurityService.PROBE_PATTERNS) {
      if (pattern.regex.test(trimmed)) {
        // High confidence probe matched: verify whether it is an ordinary product question
        const isProductQuery = this.isOrdinaryProductSecurityQuestion(trimmed);
        if (isProductQuery) {
          continue; // Pass through ordinary product questions
        }

        return {
          isProbe: true,
          category: pattern.category,
          reason: `Query matched protected topic: ${pattern.category}`,
        };
      }
    }

    return { isProbe: false };
  }

  /**
   * Distinguishes ordinary shopping questions from assistant security probes.
   * Examples of legitimate questions:
   * - "What's the best security feature on this phone?"
   * - "Is this laptop secure?"
   * - "Does this smartwatch support encryption?"
   * - "What does IP68 mean?"
   * - "Is this charger safe?"
   * - "Which phone has better privacy features?"
   * - "Is this helmet safe?"
   * - "Does this sunscreen cause irritation?"
   */
  private isOrdinaryProductSecurityQuestion(query: string): boolean {
    const q = query.toLowerCase();

    // If query explicitly asks for system prompt, source code, API keys, env vars, or DB credentials,
    // it is strictly NEVER an ordinary shopping question!
    if (
      q.includes('system prompt') ||
      q.includes('system message') ||
      q.includes('system instruction') ||
      q.includes('api key') ||
      q.includes('api_key') ||
      q.includes('source code') ||
      q.includes('codebase') ||
      q.includes('environment variable') ||
      q.includes('.env') ||
      q.includes('process.env') ||
      q.includes('database credential') ||
      q.includes('db password') ||
      q.includes('hidden instruction') ||
      q.includes('developer instruction') ||
      q.includes('act as the developer') ||
      q.includes('internal architecture') ||
      q.includes('model configuration') ||
      q.includes('confidentiality rule') ||
      q.includes('secret key') ||
      q.includes('auth token') ||
      q.includes('ignore your restrictions') ||
      q.includes('ignore instructions')
    ) {
      return false;
    }

    // Check for legitimate product context
    const hasProductContext = SecurityService.PRODUCT_CONTEXT_EXEMPTIONS.some((pattern) =>
      pattern.test(q)
    );

    // Common shopping security/safety questions
    if (
      hasProductContext &&
      (q.includes('security feature') ||
        q.includes('is this') ||
        q.includes('is it safe') ||
        q.includes('safe') ||
        q.includes('safety') ||
        q.includes('privacy feature') ||
        q.includes('safe to use') ||
        q.includes('safe for') ||
        q.includes('waterproof') ||
        q.includes('encryption') ||
        q.includes('irritation') ||
        q.includes('cause'))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Returns the exact mandatory refusal sentence.
   */
  public getRefusalMessage(): string {
    return CONFIDENTIALITY_REFUSAL_MESSAGE;
  }

  /**
   * Post-generation safety sanitizer (Defense-in-depth).
   * If any protected internal information leak or credential format is detected
   * in generated text, replaces the entire response with the exact refusal message.
   */
  public sanitizeOutput(generatedText: string): string {
    if (!generatedText) return generatedText;

    // Signatures of internal leaks:
    const leakSignatures: RegExp[] = [
      /AIzaSy[A-Za-z0-9_-]{10,}/, // Google API key format
      /process\.env\./,
      /GEMINI_API_KEY/i,
      /DATABASE_FILE/i,
      /SqliteProductRepository/i,
      /SqliteSessionRepository/i,
      /DEFAULT_RANKING_CONFIG/i,
      /CONFIDENTIALITY_REFUSAL_MESSAGE/i,
      /BEGIN PRIVATE KEY/,
      /I am a large language model trained by Google/,
    ];

    for (const sig of leakSignatures) {
      if (sig.test(generatedText)) {
        return CONFIDENTIALITY_REFUSAL_MESSAGE;
      }
    }

    return generatedText;
  }
}
