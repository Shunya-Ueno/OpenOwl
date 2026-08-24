import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';
import type { RateLimiter } from '../../domain/ports/RateLimiter.ts';
import { InternalDomainError, RateLimitExceededError } from '../../domain/errors.ts';

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * docs/api-spec.md 3.3: DeepSeek を実際に呼んだ回数のみを数える。
 * カウント元は generation_attempts(削除不可能な台帳)であり、ユーザーが
 * 削除できる lookups には依存しない。
 */
export class SupabaseRateLimiter implements RateLimiter {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly limitPerHour: number,
  ) {}

  async assertWithinLimit(userId: string): Promise<void> {
    const since = new Date(Date.now() - ONE_HOUR_MS);
    const sinceIso = since.toISOString();

    const { data: count, error } = await this.client.rpc('count_recent_generations', {
      p_user_id: userId,
      p_since: sinceIso,
    });

    if (error) {
      throw new InternalDomainError(`failed to check rate limit: ${error.message}`, error);
    }

    if ((count ?? 0) >= this.limitPerHour) {
      const retryAfterSeconds = await this.computeRetryAfterSeconds(userId, since);
      throw new RateLimitExceededError('hourly generation limit exceeded', retryAfterSeconds);
    }
  }

  async recordAttempt(userId: string, termId: string): Promise<void> {
    const { error } = await this.client.rpc('record_generation_attempt', {
      p_user_id: userId,
      p_term_id: termId,
    });

    if (error) {
      throw new InternalDomainError(`failed to record generation attempt: ${error.message}`, error);
    }
  }

  /**
   * スライディングウィンドウ内で最も古い試行が窓の外に出る時刻までの秒数を返す。
   * 取得に失敗した場合のみウィンドウ幅そのもの(1時間)にフォールバックする。
   */
  private async computeRetryAfterSeconds(userId: string, since: Date): Promise<number> {
    const { data: oldest, error } = await this.client.rpc('oldest_generation_attempt_at', {
      p_user_id: userId,
      p_since: since.toISOString(),
    });

    if (error || !oldest) {
      return ONE_HOUR_MS / 1000;
    }

    const retryAtMs = new Date(oldest).getTime() + ONE_HOUR_MS;
    return Math.max(0, Math.round((retryAtMs - Date.now()) / 1000));
  }
}
