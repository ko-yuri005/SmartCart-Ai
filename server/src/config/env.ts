import dotenv from 'dotenv';
import path from 'path';

// Load .env from server directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const isTest = process.env.NODE_ENV === 'test';
const allowLiveGeminiInTests = process.env.ALLOW_LIVE_GEMINI_IN_TESTS === 'true';

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  GEMINI_API_KEY:
    isTest && !allowLiveGeminiInTests ? '' : process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  GEMINI_MAX_OUTPUT_TOKENS_EXTRACTION: parseInt(
    process.env.GEMINI_MAX_OUTPUT_TOKENS_EXTRACTION || '350',
    10
  ),
  GEMINI_MAX_OUTPUT_TOKENS_EXPLANATION: parseInt(
    process.env.GEMINI_MAX_OUTPUT_TOKENS_EXPLANATION || '600',
    10
  ),
  GEMINI_MAX_RETRIES: parseInt(process.env.GEMINI_MAX_RETRIES || '1', 10),
  GEMINI_DAILY_REQUEST_BUDGET: parseInt(
    process.env.GEMINI_DAILY_REQUEST_BUDGET || '500',
    10
  ),
  GEMINI_DAILY_TOKEN_BUDGET: parseInt(
    process.env.GEMINI_DAILY_TOKEN_BUDGET || '250000',
    10
  ),
  SESSION_THROTTLE_MS: parseInt(
    process.env.SESSION_THROTTLE_MS ?? (isTest ? '0' : '1000'),
    10
  ),
  DUPLICATE_SUBMIT_WINDOW_MS: parseInt(
    process.env.DUPLICATE_SUBMIT_WINDOW_MS ?? (isTest ? '0' : '3000'),
    10
  ),
  GEMINI_INPUT_COST_PER_1M_USD: parseFloat(
    process.env.GEMINI_INPUT_COST_PER_1M_USD || '0.15'
  ),
  GEMINI_OUTPUT_COST_PER_1M_USD: parseFloat(
    process.env.GEMINI_OUTPUT_COST_PER_1M_USD || '0.60'
  ),
  SERPAPI_API_KEY:
    isTest && !allowLiveGeminiInTests ? '' : process.env.SERPAPI_API_KEY || '',
  RAPIDAPI_PRODUCT_SEARCH_KEY:
    isTest && !allowLiveGeminiInTests
      ? ''
      : process.env.RAPIDAPI_PRODUCT_SEARCH_KEY || '',
  RAPIDAPI_PRODUCT_SEARCH_HOST:
    process.env.RAPIDAPI_PRODUCT_SEARCH_HOST ||
    'real-time-product-search.p.rapidapi.com',
  OFFER_CACHE_TTL_MS: parseInt(process.env.OFFER_CACHE_TTL_MS || '900000', 10),
  OFFER_REFRESH_COOLDOWN_MS: parseInt(
    process.env.OFFER_REFRESH_COOLDOWN_MS ?? (isTest ? '0' : '30000'),
    10
  ),
  OFFER_PROVIDER_TIMEOUT_MS: parseInt(
    process.env.OFFER_PROVIDER_TIMEOUT_MS || '5000',
    10
  ),
  OFFER_PROVIDER_MAX_RETRIES: parseInt(
    process.env.OFFER_PROVIDER_MAX_RETRIES || '1',
    10
  ),
  AFFILIATE_DISCLOSURE_TEXT:
    process.env.AFFILIATE_DISCLOSURE_TEXT ||
    'Prices and availability are verified only when explicitly marked as live or cached verified offers.',
  DATABASE_FILE: process.env.DATABASE_FILE || './data/shopping.sqlite',
  CORS_ALLOWED_ORIGINS: (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  ENABLE_DEMO_ADMIN:
    (process.env.NODE_ENV || 'development') === 'production'
      ? false
      : process.env.ENABLE_DEMO_ADMIN !== undefined
        ? process.env.ENABLE_DEMO_ADMIN === 'true'
        : true,
  ADMIN_BOOTSTRAP_USERNAME: process.env.ADMIN_BOOTSTRAP_USERNAME || 'admin',
  ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD || '',
  ADMIN_BOOTSTRAP_EMAIL:
    process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@minishopping.local',
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME || 'shp_session',
  SESSION_TTL_HOURS: parseInt(process.env.SESSION_TTL_HOURS || '168', 10),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: parseInt(
    process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || '5',
    10
  ),
  LOGIN_RATE_LIMIT_WINDOW_MS: parseInt(
    process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000',
    10
  ),
  NOTIFICATION_PROVIDER_CONFIGURED:
    process.env.NOTIFICATION_PROVIDER_CONFIGURED === 'true',
  PAYMENT_PROVIDER_CONFIGURED:
    process.env.PAYMENT_PROVIDER_CONFIGURED === 'true',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  isTest,
};


