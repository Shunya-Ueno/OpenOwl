import { defineConfig, devices } from '@playwright/test';

/**
 * Web の E2E(docs/testing-ci.md 3、ADR-0014)。
 *
 * 対象は `expo export` が出力した dist/ そのもの。E2E のためにビルドし直さない。
 * 「テストしたものと配信するものが同じ」を保つため(docs/testing-ci.md 5.2)。
 *
 * 接続先はテスト用 Supabase プロジェクト。モックは使わない。
 * page.route() によるレスポンス差し替えは方針違反なので、どのスペックでも使わない。
 */
const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e/web',

  // E2E 用アカウントは 1 つしかなく、履歴とレート制限を共有する。
  // 並列化すると互いの履歴を壊し合うため直列で回す(docs/testing-ci.md 6.5)。
  fullyParallel: false,
  workers: 1,

  // 実 LLM を叩く経路があるため、CI での自動リトライは 1 回までに絞る。
  // (リトライのたびに生成が走る可能性がある)
  retries: process.env.CI ? 1 : 0,

  // 未コミットの test.only を CI で落とす。
  forbidOnly: Boolean(process.env.CI),

  timeout: 60_000,
  expect: { timeout: 15_000 },

  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],

  use: {
    baseURL: BASE_URL,
    // UI はモバイル幅専用(ADR-0005)。デスクトップ幅で回しても意味がない。
    ...devices['iPhone 14'],
    // Safari ではなく Chromium で回す。iOS Safari 固有の検証は Maestro 側の担当。
    defaultBrowserType: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [{ name: 'chromium' }],

  // E2E_BASE_URL が外から与えられている場合(プレビュー等)はサーバーを起動しない。
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: `node e2e/serve-dist.mjs dist`,
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      }),
});
