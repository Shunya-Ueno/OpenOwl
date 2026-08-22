import { z } from 'zod';

// docs/api-spec.md 3.1。未知フィールドは無視する(strict にしない)。
export const generateSynonymsRequestSchema = z.object({
  word: z.string(),
  language: z.string().optional().default('en'),
  maxResults: z.number().int().min(1).max(12).optional().default(8),
  forceRefresh: z.boolean().optional().default(false),
});

export type GenerateSynonymsRequestBody = z.infer<typeof generateSynonymsRequestSchema>;
