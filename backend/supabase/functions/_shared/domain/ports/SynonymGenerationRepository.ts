import type { SynonymGeneration } from '../SynonymGeneration.ts';
import type { ResolvedTerm } from './TermRepository.ts';
import type { Synonym } from '../Synonym.ts';

export interface SaveGenerationInput {
  readonly term: ResolvedTerm;
  readonly model: string;
  readonly promptVersion: string;
  readonly maxResults: number;
  readonly synonyms: readonly Synonym[];
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly cachedPromptTokens: number | null;
  readonly latencyMs: number;
}

export interface SynonymGenerationRepository {
  /**
   * term/model/promptVersion に対する最新の生成を返す(TTL 内外を問わない)。
   * 新鮮かどうかの判定は呼び出し側が SynonymGeneration#isFreshAt で行う。
   * これにより「新鮮なキャッシュ検索」と「縮退応答用の検索」を1回の問い合わせで賄える。
   */
  findLatest(
    term: ResolvedTerm,
    model: string,
    promptVersion: string,
  ): Promise<SynonymGeneration | null>;

  /** 生成 + 明細 + 履歴(cache_hit=false)を1トランザクションで保存する。 */
  saveWithLookup(userId: string, input: SaveGenerationInput): Promise<SynonymGeneration>;
}
