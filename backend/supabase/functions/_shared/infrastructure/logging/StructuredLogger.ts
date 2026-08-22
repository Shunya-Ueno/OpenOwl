import type { Logger, LogFields } from '../../domain/ports/Logger.ts';

/** 1行1JSONの構造化ログ。docs/llm-integration.md 6章。 */
export class StructuredLogger implements Logger {
  constructor(private readonly functionName: string) {}

  info(event: string, fields: LogFields): void {
    this.write('info', event, fields);
  }

  error(event: string, fields: LogFields): void {
    this.write('error', event, fields);
  }

  private write(level: 'info' | 'error', event: string, fields: LogFields): void {
    console.log(
      JSON.stringify({
        level,
        function: this.functionName,
        event,
        timestamp: new Date().toISOString(),
        ...fields,
      }),
    );
  }
}
