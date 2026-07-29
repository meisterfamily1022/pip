import { z } from 'zod';

export const AI_SCHEMA_VERSION = '1.1';
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_NAME_LENGTH = 80;
export const MAX_CATEGORIES = 10;

export const categories = [
  'quiet', 'active', 'creative', 'building', 'pretend',
  'sensory', 'independent', 'together', 'indoor', 'outdoor',
] as const;

export const warningCodes = [
  'image_unclear',
  'multiple_toys_detected',
  'toy_not_identified',
  'adult_review_recommended',
] as const;

const mockReferences = [
  'clear_toy',
  'unclear_image',
  'multiple_toys',
  'unidentified_toy',
  'malformed_response',
  'provider_timeout',
  'provider_unavailable',
] as const;

const safeText = new RegExp(`^[^\\u0000-\\u001F\\u007F<>]{1,${MAX_NAME_LENGTH}}$`);

export const toyAnalysisRequestSchema = z.object({
  installationToken: z.string().regex(/^inst_[A-Za-z0-9_-]{16,128}$/),
  image: z.object({
    mediaType: z.enum(['image/jpeg', 'image/png']),
    byteLength: z.number().int().positive().max(MAX_IMAGE_BYTES),
    // Temporary Stage 1 fixture only. Production must accept validated image bytes/upload handles.
    mockReference: z.enum(mockReferences).optional(),
  }).strict(),
  requestId: z.string().uuid().optional(),
  clientVersion: z.string().trim().min(1).max(32).optional(),
}).strict();

export const providerResponseSchema = z.object({
  suggestedName: z.string().regex(safeText).nullable(),
  suggestedCategories: z.array(z.enum(categories)).max(MAX_CATEGORIES),
  suggestedCleanupDifficulty: z.enum(['easy', 'medium', 'big']).nullable(),
  suggestedAdultHelpRequired: z.boolean().nullable(),
  confidence: z.enum(['low', 'medium', 'high']),
  warnings: z.array(z.enum(warningCodes)).max(warningCodes.length),
}).strict();

export const toyAnalysisResponseSchema = providerResponseSchema.extend({
  requestId: z.string().uuid(),
}).strict();

export type ToyAnalysisRequest = z.infer<typeof toyAnalysisRequestSchema>;
export type ProviderResponse = z.infer<typeof providerResponseSchema>;
export type ToyAnalysisResponse = z.infer<typeof toyAnalysisResponseSchema>;
export type ToyAnalysisCategory = (typeof categories)[number];
export type WarningCode = (typeof warningCodes)[number];
