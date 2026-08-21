import { createClient } from '@supabase/supabase-js';
import { AppConfig } from '../_shared/config/AppConfig.ts';
import { StructuredLogger } from '../_shared/infrastructure/logging/StructuredLogger.ts';
import { SupabaseUserDeleter } from '../_shared/infrastructure/supabase/SupabaseUserDeleter.ts';
import { DeleteAccountUseCase } from '../_shared/application/DeleteAccountUseCase.ts';
import { CorsHandler } from '../_shared/http/CorsHandler.ts';
import { JwtAuthenticator } from '../_shared/http/JwtAuthenticator.ts';
import { ErrorResponseMapper } from '../_shared/http/ErrorResponseMapper.ts';
import { MethodNotAllowedError } from '../_shared/domain/error/AppError.ts';

// ─────────────────────────────────────────────────────────────
// 合成ルート: 依存関係の組み立てはここでのみ行う(DIコンテナは使わない)。
// generate-synonyms/index.ts と同じ構成に揃える。
// ─────────────────────────────────────────────────────────────
const config = AppConfig.fromEnv();
const logger = new StructuredLogger('delete-account');

// service_role: auth.admin.deleteUser は service_role のみが呼べる。
const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false },
});
// publishable key: ユーザーの JWT 検証専用(auth.getUser)。
const authClient = createClient(config.supabaseUrl, config.publishableKey, {
  auth: { persistSession: false },
});

const cors = new CorsHandler(config.corsAllowedOrigin);
const authenticator = new JwtAuthenticator(authClient);
const errorMapper = new ErrorResponseMapper(logger);

const useCase = new DeleteAccountUseCase(new SupabaseUserDeleter(adminClient), logger);

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

    // クライアントが送る user_id は一切受け付けない。削除対象は検証済みJWTからのみ確定する。
    const user = await authenticator.authenticate(request);

    await useCase.execute({ userId: user.id, requestId });

    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    return errorMapper.toResponse(error, requestId, corsHeaders);
  }
});
