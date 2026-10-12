/**
 * Security & Confidentiality constants
 * Hard requirement: If user asks for confidential internal info,
 * respond EXACTLY: "I am not allowed to say that."
 */

export const CONFIDENTIALITY_REFUSAL_MESSAGE = 'I am not allowed to say that.';

export const PROBE_CATEGORIES = [
  'SYSTEM_PROMPT',
  'HIDDEN_INSTRUCTIONS',
  'DEVELOPER_INSTRUCTIONS',
  'SOURCE_CODE',
  'API_KEYS',
  'CREDENTIALS',
  'PASSWORDS',
  'ENVIRONMENT_VARIABLES',
  'DATABASE_CREDENTIALS',
  'INTERNAL_ARCHITECTURE',
  'PRIVATE_IMPLEMENTATION',
  'SECURITY_MECHANISMS',
  'MODEL_CONFIGURATION',
  'PROPRIETARY_INFO',
] as const;

export type ProbeCategory = (typeof PROBE_CATEGORIES)[number];
