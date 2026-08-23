import { defineConfig, devices } from '@playwright/test';

/**
 * Vercel のプレビューデプロイに対するスモーク(docs/testing-ci.md 7.1)。
 *
 * ci.yml の e2e-web は dist/ をローカル配信するため、vercel.json のリライトや
 * セキュリティヘッダは検証できない。それらを見るのがこの設定の役割で、
 * 対象は必ず実際にデプロイされた URL(E2E_BASE_URL)になる。
 *
 * **生成は行わない。** プレビューはデプロイのたびに走るため、
 * ここで DeepSeek を叩くとデプロイ回数に比例して課金される。
 */
const BASE_URL = process.env.E2E_BASE_URL;

if (!BASE_URL) {
  throw new Error(
    'E2E_BASE_URL が未設定です。プレビューのスモークはデプロイ済みの URL に対して実行します。',
  );
}

export default defineConfig({
  testDir: './e2e/preview',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL,
    ...devices['iPhone 14'],
    defaultBrowserType: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [{ name: 'chromium' }],
});
