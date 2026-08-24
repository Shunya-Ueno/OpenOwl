/** @throws RateLimitExceededError */
export interface RateLimiter {
  assertWithinLimit(userId: string): Promise<void>;

  /**
   * DeepSeek を実際に呼び出したことを記録する(削除不可能な台帳への書き込み)。
   * lookups はユーザーが削除できるため(docs/api-spec.md 4.2)、レート制限の
   * カウント元には使えない。呼び出しの成否に関わらず、provider.generate() が
   * 成功した直後に呼ぶ。
   */
  recordAttempt(userId: string, termId: string): Promise<void>;
}
