import type { Term } from '../Term.ts';
import type { Synonym } from '../Synonym.ts';

export interface GenerateInput {
  readonly term: Term;
  readonly maxResults: number;
  readonly explanationLanguage: string;
}

export interface GeneratedSynonyms {
  readonly synonyms: readonly Synonym[];
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly cachedPromptTokens: number | null;
  readonly latencyMs: number;
}

/**
 * LLM への出口。テストダブル差し替えのためではなく、依存方向の制御と将来の
 * プロバイダ差し替えのために存在する(docs/llm-integration.md 4.1)。
 * @throws UpstreamTimeoutError | UpstreamUnavailableError
 *        | UpstreamRateLimitedError | UpstreamInvalidResponseError
 */
export interface SynonymProvider {
  readonly model: string;
  readonly promptVersion: string;
  generate(input: GenerateInput): Promise<GeneratedSynonyms>;
}
