import { test, expect } from '@playwright/test';
import { testIds } from '../../src/shared/testIds';
import { signIn, countSynonymCalls, unusedWord } from './helpers';

/**
 * ADR-0012 の「URL 直接アクセス・リロードでは再生成しない」を守るスペック。
 *
 * この決定はコストに直結する(リンクを踏んだだけで DeepSeek に課金される状態を避ける)。
 * 壊れても画面上は「むしろ親切に動いている」ように見えてしまい、
 * 請求書を見るまで気づけない類のリグレッションなので、E2E で明示的に固定する。
 *
 * そして、このスペック自体はトークンを 1 つも消費しない。
 */
test.describe('結果画面への直接アクセス', () => {
  test('未生成の単語の URL を直接開いても自動生成しない', async ({ page }) => {
    await signIn(page);
    const synonymCalls = countSynonymCalls(page);

    const word = unusedWord();
    await page.goto(`/synonyms/${word}`);

    // 空状態と、明示的な生成ボタンが出る。
    await expect(page.getByTestId(testIds.result.notGenerated)).toBeVisible();
    await expect(page.getByTestId(testIds.result.generate)).toBeVisible();

    // 肝心なのはここ。ボタンを押していない以上、生成は走っていない。
    expect(synonymCalls()).toBe(0);
  });

  test('未生成の結果画面をリロードしても生成が走らない', async ({ page }) => {
    await signIn(page);

    const word = unusedWord();
    await page.goto(`/synonyms/${word}`);
    await expect(page.getByTestId(testIds.result.generate)).toBeVisible();

    const synonymCalls = countSynonymCalls(page);
    await page.reload();
    await expect(page.getByTestId(testIds.result.generate)).toBeVisible();

    expect(synonymCalls()).toBe(0);
  });

  test('結果画面のタイトルに URL の単語が出る', async ({ page }) => {
    await signIn(page);

    const word = unusedWord();
    await page.goto(`/synonyms/${word}`);

    await expect(page.getByTestId(testIds.result.title)).toHaveText(word);
  });

  test('未認証で結果画面の URL を開くとサインインへ送られる', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => globalThis.localStorage.clear());

    const synonymCalls = countSynonymCalls(page);
    await page.goto(`/synonyms/${unusedWord()}`);

    await expect(page.getByTestId(testIds.signIn.submit)).toBeVisible();
    expect(synonymCalls()).toBe(0);
  });
});
