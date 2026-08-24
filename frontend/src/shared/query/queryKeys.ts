/**
 * クエリキーの唯一の置き場所。文字列の直書きを禁止する
 * (docs/frontend-design.md 5.5)。userId はキーに含めない —
 * RLS が行を絞り、サインアウト時に queryClient.clear() する方針と重複するため。
 */
export const queryKeys = {
  lookups: () => ['lookups'] as const,
  storedSynonyms: (word: string) => ['storedSynonyms', word.toLowerCase()] as const,
  profile: () => ['profile'] as const,
};
