// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('@typescript-eslint/eslint-plugin');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', 'playwright-report/*', 'test-results/*'],
  },
  {
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      // CLAUDE.md: any は禁止。
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // e2e/ と *.config.ts は Node 上で(Playwright / Vitest から)実行されるものであり、
    // Expo のバンドルには入らない。
    //
    // expo/no-dynamic-env-var は「Expo のバンドラが process.env.EXPO_PUBLIC_* を
    // ビルド時に静的置換するため、動的アクセスでは置換されない」ことを防ぐルール。
    // バンドルに入らないこれらのファイルには当てはまらないので、ここだけ外す。
    files: ['e2e/**/*.ts', 'e2e/**/*.mjs', '*.config.ts'],
    rules: {
      'expo/no-dynamic-env-var': 'off',
    },
  },
];
