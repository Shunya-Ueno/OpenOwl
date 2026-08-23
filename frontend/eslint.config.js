// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('@typescript-eslint/eslint-plugin');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      // CLAUDE.md: any は禁止。
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
