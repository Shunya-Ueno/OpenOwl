import { test, expect } from '@playwright/test';
import { testIds } from '../../src/shared/testIds';
import { e2eEnv } from '../env';
import { signIn, deleteFromHistory } from './helpers';

/**
 * 類義語生成の通し(MVP のもう 1 つの機能)。
 * 画面 → Edge Function → Postgres →（必要なら）DeepSeek を実物で通す。
 *
 * コスト制御(docs/testing-ci.md 6.5): 固定の単語を使うため、
 * 初回だけ実生成が走り、以降はキャッシュ TTL(既定 30 日)の間ヒットで返る。
 * キャッシュヒットでも UI の経路は同一なので、テストの価値は落ちない。
 * キャッシュヒットはレート制限を消費しない(docs/security.md 6)。
 */
test.describe('類義語生成', () => {
  // 初回実行時は実生成が走るため、DeepSeek のタイムアウト(既定 20 秒)を見込む。
  test.slow();

  test('単語を入力すると結果画面に類義語が表示される', async ({ page }) => {
    const word = e2eEnv.word;
    await signIn(page);

    await page.getByTestId(testIds.home.wordInput).fill(word);
    await page.getByTestId(testIds.home.generate).click();

    // 結果画面へ遷移する。
    await expect(page.getByTestId(testIds.result.title)).toHaveText(word);

    // 類義語カードが 1 枚以上出る。件数は LLM の出力次第なので固定しない。
    const cards = page.getByTestId(testIds.result.card);
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);

    await deleteFromHistory(page, word);
  });

  test('生成すると履歴に残り、履歴から結果画面へ戻れる', async ({ page }) => {
    const word = e2eEnv.word;
    await signIn(page);

    await page.getByTestId(testIds.home.wordInput).fill(word);
    await page.getByTestId(testIds.home.generate).click();
    await expect(page.getByTestId(testIds.result.card).first()).toBeVisible();

    await page.goto('/history');
    const row = page
      .getByTestId(testIds.history.row)
      .filter({ has: page.getByTestId(testIds.history.rowWord).getByText(word, { exact: true }) });
    await expect(row).toHaveCount(1);

    // 履歴からの遷移は保存済みを読むだけで、再生成しない(ADR-0012)。
    await row.getByTestId(testIds.history.rowWord).click();
    await expect(page.getByTestId(testIds.result.title)).toHaveText(word);
    await expect(page.getByTestId(testIds.result.card).first()).toBeVisible();

    await deleteFromHistory(page, word);
  });

  test('履歴から削除すると一覧から消える', async ({ page }) => {
    const word = e2eEnv.word;
    await signIn(page);

    await page.getByTestId(testIds.home.wordInput).fill(word);
    await page.getByTestId(testIds.home.generate).click();
    await expect(page.getByTestId(testIds.result.card).first()).toBeVisible();

    await deleteFromHistory(page, word);

    // 再読み込みしても消えたままであること(サーバー側で消えている)。
    await page.reload();
    const row = page
      .getByTestId(testIds.history.row)
      .filter({ has: page.getByTestId(testIds.history.rowWord).getByText(word, { exact: true }) });
    await expect(row).toHaveCount(0);
  });

  test('保存済みの結果はリロードしても表示され続ける', async ({ page }) => {
    const word = e2eEnv.word;
    await signIn(page);

    await page.getByTestId(testIds.home.wordInput).fill(word);
    await page.getByTestId(testIds.home.generate).click();
    await expect(page.getByTestId(testIds.result.card).first()).toBeVisible();

    // ADR-0012: リロードは再生成ではなく PostgREST からの読み出しになる。
    await page.reload();
    await expect(page.getByTestId(testIds.result.card).first()).toBeVisible();
    await expect(page.getByTestId(testIds.result.notGenerated)).toHaveCount(0);

    await deleteFromHistory(page, word);
  });
});
