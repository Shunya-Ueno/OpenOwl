import { test, expect } from '@playwright/test';
import { testIds } from '../../src/shared/testIds';
import { e2eEnv } from '../env';
import { signIn, deleteFromHistory } from './helpers';

/**
 * キャッシュに当たらない経路 — つまり DeepSeek を実際に呼ぶ経路 — の確認。
 *
 * **このスペックだけは実際にトークンを消費する**ため、既定では走らせない。
 * 日次のスケジュール実行(ci.yml の schedule)でのみ E2E_ALLOW_GENERATION=1 が渡り、
 * 1 日 1 回だけ動く(docs/testing-ci.md 6.5)。
 *
 * PR ごとに回さないのは、PR 数に比例して課金されるため。
 * それでも毎日 1 回は回す: キャッシュヒットのテストだけでは、
 * 「生成そのものが壊れている」ことを検出できないまま TTL の 30 日が過ぎうる。
 */
test.describe('実生成(キャッシュに当たらない経路)', () => {
  test.skip(
    !e2eEnv.allowGeneration,
    'E2E_ALLOW_GENERATION=1 のときだけ実行する(DeepSeek のトークンを消費するため)',
  );

  test.slow();

  test('キャッシュされていない単語を実際に生成できる', async ({ page }) => {
    // 日替わりで語を選ぶ。毎日違う語にすることで確実にキャッシュを外す。
    const word = rotatingWord();
    await signIn(page);

    await page.getByTestId(testIds.home.wordInput).fill(word);
    await page.getByTestId(testIds.home.generate).click();

    await expect(page.getByTestId(testIds.result.title)).toHaveText(word);

    // 生成が失敗していればエラーカードが出る。まずそれが無いことを確認する。
    await expect(page.getByTestId(testIds.generationError.root)).toHaveCount(0);

    const cards = page.getByTestId(testIds.result.card);
    await expect(cards.first()).toBeVisible();

    // LLM 出力は zod 検証と DB の CHECK を通っているはずなので、
    // カードに語が入っていることまで見る(空文字が保存されていないこと)。
    const firstCardText = await cards.first().innerText();
    expect(firstCardText.trim().length).toBeGreaterThan(0);

    await deleteFromHistory(page, word);
  });

  test('「別の候補を見る」で強制再生成できる', async ({ page }) => {
    const word = rotatingWord();
    await signIn(page);

    await page.getByTestId(testIds.home.wordInput).fill(word);
    await page.getByTestId(testIds.home.generate).click();
    await expect(page.getByTestId(testIds.result.card).first()).toBeVisible();

    // forceRefresh: true の経路(ADR-0012: 既定では true にしない)。
    await page.getByTestId(testIds.result.regenerate).click();

    await expect(page.getByTestId(testIds.generationError.root)).toHaveCount(0);
    await expect(page.getByTestId(testIds.result.card).first()).toBeVisible();

    await deleteFromHistory(page, word);
  });
});

/**
 * 日替わりの語。固定リストから選ぶのは、生成結果が語彙として妥当であることを
 * 人が結果ログで確認できるようにするため(ランダム文字列だと類義語が存在しない)。
 */
function rotatingWord(): string {
  const words = [
    'improve',
    'reduce',
    'happy',
    'quick',
    'difficult',
    'important',
    'begin',
    'explain',
    'strong',
    'quiet',
    'brave',
    'clever',
    'gather',
    'reliable',
  ];

  const dayOfYear = Math.floor(
    (Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) / 86_400_000,
  );

  // words は空でないため必ず値が取れるが、noUncheckedIndexedAccess のため既定値を置く。
  return words[dayOfYear % words.length] ?? 'improve';
}
