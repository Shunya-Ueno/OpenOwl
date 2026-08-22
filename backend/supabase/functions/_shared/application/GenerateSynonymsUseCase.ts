import { Term } from '../domain/Term.ts';
import { SynonymGeneration } from '../domain/SynonymGeneration.ts';
import type { Synonym } from '../domain/Synonym.ts';
import type { SynonymProvider } from '../domain/ports/SynonymProvider.ts';
import type { TermRepository, ResolvedTerm } from '../domain/ports/TermRepository.ts';
import type { SynonymGenerationRepository } from '../domain/ports/SynonymGenerationRepository.ts';
import type { LookupRepository } from '../domain/ports/LookupRepository.ts';
import type { RateLimiter } from '../domain/ports/RateLimiter.ts';
import type { Logger } from '../domain/ports/Logger.ts';
import { DomainError } from '../domain/errors.ts';
import type { GenerateSynonymsCommand, GenerateSynonymsResult } from './dto/GenerateSynonymsDto.ts';

const UPSTREAM_ERROR_CODES = new Set([
  'upstream_rate_limited',
  'upstream_timeout',
  'upstream_unavailable',
  'upstream_invalid_response',
]);

/**
 * docs/api-spec.md 3.5 の処理手順(4〜11)を実装する。
 * 手順1〜3(CORS/JWT検証/リクエスト検証)は Interface 層が担当し、ここには現れない。
 * fetch も SQL も HTTP ステータスコードもこのクラスには一切現れない
 * (docs/llm-integration.md 4.3)。
 */
export class GenerateSynonymsUseCase {
  constructor(
    private readonly provider: SynonymProvider,
    private readonly terms: TermRepository,
    private readonly generations: SynonymGenerationRepository,
    private readonly lookups: LookupRepository,
    private readonly rateLimiter: RateLimiter,
    private readonly logger: Logger,
    private readonly cacheTtlDays: number,
  ) {}

  async execute(command: GenerateSynonymsCommand): Promise<GenerateSynonymsResult> {
    const term = Term.fromInput(command.word, command.language);

    // 5. レート制限チェック(キャッシュヒットは消費しないため、この時点ではまだ判定できない。
    //    ただし DeepSeek 呼び出しに至る前に弾く必要があるため、ここで一度チェックする。
    //    実際に消費(カウント対象化)されるのは save 時に lookups へ cache_hit=false で
    //    記録された時点。RateLimiter 実装は cache_hit=false の行のみを数える。
    await this.rateLimiter.assertWithinLimit(command.userId);

    // 6. term の解決
    const resolvedTerm = await this.terms.findOrCreate(term);

    // 7. キャッシュ検索(常に最新を1件取得し、新鮮判定は呼び出し側で行う)
    const latest = command.forceRefresh
      ? null
      : await this.generations.findLatest(resolvedTerm, this.provider.model, this.provider.promptVersion);

    if (latest && latest.isFreshAt(new Date(), this.cacheTtlDays)) {
      await this.lookups.recordCacheHit(command.userId, resolvedTerm.id, latest.id);
      this.logger.info('synonyms.cache_hit', {
        userId: command.userId,
        term: resolvedTerm.displayText,
      });
      return this.toResult(resolvedTerm, latest, true, false);
    }

    // 縮退応答用に、forceRefresh でも直近の生成(TTL切れ含む)を把握しておく。
    const fallbackCandidate = latest ?? (command.forceRefresh
      ? await this.generations.findLatest(resolvedTerm, this.provider.model, this.provider.promptVersion)
      : null);

    // 8. DeepSeek 呼び出し
    let generated;
    try {
      generated = await this.provider.generate({
        term,
        maxResults: command.maxResults,
        explanationLanguage: 'ja',
      });
    } catch (error) {
      if (this.isUpstreamError(error) && fallbackCandidate) {
        await this.lookups.recordCacheHit(command.userId, resolvedTerm.id, fallbackCandidate.id);
        this.logger.info('synonyms.stale_served', {
          userId: command.userId,
          term: resolvedTerm.displayText,
          errorCode: (error as DomainError).code,
        });
        return this.toResult(resolvedTerm, fallbackCandidate, true, true);
      }
      this.logger.error('synonyms.upstream_failed', {
        userId: command.userId,
        term: resolvedTerm.displayText,
        errorCode: error instanceof DomainError ? error.code : 'internal_error',
      });
      throw error;
    }

    // 10. 永続化(生成 + 明細 + 履歴を1トランザクション)
    try {
      const saved = await this.generations.saveWithLookup(command.userId, {
        term: resolvedTerm,
        model: this.provider.model,
        promptVersion: this.provider.promptVersion,
        maxResults: command.maxResults,
        synonyms: generated.synonyms,
        promptTokens: generated.promptTokens,
        completionTokens: generated.completionTokens,
        cachedPromptTokens: generated.cachedPromptTokens,
        latencyMs: generated.latencyMs,
      });

      this.logger.info('synonyms.generated', {
        userId: command.userId,
        term: resolvedTerm.displayText,
        model: this.provider.model,
        promptTokens: generated.promptTokens,
        completionTokens: generated.completionTokens,
        latencyMs: generated.latencyMs,
      });

      return this.toResult(resolvedTerm, saved, false, false);
    } catch (persistError) {
      // 生成自体は成功している。DeepSeek のコストを既に払っている以上、
      // ユーザーに結果を渡さないのは損失が二重になるため、エラーにせず返す
      // (docs/api-spec.md 3.5 手順10の注記)。履歴に残らないことは許容する。
      this.logger.error('synonyms.persist_failed', {
        userId: command.userId,
        term: resolvedTerm.displayText,
        message: persistError instanceof Error ? persistError.message : 'unknown error',
      });

      return this.toAdHocResult(resolvedTerm, generated.synonyms);
    }
  }

  private isUpstreamError(error: unknown): boolean {
    return error instanceof DomainError && UPSTREAM_ERROR_CODES.has(error.code);
  }

  private toResult(
    term: ResolvedTerm,
    generation: SynonymGeneration,
    cached: boolean,
    stale: boolean,
  ): GenerateSynonymsResult {
    return {
      term: { id: term.id, text: term.displayText, language: term.language },
      generation: {
        id: generation.id,
        model: generation.model,
        createdAt: generation.createdAt.toISOString(),
        cached,
        stale,
      },
      synonyms: generation.synonyms.map((s) => this.toSynonymDto(s)),
    };
  }

  private toAdHocResult(
    term: ResolvedTerm,
    synonyms: readonly Synonym[],
  ): GenerateSynonymsResult {
    return {
      term: { id: term.id, text: term.displayText, language: term.language },
      generation: {
        id: crypto.randomUUID(),
        model: this.provider.model,
        createdAt: new Date().toISOString(),
        cached: false,
        stale: false,
      },
      synonyms: synonyms.map((s) => this.toSynonymDto(s)),
    };
  }

  private toSynonymDto(s: Synonym) {
    return {
      text: s.text,
      partOfSpeech: s.partOfSpeech,
      register: s.register,
      nuance: s.nuance,
    };
  }
}
