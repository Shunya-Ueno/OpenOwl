/** 統合テストの設定。必須値が欠けていれば即座に失敗させる(テストが黙って素通りするのを防ぐ)。 */
export class TestEnv {
  private constructor(
    readonly supabaseUrl: string,
    readonly publishableKey: string,
    readonly secretKey: string,
  ) {}

  static load(): TestEnv {
    const url = Deno.env.get('TEST_SUPABASE_URL');
    const publishableKey = Deno.env.get('TEST_SUPABASE_PUBLISHABLE_KEY');
    const secretKey = Deno.env.get('TEST_SUPABASE_SECRET_KEY');

    const missing = [
      ['TEST_SUPABASE_URL', url],
      ['TEST_SUPABASE_PUBLISHABLE_KEY', publishableKey],
      ['TEST_SUPABASE_SECRET_KEY', secretKey],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(
        `統合テストに必要な環境変数が未設定です: ${missing.join(', ')}\n` +
          'backend/.env.test.example を backend/.env.test にコピーして設定してください。',
      );
    }

    return new TestEnv(url!, publishableKey!, secretKey!);
  }

  functionUrl(name: string): string {
    return `${this.supabaseUrl}/functions/v1/${name}`;
  }
}
