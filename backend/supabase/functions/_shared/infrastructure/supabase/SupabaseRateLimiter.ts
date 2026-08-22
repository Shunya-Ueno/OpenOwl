import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';
import type { RateLimiter } from '../../domain/ports/RateLimiter.ts';
import { RateLimitExceededError, InternalDomainError } from '../../domain/errors.ts';

const ONE_HOUR_MS = 60 * 60 * 1000;

/** docs/api-spec.md 3.3: DeepSeek を実際に呼んだ回数のみを数える。 */
export class SupabaseRateLimiter implements RateLimiter {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly limitPerHour: number,
  ) {}

  async assertWithinLimit(userId: string): Promise<void> {
    const since = new Date(Date.now() - ONE_HOUR_MS).toISOString();

    const { data: count, error } = await this.client.rpc('count_recent_generations', {
      p_user_id: userId,
      p_since: since,
    });

    if (error) {
      throw new InternalDomainError(`failed to check rate limit: ${error.message}`, error);
    }

    if ((count ?? 0) >= this.limitPerHour) {
      throw new RateLimitExceededError('hourly generation limit exceeded', ONE_HOUR_MS / 1000);
    }
  }
}
