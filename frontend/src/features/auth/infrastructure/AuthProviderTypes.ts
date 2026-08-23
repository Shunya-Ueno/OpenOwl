/**
 * Google / Apple 双方のネイティブ・Web 実装が共通で返す形。
 * docs/frontend-design.md 8.1〜8.2。
 *
 * - session: ネイティブでその場に ID トークンが得られた（signInWithIdToken へ渡す）
 * - redirecting: Web はブラウザがリダイレクトするため、ここでは何もしない
 * - cancelled: ネイティブでユーザーがダイアログを閉じた
 */
export type SocialSignInOutcome =
  | { kind: 'session'; idToken: string; nonce: string; fullName?: string | null }
  | { kind: 'redirecting' }
  | { kind: 'cancelled' };
