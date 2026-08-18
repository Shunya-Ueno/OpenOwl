/**
 * E2E 用のテストユーザーを「確認済み」の状態で作成する。
 *
 * サインアップの E2E を書かない理由(メール確認の受信箱操作が必要になる)は
 * docs/testing/e2e-strategy.md を参照。Maestro のフローはこのユーザーで
 * サインインするところから始める。
 *
 * 実行:
 *   deno run --allow-env --allow-net --env-file=.env.test tests/scripts/seed-e2e-user.ts
 *
 * 既に同じメールアドレスのユーザーが存在する場合は何もしない(再実行しても安全)。
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../supabase/functions/_shared/infrastructure/supabase/database.types.ts';
import { TestEnv } from '../support/TestEnv.ts';

const E2E_EMAIL = Deno.env.get('E2E_USER_EMAIL') ?? 'e2e-fixed@example.com';
const E2E_PASSWORD = Deno.env.get('E2E_USER_PASSWORD');

if (!E2E_PASSWORD) {
  console.error(
    'E2E_USER_PASSWORD が未設定です。8文字以上のパスワードを環境変数で渡してください。',
  );
  Deno.exit(1);
}

const env = TestEnv.load();
const admin = createClient<Database>(env.supabaseUrl, env.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existing } = await admin.auth.admin.listUsers();
const found = existing?.users.find((user) => user.email === E2E_EMAIL);

if (found) {
  // パスワードだけ揃えておく(前回と違う値が渡された場合に備える)。
  const { error } = await admin.auth.admin.updateUserById(found.id, {
    password: E2E_PASSWORD,
    email_confirm: true,
  });
  if (error) {
    console.error(`既存の E2E ユーザーの更新に失敗しました: ${error.message}`);
    Deno.exit(1);
  }
  console.log(`E2E ユーザーは既に存在します (${E2E_EMAIL})。パスワードを更新しました。`);
  Deno.exit(0);
}

const { error } = await admin.auth.admin.createUser({
  email: E2E_EMAIL,
  password: E2E_PASSWORD,
  email_confirm: true,
});
if (error) {
  console.error(`E2E ユーザーの作成に失敗しました: ${error.message}`);
  Deno.exit(1);
}

console.log(`E2E ユーザーを作成しました (${E2E_EMAIL})。`);
