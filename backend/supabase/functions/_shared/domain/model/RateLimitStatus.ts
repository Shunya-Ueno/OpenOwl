/** ユーザーの本日の利用量。 */
export class RateLimitStatus {
  constructor(
    readonly dailyLimit: number,
    readonly usedToday: number,
  ) {}

  get remainingToday(): number {
    return Math.max(0, this.dailyLimit - this.usedToday);
  }

  get exceeded(): boolean {
    return this.usedToday >= this.dailyLimit;
  }
}
