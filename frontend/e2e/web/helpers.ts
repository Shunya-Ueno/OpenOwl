import { expect, type Page } from '@playwright/test';
import { testIds } from '../../src/shared/testIds';
import { e2eEnv, isSynonymsFunctionCall } from '../env';

/**
 * E2E の共通操作。
 *
 * サインインは毎回「実際のログイン画面から」行う。storageState を使い回さないのは、
 * サインアウトのスペックが refresh token を失効させる(supabase-js の signOut は
 * 既定でグローバル)ため、保存済みセッションが他のスペックの途中で無効になりうるから。
 * 直列実行(workers: 1)なので、毎回サインインしても数秒しか増えない。
 */
/**
 * 生成完了を待つ上限。
 *
 * サーバー側の DeepSeek タイムアウトは既定 20 秒(DEEPSEEK_TIMEOUT_MS)で、
 * さらにリトライが最大 1 回入りうる。Playwright の既定 expect タイムアウト
 * (15 秒)ではサーバーが正常に応答しきる前に諦めてしまうため、ここだけ広げる。
 *
 * 注意: test.slow() は**テスト全体**のタイムアウトを伸ばすだけで、
 * expect の既定タイムアウトには効かない。個別に渡す必要がある。
 */
export const GENERATION_TIMEOUT_MS = 30_000;

/**
 * 生成ボタンを押し、結果カードが出るまで待つ。
 *
 * 「カードが出ない」理由は 2 つあり、区別できないと原因を追えない:
 *   1. 生成に時間がかかっている  → 待てば出る
 *   2. 生成がエラーになった      → いくら待っても出ない
 *
 * 素朴に card だけを待つと、2 のときも「element(s) not found」としか出ず、
 * サーバーが返した理由が失われる(実際にそれで CORS 起因の失敗を見逃しかけた。
 * docs/testing-ci.md 5.5(d))。エラーカードも同時に待ち、出ていれば
 * 画面に表示されている日本語メッセージをそのまま添えて落とす。
 */
export async function generateAndWaitForResult(page: Page, word: string): Promise<void> {
  await page.getByTestId(testIds.home.wordInput).fill(word);
  await page.getByTestId(testIds.home.generate).click();

  const card = page.getByTestId(testIds.result.card).first();
  const generationError = page.getByTestId(testIds.generationError.root);

  // どちらか先に現れた方を待つ。
  await expect(card.or(generationError)).toBeVisible({ timeout: GENERATION_TIMEOUT_MS });

  if (await generationError.isVisible()) {
    const message = (await generationError.innerText()).replace(/\s+/g, ' ').trim();
    throw new Error(
      `類義語の生成がエラーになりました: ${message}\n` +
        'テスト用 Supabase プロジェクトの Edge Function 設定を確認してください' +
        '(DEEPSEEK_API_KEY / ALLOWED_ORIGINS。docs/deployment.md 5.2)。',
    );
  }

  await expect(card).toBeVisible({ timeout: GENERATION_TIMEOUT_MS });
}

export async function signIn(page: Page): Promise<void> {
  await page.goto('/sign-in');

  await page.getByTestId(testIds.signIn.email).fill(e2eEnv.userEmail);
  await page.getByTestId(testIds.signIn.password).fill(e2eEnv.userPassword);
  await page.getByTestId(testIds.signIn.submit).click();

  // 認証ガードを抜けてホームに着いたことを、画面上の要素で確認する。
  await expect(page.getByTestId(testIds.home.title)).toBeVisible();
}

/** 未認証状態のまま保護ルートを開く(認証ガードの検証用)。 */
export async function gotoWithoutSession(page: Page, path: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/');
  // Supabase のセッションは localStorage にある(docs/frontend-design.md 9)。
  await page.evaluate(() => globalThis.localStorage.clear());
  await page.goto(path);
}

/**
 * 履歴からこの単語の行を消す。E2E が作ったデータは E2E が片付ける
 * (docs/testing-ci.md 6.4)。RLS により自分の行しか消せないため特権は要らない。
 */
export async function deleteFromHistory(page: Page, word: string): Promise<void> {
  await page.goto('/history');

  const row = page
    .getByTestId(testIds.history.row)
    .filter({ has: page.getByTestId(testIds.history.rowWord).getByText(word, { exact: true }) });

  // 同じ語の行は de-dup 済みで高々 1 行(docs/db-schema.md 3.5)。
  if ((await row.count()) === 0) return;

  await row.first().getByTestId(testIds.history.rowDelete).click();
  await expect(row).toHaveCount(0);
}

/**
 * Edge Function への呼び出し回数を数える。
 *
 * 注意: これは「観測」であって差し替えではない。page.route() による
 * レスポンスの偽装はモックに当たるため使わない(docs/testing-ci.md 1.2)。
 */
export function countSynonymCalls(page: Page): () => number {
  let calls = 0;
  page.on('request', (request) => {
    if (isSynonymsFunctionCall(request.url())) calls += 1;
  });
  return () => calls;
}

/** バリデーションを必ず通るが、まだ生成されていない語を作る。 */
export function unusedWord(): string {
  const suffix = Array.from(
    { length: 8 },
    () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)],
  ).join('');
  return `zz${suffix}`;
}
