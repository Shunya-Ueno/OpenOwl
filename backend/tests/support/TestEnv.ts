import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../supabase/functions/_shared/infrastructure/supabase/database.types.ts';

/**
 * 統合テストの設定と、テストが使う Supabase クライアントの生成。
 *
 * クライアント生成をここに集約しているのは、同じオプションの createClient が
 * テスト側の各所に散ると、オプション変更(スキーマ指定・ヘッダ追加・キー方式の移行)の
 * 適用漏れが起きるため。特に週次でしか動かない seed スクリプトでの漏れは
 * 数日後のスケジュール実行で初めて表面化する。
 */
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

  /** RLS をバイパスする service role クライアント。テストデータの用意と後片付けに使う。 */
  adminClient(): SupabaseClient<Database> {
    return this.createTestClient(this.secretKey);
  }

  /**
   * 一般ユーザーとしてのクライアント。RLS が適用される。
   * accessToken を渡すとそのユーザーとして、渡さなければ anon として動く。
   */
  anonClient(accessToken?: string): SupabaseClient<Database> {
    return this.createTestClient(
      this.publishableKey,
      accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    );
  }

  functionUrl(name: string): string {
    return `${this.supabaseUrl}/functions/v1/${name}`;
  }

  private createTestClient(
    key: string,
    headers?: Record<string, string>,
  ): SupabaseClient<Database> {
    return createClient<Database>(this.supabaseUrl, key, {
      // テストプロセスにセッションを残さない。残すとテスト間で認証状態が漏れ、
      // RLS のテストが「実は通っていない」のに緑になりうる。
      auth: { persistSession: false, autoRefreshToken: false },
      ...(headers ? { global: { headers } } : {}),
    });
  }
}
