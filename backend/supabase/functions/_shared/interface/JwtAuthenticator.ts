import type { SupabaseClient } from '@supabase/supabase-js';
import { UnauthorizedError } from '../domain/errors.ts';

const BEARER_PREFIX = 'bearer ';

/**
 * リクエストの Authorization ヘッダから user_id をサーバー側で決定する。
 * リクエストボディの userId は一切信用しない(docs/security.md 冒頭の原則)。
 */
export class JwtAuthenticator {
  constructor(private readonly authClient: SupabaseClient) {}

  async authenticate(request: Request): Promise<string> {
    const header = request.headers.get('authorization');
    if (!header || !header.toLowerCase().startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedError('missing or malformed Authorization header');
    }

    const token = header.slice(BEARER_PREFIX.length).trim();
    if (!token) {
      throw new UnauthorizedError('empty bearer token');
    }

    const { data, error } = await this.authClient.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedError('invalid or expired token', error ?? undefined);
    }

    return data.user.id;
  }
}
