import { loadEnv } from '../_shared/infrastructure/config/Env.ts';
import { StructuredLogger } from '../_shared/infrastructure/logging/StructuredLogger.ts';
import { SupabaseClientFactory } from '../_shared/infrastructure/supabase/SupabaseClientFactory.ts';
import { SupabaseTermRepository } from '../_shared/infrastructure/supabase/SupabaseTermRepository.ts';
import { SupabaseSynonymGenerationRepository } from '../_shared/infrastructure/supabase/SupabaseSynonymGenerationRepository.ts';
import { SupabaseLookupRepository } from '../_shared/infrastructure/supabase/SupabaseLookupRepository.ts';
import { SupabaseRateLimiter } from '../_shared/infrastructure/supabase/SupabaseRateLimiter.ts';
import { DeepSeekClient } from '../_shared/infrastructure/deepseek/DeepSeekClient.ts';
import { SynonymPromptBuilder } from '../_shared/infrastructure/deepseek/SynonymPromptBuilder.ts';
import { DeepSeekSynonymProvider } from '../_shared/infrastructure/deepseek/DeepSeekSynonymProvider.ts';
import { GenerateSynonymsUseCase } from '../_shared/application/GenerateSynonymsUseCase.ts';
import { CorsPolicy } from '../_shared/interface/cors.ts';
import { jsonResponse } from '../_shared/interface/jsonResponse.ts';
import { JwtAuthenticator } from '../_shared/interface/JwtAuthenticator.ts';
import { generateSynonymsRequestSchema } from '../_shared/interface/RequestSchema.ts';
import { mapDomainErrorToHttp } from '../_shared/interface/HttpError.ts';
import { InvalidWordError } from '../_shared/domain/errors.ts';

// 合成ルート。ここでのみ Deno / Supabase SDK / fetch の具体的な組み立てを行う
// (docs/llm-integration.md 4章)。

const env = loadEnv();
const logger = new StructuredLogger('synonyms');
const cors = new CorsPolicy(env.ALLOWED_ORIGINS);

const clients = new SupabaseClientFactory(env);
const authClient = clients.createAuthClient();
const serviceRoleClient = clients.createServiceRoleClient();

const authenticator = new JwtAuthenticator(authClient);

const deepSeekClient = new DeepSeekClient(
  env.DEEPSEEK_API_KEY,
  env.DEEPSEEK_BASE_URL,
  env.DEEPSEEK_TIMEOUT_MS,
);
const provider = new DeepSeekSynonymProvider(
  deepSeekClient,
  new SynonymPromptBuilder(),
  env.DEEPSEEK_MODEL,
);

const useCase = new GenerateSynonymsUseCase(
  provider,
  new SupabaseTermRepository(serviceRoleClient),
  new SupabaseSynonymGenerationRepository(serviceRoleClient),
  new SupabaseLookupRepository(serviceRoleClient),
  new SupabaseRateLimiter(serviceRoleClient, env.RATE_LIMIT_PER_HOUR),
  logger,
  env.SYNONYM_CACHE_TTL_DAYS,
);

Deno.serve(async (request: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  const corsHeaders = cors.headersFor(request);

  if (request.method === 'OPTIONS') {
    return cors.preflightResponse(request);
  }
  if (request.method !== 'POST') {
    return jsonResponse(
      { error: { code: 'invalid_request', message: '許可されていないメソッドです。' } },
      405,
      corsHeaders,
    );
  }

  try {
    const userId = await authenticator.authenticate(request);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (error) {
      throw new InvalidWordError('request body must be valid JSON', error);
    }

    const parsed = generateSynonymsRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new InvalidWordError(`invalid request body: ${parsed.error.message}`, parsed.error);
    }

    const result = await useCase.execute({
      userId,
      word: parsed.data.word,
      language: parsed.data.language,
      maxResults: parsed.data.maxResults,
      forceRefresh: parsed.data.forceRefresh,
    });

    return jsonResponse(result, 200, corsHeaders);
  } catch (error) {
    const mapped = mapDomainErrorToHttp(error);

    if (mapped.status >= 500) {
      logger.error('synonyms.unhandled_error', {
        requestId,
        code: mapped.body.error.code,
        message: error instanceof Error ? error.message : 'unknown error',
      });
    }

    return jsonResponse(mapped.body, mapped.status, corsHeaders);
  }
});
