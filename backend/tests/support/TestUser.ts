import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../supabase/functions/_shared/infrastructure/supabase/database.types.ts';
import type { TestEnv } from './TestEnv.ts';

/**
 * テスト専用のユーザー。作成と後片付けをこのクラスに閉じ込める。
 *
 * テスト用プロジェクトは複数のテスト・複数の実行で共有されるため、
 * 作ったユーザーは必ず片付ける(auth.users を消せば profiles と search_history は
 * on delete cascade で消える)。
 */
export class TestUser {
  private constructor(
    readonly id: string,
    readonly email: string,
    readonly accessToken: string,
    private readonly admin: SupabaseClient<Database>,
  ) {}

  /** 確認済みユーザーを作成し、サインインしてアクセストークンを得る。 */
  static async create(env: TestEnv): Promise<TestUser> {
    const admin = createClient<Database>(env.supabaseUrl, env.secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 実行ごとに一意にする。並行実行や前回の残骸との衝突を避けるため。
    const email = `e2e+${crypto.randomUUID()}@example.com`;
    const password = `Test-${crypto.randomUUID()}`;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // メール確認を挟まずにサインインできるようにする
    });
    if (createError || !created.user) {
      throw new Error(`テストユーザーの作成に失敗しました: ${createError?.message}`);
    }

    // アクセストークンは publishable key 側のクライアントで取得する
    // (Edge Function に渡すのは、あくまで一般ユーザーの JWT)。
    const anon = createClient<Database>(env.supabaseUrl, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: session, error: signInError } = await anon.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError || !session.session) {
      throw new Error(`テストユーザーのサインインに失敗しました: ${signInError?.message}`);
    }

    return new TestUser(created.user.id, email, session.session.access_token, admin);
  }

  /** このユーザーの JWT で動く(= RLS が適用される)クライアント。 */
  client(env: TestEnv): SupabaseClient<Database> {
    return createClient<Database>(env.supabaseUrl, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${this.accessToken}` } },
    });
  }

  async destroy(): Promise<void> {
    const { error } = await this.admin.auth.admin.deleteUser(this.id);
    if (error) {
      // 後片付けの失敗はテスト結果を隠さないよう、警告に留めて投げない。
      console.warn(`テストユーザーの削除に失敗しました (${this.id}): ${error.message}`);
    }
  }
}
