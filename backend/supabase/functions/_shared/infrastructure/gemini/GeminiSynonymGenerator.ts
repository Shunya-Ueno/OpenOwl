import type { SynonymGenerator, GenerationResult } from '../../domain/port/SynonymGenerator.ts';
import type { WordText } from '../../domain/model/WordText.ts';
import type { GeminiHttpClient } from './GeminiHttpClient.ts';
import { SynonymPrompt } from './SynonymPrompt.ts';

/**
 * Gemini Flash-Lite を使った SynonymGenerator の実装。
 * 「HTTP の面倒」(GeminiHttpClient)と「プロンプトの面倒」(SynonymPrompt)を分離し、
 * 通信処理より変更頻度の高いプロンプト改訂がここに閉じるようにしている。
 */
export class GeminiSynonymGenerator implements SynonymGenerator {
  readonly promptVersion = SynonymPrompt.VERSION;

  constructor(
    private readonly http: GeminiHttpClient,
    private readonly prompt: SynonymPrompt,
    readonly model: string,
  ) {}

  async generate(word: WordText): Promise<GenerationResult> {
    const requestBody = this.prompt.buildRequest(word);
    const raw = await this.http.post(this.model, requestBody);
    const parsed = this.prompt.parse(raw);

    return {
      synonyms: parsed.synonyms,
      promptTokens: parsed.promptTokens,
      completionTokens: parsed.completionTokens,
      latencyMs: raw.latencyMs,
    };
  }
}
