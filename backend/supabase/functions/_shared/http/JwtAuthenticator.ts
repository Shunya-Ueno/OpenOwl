import type { SupabaseClient } from '@supabase/supabase-js';
import { UnauthorizedError } from '../domain/error/AppError.ts';

export interface AuthenticatedUser {
  readonly id: string;
}

const BEARER_PREFIX = 'bearer ';

/**
 * Authorization ヘッダの JWT を検証し、ユーザーを確定する。
 *
 * **config.toml は verify_jwt = false**。ランタイム層の JWT 検証は Authorization を
 * 持たない CORS プリフライト(OPTIONS)まで 401 で弾いてしまうため無効にしてある
 * (docs/security.md)。したがって認証の防衛線はこのクラス1層であり、
 * 認証必須のエンドポイントでは必ずここを通すこと。
 * クライアントから送られた user_id は一切信用せず、必ずここで確定した ID のみを使うこと。
 */
export class JwtAuthenticator {
  constructor(private readonly client: SupabaseClient) {}

  async authenticate(request: Request): Promise<AuthenticatedUser> {
    const header = request.headers.get('authorization');
    if (!header || !header.toLowerCase().startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedError('missing or malformed Authorization header');
    }

    const token = header.slice(BEARER_PREFIX.length).trim();
    if (!token) {
      throw new UnauthorizedError('empty bearer token');
    }

    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedError('invalid or expired token', error ?? undefined);
    }

    return { id: data.user.id };
  }
}
