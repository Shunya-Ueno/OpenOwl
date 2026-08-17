import type { SupabaseClient } from '@supabase/supabase-js';
import { UnauthorizedError } from '../domain/error/AppError.ts';

export interface AuthenticatedUser {
  readonly id: string;
}

const BEARER_PREFIX = 'bearer ';

/**
 * Authorization ヘッダの JWT を検証し、ユーザーを確定する。
 *
 * config.toml の verify_jwt = true とあわせた多層防御。
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
