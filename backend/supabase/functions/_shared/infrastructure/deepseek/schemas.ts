import { z } from 'zod';

// DeepSeek の出力は必ず zod で検証してから使う(docs/security.md 3、docs/llm-integration.md 5.1)。
export const synonymItemSchema = z.object({
  text: z.string().min(1).max(64),
  partOfSpeech: z.enum(['noun', 'verb', 'adjective', 'adverb', 'other']).nullable().default(null),
  register: z.enum(['formal', 'neutral', 'informal']).nullable().default(null),
  nuance: z.string().max(200).nullable().default(null),
});

export const synonymResponseSchema = z.object({
  synonyms: z.array(synonymItemSchema).max(12),
});

export type SynonymResponsePayload = z.infer<typeof synonymResponseSchema>;
