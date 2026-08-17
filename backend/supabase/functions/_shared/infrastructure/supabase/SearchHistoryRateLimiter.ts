import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';
import type { RateLimiter } from '../../domain/port/RateLimiter.ts';
import { RateLimitStatus } from '../../domain/model/RateLimitStatus.ts';
import { RateLimitError, InternalError } from '../../domain/error/AppError.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * search_history の行数から利用量を数える RateLimiter 実装。
 *
 * 2種類の制限を課す:
 *   - 毎分バースト制御: 直近1分間に記録された行(生成・キャッシュ・失敗すべて)
 *   - 1日の生成上限: 直近24時間で LLM を実際に呼んだ行(生成成功 + 失敗)のみ
 *
 * 注意: LLM に到達する前の失敗(入力検証・レート制限そのもの)は search_history に
 * 記録されないため、毎分バースト制御は厳密な「全リクエスト数」ではなく
 * 「search_history に到達したリクエスト数」の近似値になる。専用の集計テーブルを
 * 新設するほどの精度は MVP では不要と判断した(YAGNI)。
 */
export class SearchHistoryRateLimiter implements RateLimiter {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly dailyLimit: number,
    private readonly perMinuteLimit: number,
  ) {}

  async check(userId: string): Promise<RateLimitStatus> {
    await this.checkBurstLimit(userId);
    return this.checkDailyLimit(userId);
  }

  private async checkBurstLimit(userId: string): Promise<void> {
    const since = new Date(Date.now() - MINUTE_MS).toISOString();

    const { count, error } = await this.client
      .from('search_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since);

    if (error) {
      throw new InternalError(`failed to check burst rate limit: ${error.message}`, error);
    }
    if ((count ?? 0) >= this.perMinuteLimit) {
      throw new RateLimitError('per-minute request limit exceeded', 60);
    }
  }

  private async checkDailyLimit(userId: string): Promise<RateLimitStatus> {
    const since = new Date(Date.now() - DAY_MS).toISOString();

    const { count, error } = await this.client
      .from('search_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('outcome', ['generated', 'failed'])
      .gte('created_at', since);

    if (error) {
      throw new InternalError(`failed to check daily rate limit: ${error.message}`, error);
    }

    const status = new RateLimitStatus(this.dailyLimit, count ?? 0);
    if (status.exceeded) {
      const retryAfterSeconds = await this.secondsUntilOldestExpires(userId, since);
      throw new RateLimitError('daily generation limit exceeded', retryAfterSeconds);
    }
    return status;
  }

  private async secondsUntilOldestExpires(userId: string, since: string): Promise<number> {
    const { data, error } = await this.client
      .from('search_history')
      .select('created_at')
      .eq('user_id', userId)
      .in('outcome', ['generated', 'failed'])
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return Math.round(DAY_MS / 1000);

    const retryAtMs = new Date(data.created_at).getTime() + DAY_MS;
    return Math.max(0, Math.round((retryAtMs - Date.now()) / 1000));
  }
}
