import { createClient } from '@supabase/supabase-js';
import type { Database } from '../_shared/infrastructure/supabase/database.types.ts';
import { AppConfig } from '../_shared/config/AppConfig.ts';
import { StructuredLogger } from '../_shared/infrastructure/logging/StructuredLogger.ts';
import { GeminiHttpClient } from '../_shared/infrastructure/gemini/GeminiHttpClient.ts';
import { SynonymPrompt } from '../_shared/infrastructure/gemini/SynonymPrompt.ts';
import { GeminiSynonymGenerator } from '../_shared/infrastructure/gemini/GeminiSynonymGenerator.ts';
import { SupabaseSynonymRepository } from '../_shared/infrastructure/supabase/SupabaseSynonymRepository.ts';
import { SearchHistoryRateLimiter } from '../_shared/infrastructure/supabase/SearchHistoryRateLimiter.ts';
import { GenerateSynonymsUseCase } from '../_shared/application/GenerateSynonymsUseCase.ts';
import { CorsHandler } from '../_shared/http/CorsHandler.ts';
import { JwtAuthenticator } from '../_shared/http/JwtAuthenticator.ts';
import { JsonRequestParser } from '../_shared/http/JsonRequestParser.ts';
import { ErrorResponseMapper } from '../_shared/http/ErrorResponseMapper.ts';
import { MethodNotAllowedError } from '../_shared/domain/error/AppError.ts';

// ─────────────────────────────────────────────────────────────
// 合成ルート: 依存関係の組み立てはここでのみ行う(DIコンテナは使わない)。
// モジュールスコープで1度だけ生成し、ウォームなインスタンス間で再利用する
// (コールドスタート削減)。設定は起動時に検証され、欠落は即座に失敗する。
// ─────────────────────────────────────────────────────────────
const config = AppConfig.fromEnv();
const logger = new StructuredLogger('generate-synonyms');

// service_role: RLS を経由せず書き込む(レート制限・キャッシュ判定を必ずこの Function 経由にするため)。
const adminClient = createClient<Database>(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false },
});
// publishable key: ユーザーの JWT 検証専用(auth.getUser)。
const authClient = createClient(config.supabaseUrl, config.publishableKey, {
  auth: { persistSession: false },
});

const cors = new CorsHandler(config.corsAllowedOrigin);
const authenticator = new JwtAuthenticator(authClient);
const requestParser = new JsonRequestParser();
const errorMapper = new ErrorResponseMapper(logger);

const useCase = new GenerateSynonymsUseCase(
  new SupabaseSynonymRepository(adminClient),
  new GeminiSynonymGenerator(
    new GeminiHttpClient(config.geminiApiKey, config.geminiTimeoutMs),
    new SynonymPrompt(),
    config.geminiModel,
  ),
  new SearchHistoryRateLimiter(adminClient, config.rateLimitPerDay, config.rateLimitPerMinute),
  logger,
  config.cacheTtlDays,
);

Deno.serve(async (request: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  const corsHeaders = cors.headers();

  try {
    if (request.method === 'OPTIONS') {
      return cors.preflightResponse();
    }
    if (request.method !== 'POST') {
      throw new MethodNotAllowedError(`method not allowed: ${request.method}`);
    }

    // クライアントが送る user_id は一切受け付けない。ユーザーは検証済みJWTからのみ確定する。
    const user = await authenticator.authenticate(request);
    const body = await requestParser.parse(request);

    const result = await useCase.execute({
      userId: user.id,
      rawWord: body.word,
      language: body.language,
      requestId,
    });

    return new Response(
      JSON.stringify({
        requestId,
        word: {
          id: result.generation.word.id,
          text: result.generation.word.text,
          language: result.generation.word.language,
        },
        source: result.source,
        generationId: result.generation.id,
        generatedAt: result.generation.generatedAt.toISOString(),
        synonyms: result.generation.synonyms.map((synonym) => ({
          id: synonym.id,
          sortOrder: synonym.sortOrder,
          term: synonym.term,
          partOfSpeech: synonym.partOfSpeech,
          definition: synonym.definition,
          nuance: synonym.nuance,
        })),
        usage: {
          dailyLimit: result.dailyLimit,
          remainingToday: result.remainingToday,
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json', ...corsHeaders },
      },
    );
  } catch (error) {
    return errorMapper.toResponse(error, requestId, corsHeaders);
  }
});
