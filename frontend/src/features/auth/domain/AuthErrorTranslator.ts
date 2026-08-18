/**
 * Supabase Auth が返すエラーメッセージ(英語)を、画面にそのまま表示できる日本語に変換する。
 *
 * domain 層のため Supabase SDK の型には依存せず、構造的な { message: string } で受ける
 * (docs/frontend/directory-structure.md: features/*\/domain は外部 SDK を import しない)。
 *
 * サインインの失敗は「メールアドレス」「パスワード」のどちらが誤りかを示さない
 * (アカウントの存在有無が漏れるため。docs/frontend/screens.md)。
 * Supabase 側も両方のケースで同一の "Invalid login credentials" を返すため、
 * この変換をそのまま使うだけで自然にその方針を満たす。
 */
const EXACT_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません。',
  'User already registered': 'このメールアドレスは既に登録されています。',
  'Email not confirmed': 'メールアドレスの確認が完了していません。確認メールをご確認ください。',
  'Email link is invalid or has expired': 'リンクの有効期限が切れています。もう一度お試しください。',
  'Signups not allowed for this instance': '現在、新規登録を受け付けていません。',
};

const PATTERN_MESSAGES: { test: RegExp; message: string }[] = [
  {
    test: /security purposes.*after (\d+) seconds/i,
    message: 'しばらく時間をおいてからもう一度お試しください。',
  },
  {
    test: /password.*at least/i,
    message: 'パスワードは8文字以上で入力してください。',
  },
];

const DEFAULT_MESSAGE = 'エラーが発生しました。もう一度お試しください。';

export function translateAuthErrorMessage(error: { message: string }): string {
  const exact = EXACT_MESSAGES[error.message];
  if (exact) return exact;

  const pattern = PATTERN_MESSAGES.find((p) => p.test.test(error.message));
  if (pattern) return pattern.message;

  return DEFAULT_MESSAGE;
}
