/**
 * E2E から要素を指すための識別子の唯一の置き場所(docs/testing-ci.md 4)。
 *
 * React Native の testID は、
 *   - react-native-web では DOM の data-testid 属性  → Playwright: getByTestId()
 *   - iOS では accessibility identifier             → Maestro: id: "..."
 * になる。したがってこの 1 ファイルが Web と iOS 両方のセレクタ源になる。
 *
 * 表示文言でセレクタを書かないこと。文言はコピー修正で変わるうえ、
 * エラーメッセージはサーバーが返すものでクライアントの管理外(docs/api-spec.md 2.4)。
 *
 * Maestro の YAML からはこのファイルを import できないため文字列で書く。
 * 値を変えるときは frontend/e2e/maestro/ 配下も併せて更新すること。
 */
export const testIds = {
  splash: 'splash',

  signIn: {
    email: 'sign-in-email',
    password: 'sign-in-password',
    submit: 'sign-in-submit',
    error: 'sign-in-error',
    google: 'sign-in-google',
    apple: 'sign-in-apple',
  },

  signUp: {
    email: 'sign-up-email',
    password: 'sign-up-password',
    submit: 'sign-up-submit',
    error: 'sign-up-error',
  },

  home: {
    title: 'home-title',
    wordInput: 'home-word-input',
    generate: 'home-generate',
    notice: 'home-notice',
    historyEmpty: 'home-history-empty',
  },

  result: {
    title: 'result-title',
    back: 'result-back',
    card: 'synonym-card',
    notGenerated: 'result-not-generated',
    generate: 'result-generate',
    regenerate: 'result-regenerate',
    stateBadge: 'result-state-badge',
    noSynonyms: 'result-no-synonyms',
    notice: 'result-notice',
  },

  history: {
    title: 'history-title',
    back: 'history-back',
    row: 'history-row',
    rowWord: 'history-row-word',
    rowDelete: 'history-row-delete',
    empty: 'history-empty',
    error: 'history-error',
  },

  settings: {
    title: 'settings-title',
    back: 'settings-back',
    displayName: 'settings-display-name',
    save: 'settings-save',
    signOut: 'settings-sign-out',
    error: 'settings-error',
  },

  generationError: {
    root: 'generation-error',
    retry: 'generation-error-retry',
  },

  updateBanner: {
    root: 'update-banner',
    action: 'update-banner-action',
  },
} as const;

/** TextField / Banner のエラー表示は本体の testID から機械的に導出する。 */
export function errorTestId(testID: string): string {
  return `${testID}-error`;
}
