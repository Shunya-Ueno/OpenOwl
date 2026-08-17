import type { RateLimitStatus } from '../model/RateLimitStatus.ts';

/**
 * 利用量制御の抽象。制限方式(DB集計 → 他基盤)を差し替える理由がある箇所にのみ存在する。
 */
export interface RateLimiter {
  /** @throws RateLimitError 上限(毎分バースト or 1日の上限)を超過した場合 */
  check(userId: string): Promise<RateLimitStatus>;
}
