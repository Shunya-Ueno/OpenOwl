/**
 * feature 間の直接 import を禁止する方針の唯一の例外(認証状態の購読)。
 * 実装は features/auth にあるが、他の feature(synonyms など)はここ経由で使う
 * (docs/frontend/directory-structure.md)。
 */
export { useAuth } from '@/features/auth/hooks/AuthProvider';
export type { AuthState, AuthStatus } from '@/features/auth/hooks/AuthProvider';
