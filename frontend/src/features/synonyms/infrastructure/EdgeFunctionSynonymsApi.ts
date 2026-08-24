import { z } from 'zod';
import { supabase } from '../../../shared/supabase/client';
import { env } from '../../../shared/config/env';
import { ApiError } from '../../../shared/api/ApiError';
import { parseErrorResponse } from '../../../shared/api/parseErrorResponse';
import type { SynonymResult } from '../domain/SynonymResult';
import type { SynonymsApi, GenerateSynonymsInput } from './SynonymsApi';

// サーバーの DeepSeek タイムアウト(20秒)より長く取る。短くすると、
// サーバーが縮退応答を返そうとしている最中に切ってしまう
// (docs/frontend-design.md 6.1)。
const CLIENT_TIMEOUT_MS = 30_000;

// docs/api-spec.md 3.2 のレスポンス形状。外部入力なので zod で検証してから使う。
const synonymResultSchema = z.object({
  term: z.object({
    id: z.string(),
    text: z.string(),
    language: z.string(),
  }),
  generation: z.object({
    id: z.string().nullable(),
    model: z.string(),
    createdAt: z.string(),
    cached: z.boolean(),
    stale: z.boolean(),
  }),
  synonyms: z.array(
    z.object({
      text: z.string(),
      partOfSpeech: z.enum(['noun', 'verb', 'adjective', 'adverb', 'other']).nullable(),
      register: z.enum(['formal', 'neutral', 'informal']).nullable(),
      nuance: z.string().nullable(),
    }),
  ),
});

/**
 * ADR-0011: functions.invoke ではなく fetch を使う。エラー本文の code と
 * Retry-After ヘッダを直接扱うため。
 */
export class EdgeFunctionSynonymsApi implements SynonymsApi {
  async generate(input: GenerateSynonymsInput): Promise<SynonymResult> {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new ApiError('unauthorized', '認証が必要です。再度ログインしてください。');
    }

    // AbortSignal.timeout() はブラウザにはあるが、React Native の AbortSignal は
    // `abort-controller` パッケージのポリフィルで static timeout を持たない。
    // AbortController + setTimeout で両プラットフォーム共通に実装する。
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/synonyms`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          word: input.word,
          ...(input.maxResults !== undefined ? { maxResults: input.maxResults } : {}),
          ...(input.forceRefresh !== undefined ? { forceRefresh: input.forceRefresh } : {}),
        }),
        signal: controller.signal,
      });
    } catch {
      // abort() 由来か、それ以外(オフライン等)かを区別する。
      if (controller.signal.aborted) {
        throw new ApiError('upstream_timeout', '時間がかかっています。もう一度お試しください。');
      }
      throw new ApiError('network_error', 'オフラインのようです。接続を確認してください。');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    const json: unknown = await response.json();
    const parsed = synonymResultSchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError('internal_error', '結果を取得できませんでした。もう一度お試しください。');
    }

    return parsed.data;
  }
}

export const synonymsApi: SynonymsApi = new EdgeFunctionSynonymsApi();
