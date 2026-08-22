/** @throws RateLimitExceededError */
export interface RateLimiter {
  assertWithinLimit(userId: string): Promise<void>;
}
