import type {
  SynonymProvider,
  GenerateInput,
  GeneratedSynonyms,
} from '../../domain/ports/SynonymProvider.ts';
import { Synonym } from '../../domain/Synonym.ts';
import { UpstreamInvalidResponseError } from '../../domain/errors.ts';
import { DeepSeekClient } from './DeepSeekClient.ts';
import { SynonymPromptBuilder } from './SynonymPromptBuilder.ts';
import { synonymResponseSchema } from './schemas.ts';

const MAX_TOKENS = 600;
const TEMPERATURE = 1.0;

/**
 * SynonymProvider の実装。プロンプト組み立て・レスポンスのパースと zod 検証・
 * ドメイン型への変換を担う。HTTP・リトライ・タイムアウトのことは一切知らない
 * (docs/llm-integration.md 4.4)。
 */
export class DeepSeekSynonymProvider implements SynonymProvider {
  readonly promptVersion = SynonymPromptBuilder.VERSION;

  constructor(
    private readonly client: DeepSeekClient,
    private readonly promptBuilder: SynonymPromptBuilder,
    readonly model: string,
  ) {}

  async generate(input: GenerateInput): Promise<GeneratedSynonyms> {
    const messages = this.promptBuilder.build(
      input.term,
      input.maxResults,
      input.explanationLanguage,
    );

    const response = await this.client.createChatCompletion({
      model: this.model,
      messages,
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      jsonMode: true,
    });

    const payload = this.parseContent(response.content);

    const synonyms = payload.synonyms
      .slice(0, input.maxResults)
      .map((item) => new Synonym(item.text, item.partOfSpeech, item.register, item.nuance));

    return {
      synonyms,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      cachedPromptTokens: response.cachedPromptTokens,
      latencyMs: response.latencyMs,
    };
  }

  /**
   * docs/llm-integration.md 5.1: パース失敗はリトライしない代わりに、
   * 追加コストゼロの寛容な前処理を1度だけ行う。
   */
  private parseContent(raw: string): ReturnType<typeof synonymResponseSchema.parse> {
    const candidate = this.stripCodeFence(raw.trim());

    let json: unknown;
    try {
      json = JSON.parse(candidate);
    } catch (error) {
      throw new UpstreamInvalidResponseError(
        `deepseek response was not valid JSON: ${candidate.slice(0, 500)}`,
        error,
      );
    }

    const parsed = synonymResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new UpstreamInvalidResponseError(
        `deepseek response did not match expected schema: ${parsed.error.message}`,
        parsed.error,
      );
    }

    return parsed.data;
  }

  private stripCodeFence(text: string): string {
    const withoutFence = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return withoutFence;
    return withoutFence.slice(start, end + 1);
  }
}
