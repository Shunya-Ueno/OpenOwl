import type { WordText } from '../model/WordText.ts';
import type { Synonym } from '../model/Synonym.ts';

export interface GenerationResult {
  readonly synonyms: readonly Synonym[];
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly latencyMs: number;
}

/**
 * LLM による類義語生成の抽象。
 *
 * このインターフェースは「プロバイダを差し替える具体的な理由がある箇所」
 * (Gemini → 別モデル)にのみ存在する。テスト用フェイク実装の差し込み口ではない。
 * テストは実際の Gemini API に接続して行う(docs/adr/0006-no-mocks-testing-policy.md)。
 */
export interface SynonymGenerator {
  readonly model: string;
  readonly promptVersion: string;

  /**
   * @throws NotAKnownWordError 入力が英単語として認識されなかった場合
   * @throws LlmInvalidResponseError 応答がスキーマに適合しない場合
   * @throws LlmUnavailableError 429/5xx・ネットワークエラーがリトライ後も解消しない場合
   * @throws LlmTimeoutError タイムアウトした場合
   */
  generate(word: WordText): Promise<GenerationResult>;
}
