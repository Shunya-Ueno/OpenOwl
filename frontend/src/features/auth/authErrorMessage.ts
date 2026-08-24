import { AuthError } from '@supabase/supabase-js';

// Supabase Auth のエラーはメッセージ文字列ではなく、AuthError#code(安定した
// 識別子)で分岐する(CLAUDE.md「エラーは型で表現する」)。
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'メールアドレスまたはパスワードが正しくありません。',
  user_already_exists: 'このメールアドレスは既に登録されています。',
  email_not_confirmed: 'メールアドレスの確認が完了していません。届いたメールをご確認ください。',
  weak_password: 'パスワードの強度が不十分です。',
  over_request_rate_limit: 'リクエストが集中しています。しばらくしてからお試しください。',
  same_password: '現在のパスワードと同じです。',
};

const FALLBACK = 'エラーが発生しました。もう一度お試しください。';

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthError && error.code) {
    const message = MESSAGES[error.code];
    if (message) return message;
  }
  return FALLBACK;
}
