import { test, expect } from '@playwright/test';
import { testIds } from '../../src/shared/testIds';
import { e2eEnv } from '../env';
import { signIn, gotoWithoutSession } from './helpers';

/**
 * 認証は MVP の 2 機能のうちの 1 つ。実 Supabase Auth に対して通しで検証する。
 * トークンを 1 つも消費しない(DeepSeek を叩かない)スペックなので、毎 PR で回して問題ない。
 */
test.describe('認証', () => {
  test('未認証で保護ルートを開くとサインイン画面へリダイレクトされる', async ({ page }) => {
    // docs/frontend-design.md 3.1 の認証ガード。
    await gotoWithoutSession(page, '/history');

    await expect(page.getByTestId(testIds.signIn.submit)).toBeVisible();
    await expect(page.getByTestId(testIds.history.title)).toHaveCount(0);
  });

  test('未認証でホームを開いてもサインイン画面へ送られる', async ({ page }) => {
    await gotoWithoutSession(page, '/');

    await expect(page.getByTestId(testIds.signIn.submit)).toBeVisible();
  });

  test('メールとパスワードでサインインできる', async ({ page }) => {
    await signIn(page);

    await expect(page.getByTestId(testIds.home.wordInput)).toBeVisible();
    await expect(page.getByTestId(testIds.home.generate)).toBeVisible();
  });

  test('誤ったパスワードではサインインできず、エラーが表示される', async ({ page }) => {
    await page.goto('/sign-in');

    await page.getByTestId(testIds.signIn.email).fill(e2eEnv.userEmail);
    await page.getByTestId(testIds.signIn.password).fill('definitely-not-the-password');
    await page.getByTestId(testIds.signIn.submit).click();

    // 文言ではなく testID で存在だけを見る。メッセージは
    // authErrorMessage.test.ts が単体で押さえている。
    await expect(page.getByTestId(testIds.signIn.error)).toBeVisible();
    await expect(page.getByTestId(testIds.home.title)).toHaveCount(0);
  });

  test('メール形式が不正なときはリクエストを送らずインラインエラーを出す', async ({ page }) => {
    let authCalls = 0;
    page.on('request', (request) => {
      if (request.url().includes('/auth/v1/token')) authCalls += 1;
    });

    await page.goto('/sign-in');
    await page.getByTestId(testIds.signIn.email).fill('not-an-email');
    await page.getByTestId(testIds.signIn.password).fill('whatever-password');
    await page.getByTestId(testIds.signIn.submit).click();

    await expect(page.getByTestId(`${testIds.signIn.email}-error`)).toBeVisible();
    expect(authCalls).toBe(0);
  });

  test('サインアウトするとサインイン画面へ戻り、保護ルートへは戻れない', async ({ page }) => {
    await signIn(page);

    await page.goto('/settings');
    await page.getByTestId(testIds.settings.signOut).click();

    await expect(page.getByTestId(testIds.signIn.submit)).toBeVisible();

    // セッションが本当に消えていること(画面遷移だけでなく状態として)。
    await page.goto('/history');
    await expect(page.getByTestId(testIds.signIn.submit)).toBeVisible();
  });

  test('リロードしてもセッションが保持される', async ({ page }) => {
    // Web は localStorage に永続化される(docs/frontend-design.md 9)。
    // ネイティブの SecureStore 側は Maestro のフローが受け持つ。
    await signIn(page);

    await page.reload();

    await expect(page.getByTestId(testIds.home.title)).toBeVisible();
  });
});
