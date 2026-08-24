export type LogFields = Record<string, string | number | boolean | null | undefined>;

/**
 * docs/llm-integration.md 6章。ログに出してはいけないもの: API キー、JWT、
 * Authorization ヘッダ、メールアドレス、DeepSeek のレスポンス全文
 * (パース失敗時の先頭500文字は例外)。呼び出し側がこれを守る。
 */
export interface Logger {
  info(event: string, fields: LogFields): void;
  error(event: string, fields: LogFields): void;
}
