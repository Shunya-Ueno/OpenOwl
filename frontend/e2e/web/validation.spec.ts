import { test, expect } from '@playwright/test';
import { testIds } from '../../src/shared/testIds';
import { signIn, countSynonymCalls } from './helpers';

/**
 * 入力バリデーション(docs/frontend-design.md 7.2)。
 *
 * このスペックは DeepSeek のトークンを 1 つも消費しない。
 * むしろ「消費しないこと」自体を検証している: クライアント側で弾けるはずの入力で
 * Edge Function が呼ばれてしまうと、無駄なリクエストとレート制限の消費が発生する。
 */
test.describe('単語入力のバリデーション', () => {
  test('英字以外を含む入力はリクエストを送らずインラインエラーになる', async ({ page }) => {
    await signIn(page);
    const synonymCalls = countSynonymCalls(page);

    for (const invalid of ['improve1', '日本語', 'improve@example.com']) {
      await page.getByTestId(testIds.home.wordInput).fill(invalid);
      await page.getByTestId(testIds.home.generate).click();

      await expect(page.getByTestId(`${testIds.home.wordInput}-error`)).toBeVisible();
    }

    // クライアント検証は「無駄なリクエストを飛ばさない」ために存在する
    // (サーバー側の再検証は別途 Term が行う)。
    expect(synonymCalls()).toBe(0);
  });

  test('64 文字を超える入力を弾く', async ({ page }) => {
    await signIn(page);
    const synonymCalls = countSynonymCalls(page);

    await page.getByTestId(testIds.home.wordInput).fill('a'.repeat(65));
    await page.getByTestId(testIds.home.generate).click();

    await expect(page.getByTestId(`${testIds.home.wordInput}-error`)).toBeVisible();
    expect(synonymCalls()).toBe(0);
  });

  test('空入力を弾く', async ({ page }) => {
    await signIn(page);
    const synonymCalls = countSynonymCalls(page);

    await page.getByTestId(testIds.home.generate).click();

    await expect(page.getByTestId(`${testIds.home.wordInput}-error`)).toBeVisible();
    expect(synonymCalls()).toBe(0);
  });

  test('入力を直すとエラー表示が消える', async ({ page }) => {
    await signIn(page);

    await page.getByTestId(testIds.home.wordInput).fill('improve1');
    await page.getByTestId(testIds.home.generate).click();
    await expect(page.getByTestId(`${testIds.home.wordInput}-error`)).toBeVisible();

    await page.getByTestId(testIds.home.wordInput).fill('improve');

    await expect(page.getByTestId(`${testIds.home.wordInput}-error`)).toHaveCount(0);
  });
});
