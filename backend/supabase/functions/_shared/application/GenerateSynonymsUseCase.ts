import { WordText } from '../domain/model/WordText.ts';
import type { Word } from '../domain/model/Word.ts';
import type { SynonymGeneration } from '../domain/model/SynonymGeneration.ts';
import type { SynonymRepository } from '../domain/port/SynonymRepository.ts';
import type { SynonymGenerator } from '../domain/port/SynonymGenerator.ts';
import type { RateLimiter } from '../domain/port/RateLimiter.ts';
import { AppError, InternalError, UnsupportedLanguageError } from '../domain/error/AppError.ts';
import type { GenerationTelemetry } from '../domain/error/AppError.ts';
import type { StructuredLogger } from '../infrastructure/logging/StructuredLogger.ts';

const SUPPORTED_LANGUAGE = 'en';

export interface GenerateSynonymsCommand {
  /** JWT 検証済みのユーザーID。クライアントが送った識別子は使わない。 */
  readonly userId: string;
  /** リクエストボディの検証前の値。型と内容の検証は WordText.parse() が行う。 */
  readonly rawWord: unknown;
  readonly language: string;
  readonly requestId: string;
}

export type GenerationSource = 'generated' | 'cache';

export interface GenerateSynonymsResult {
  readonly source: GenerationSource;
  readonly generation: SynonymGeneration;
  readonly remainingToday: number;
  readonly dailyLimit: number;
}

/**
 * 類義語生成のユースケース。
 *
 * 処理順序は「お金のかからないチェックを先に、LLM 呼び出しを最後に」を徹底する:
 * 入力検証 → レート制限 → キャッシュ確認 → (キャッシュがなければ)LLM 呼び出し。
 */
export class GenerateSynonymsUseCase {
  constructor(
    private readonly repository: SynonymRepository,
    private readonly generator: SynonymGenerator,
    private readonly rateLimiter: RateLimiter,
    private readonly logger: StructuredLogger,
    private readonly cacheTtlDays: number,
  ) {}

  async execute(command: GenerateSynonymsCommand): Promise<GenerateSynonymsResult> {
    if (command.language !== SUPPORTED_LANGUAGE) {
      throw new UnsupportedLanguageError(`unsupported language: ${command.language}`);
    }

    const wordText = WordText.parse(command.rawWord);
    const rateStatus = await this.rateLimiter.check(command.userId);

    const word = await this.repository.findOrCreateWord(wordText, command.language);
    const latest = await this.repository.findLatestGeneration(
      word,
      this.generator.model,
      this.generator.promptVersion,
    );

    if (latest && latest.isFreshAt(new Date(), this.cacheTtlDays)) {
      await this.repository.recordCacheHit(command.userId, word, latest.id, wordText.raw);
      this.logger.info({
        requestId: command.requestId,
        userId: command.userId,
        word: word.text,
        source: 'cache',
        outcome: 'succeeded',
      });
      return {
        source: 'cache',
        generation: latest,
        remainingToday: rateStatus.remainingToday,
        dailyLimit: rateStatus.dailyLimit,
      };
    }

    return await this.generateAndSave(command, word, wordText, rateStatus.remainingToday, rateStatus.dailyLimit);
  }

  private async generateAndSave(
    command: GenerateSynonymsCommand,
    word: Word,
    wordText: WordText,
    remainingBeforeGeneration: number,
    dailyLimit: number,
  ): Promise<GenerateSynonymsResult> {
    try {
      const result = await this.generator.generate(wordText);
      const generation = await this.repository.saveGeneration({
        userId: command.userId,
        word,
        rawInput: wordText.raw,
        model: this.generator.model,
        promptVersion: this.generator.promptVersion,
        synonyms: result.synonyms,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        latencyMs: result.latencyMs,
      });

      this.logger.info({
        requestId: command.requestId,
        userId: command.userId,
        word: word.text,
        source: 'generated',
        model: this.generator.model,
        promptVersion: this.generator.promptVersion,
        latencyMs: result.latencyMs,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        outcome: 'succeeded',
      });

      return {
        source: 'generated',
        generation,
        remainingToday: Math.max(0, remainingBeforeGeneration - 1),
        dailyLimit,
      };
    } catch (error) {
      const appError = this.toAppError(error);
      const telemetry = this.extractTelemetry(appError);

      await this.repository.recordFailure({
        userId: command.userId,
        word,
        rawInput: wordText.raw,
        model: this.generator.model,
        promptVersion: this.generator.promptVersion,
        errorCode: appError.code,
        promptTokens: telemetry?.promptTokens ?? null,
        completionTokens: telemetry?.completionTokens ?? null,
        latencyMs: telemetry?.latencyMs ?? null,
      });

      this.logger.error({
        requestId: command.requestId,
        userId: command.userId,
        word: word.text,
        model: this.generator.model,
        promptVersion: this.generator.promptVersion,
        outcome: 'failed',
        errorCode: appError.code,
      });

      throw appError;
    }
  }

  private toAppError(error: unknown): AppError {
    if (error instanceof AppError) return error;
    return new InternalError('unexpected error during synonym generation', error);
  }

  private extractTelemetry(error: AppError): GenerationTelemetry | null {
    if ('telemetry' in error) {
      return (error as unknown as { telemetry: GenerationTelemetry }).telemetry;
    }
    return null;
  }
}
