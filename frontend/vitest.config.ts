import { defineConfig } from 'vitest/config';

/**
 * 単体テストは外部 I/O を持たない純粋ロジックのみを対象にする(ADR-0016)。
 * したがって jsdom も React のレンダラも要らない。node 環境で十分。
 *
 * コンポーネントのテストはここでは書かない。画面の挙動は Playwright が
 * 実ブラウザ・実バンドルで検証する(docs/testing-ci.md 2)。
 */
export default defineConfig({
  test: {
    environment: 'node',
    // e2e/ は Playwright が実行する。Vitest が拾わないように明示的に絞る。
    include: ['src/**/*.test.ts'],
    // vi.mock / vi.fn は使わない(モック禁止)。globals を有効にせず、
    // 必要な関数は各テストが vitest から明示的に import する。
    globals: false,
  },
});
