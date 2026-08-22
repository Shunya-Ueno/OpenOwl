import { z } from 'zod';

// DeepSeek の出力は必ず zod で検証してから使う(docs/security.md 3、docs/llm-integration.md 5.1)。
export const synonymItemSchema = z.object({
  text: z.string().min(1).max(64),
  partOfSpeech: z.enum(['noun', 'verb', 'adjective', 'adverb', 'other']).nullable().default(null),
  register: z.enum(['formal', 'neutral', 'informal']).nullable().default(null),
  nuance: z.string().max(200).nullable().default(null),
});

export const synonymResponseSchema = z.object({
  // リクエストの maxResults 上限は 12 だが、モデルがそれを僅かに超えて返すことは
  // ありうる(DeepSeekSynonymProvider が maxResults へ確実に切り詰める)。ここでの
  // 上限は「壊れた/暴走した応答」を弾くための緩い安全弁に留め、正常な超過分まで
  // 502 にしない(docs/llm-integration.md 5.1 のパース失敗時の扱いと矛盾しないように)。
  synonyms: z.array(synonymItemSchema).max(50),
});

export type SynonymResponsePayload = z.infer<typeof synonymResponseSchema>;
