export type LogFields = Record<string, string | number | boolean | null | undefined>;

/**
 * 構造化ログを1行のJSONとして出力する。
 *
 * 出力するのは明示したフィールドのみ。
 * JWT・APIキー・リクエストボディ全体・LLMの生応答は絶対に出力しないこと。
 */
export class StructuredLogger {
  constructor(private readonly functionName: string) {}

  info(fields: LogFields): void {
    this.write('info', fields);
  }

  error(fields: LogFields): void {
    this.write('error', fields);
  }

  private write(level: 'info' | 'error', fields: LogFields): void {
    const payload = {
      level,
      function: this.functionName,
      timestamp: new Date().toISOString(),
      ...fields,
    };
    console.log(JSON.stringify(payload));
  }
}
