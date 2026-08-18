/**
 * E2E 用のテストユーザーを「確認済み」の状態で作成する。
 *
 * サインアップの E2E を書かない理由(メール確認の受信箱操作が必要になる)は
 * docs/testing/e2e-strategy.md を参照。Maestro のフローはこのユーザーで
 * サインインするところから始める。
 *
 * 実行(backend/ から):
 *   npm run e2e:seed
 *
 * **冪等**: 既に同じメールアドレスのユーザーが存在する場合は何もしない。
 * パスワードを意図的に貼り替えたいときだけ E2E_SEED_FORCE_PASSWORD=1 を付ける
 * (無条件に貼り替えると、ローカルと CI で値が違う場合に交互に上書きし合い、
 *  どちらのサインインも壊れる)。
 */
import { TestEnv } from '../support/TestEnv.ts';

const email = Deno.env.get('E2E_USER_EMAIL');
const password = Deno.env.get('E2E_USER_PASSWORD');
const forcePassword = Deno.env.get('E2E_SEED_FORCE_PASSWORD') === '1';

// フォールバックを置かない。既定値に落ちると、seed が更新したアカウントと
// フローがサインインするアカウントが食い違い、無警告で E2E が壊れるため。
const missing = [
  ['E2E_USER_EMAIL', email],
  ['E2E_USER_PASSWORD', password],
].filter(([, value]) => !value).map(([name]) => name);

if (missing.length > 0) {
  console.error(
    `E2E ユーザーの作成に必要な環境変数が未設定です: ${missing.join(', ')}\n` +
      'backend/.env.test.example を backend/.env.test にコピーして設定してください。',
  );
  Deno.exit(1);
}

const env = TestEnv.load();
const admin = env.adminClient();

/**
 * メールアドレスからユーザーを探す。
 *
 * Admin API にメール検索がないため列挙するしかないが、`listUsers()` は既定で
 * 先頭ページ(50件)しか返さない。テスト用プロジェクトはテストごとの使い捨て
 * ユーザーで膨らむため、ページングしないと「存在するのに見つからない」状態になり、
 * その後の createUser が email_exists で落ちて週次ジョブが恒常的に赤くなる。
 */
async function findUserByEmail(targetEmail: string): Promise<{ id: string } | null> {
  const PER_PAGE = 200;
  const MAX_PAGES = 100; // 無限ループの保険(最大 20,000 件まで走査する)

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) {
      throw new Error(`ユーザーの列挙に失敗しました: ${error.message}`);
    }
    const found = data.users.find((user) => user.email === targetEmail);
    if (found) return { id: found.id };
    if (data.users.length < PER_PAGE) return null; // 最終ページまで見た
  }

  throw new Error(
    `ユーザーが ${MAX_PAGES * PER_PAGE} 件を超えています。テスト用プロジェクトの整理が必要です。`,
  );
}

const existing = await findUserByEmail(email!);

if (existing) {
  if (!forcePassword) {
    console.log(`E2E ユーザーは既に存在します (${email})。変更しません。`);
    Deno.exit(0);
  }
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password: password!,
    email_confirm: true,
  });
  if (error) {
    console.error(`E2E ユーザーの更新に失敗しました: ${error.message}`);
    Deno.exit(1);
  }
  console.log(`E2E ユーザーのパスワードを貼り替えました (${email})。`);
  Deno.exit(0);
}

const { error } = await admin.auth.admin.createUser({
  email: email!,
  password: password!,
  email_confirm: true,
});
if (error) {
  console.error(`E2E ユーザーの作成に失敗しました: ${error.message}`);
  Deno.exit(1);
}

console.log(`E2E ユーザーを作成しました (${email})。`);
