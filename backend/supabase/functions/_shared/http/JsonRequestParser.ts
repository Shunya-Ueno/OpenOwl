import { z } from 'zod';
import { ValidationError } from '../domain/error/AppError.ts';

const DEFAULT_LANGUAGE = 'en';

const bodySchema = z.object({
  word: z.unknown(),
  language: z.string().optional(),
});

export interface GenerateSynonymsRequestBody {
  readonly word: unknown;
  readonly language: string;
}

/**
 * リクエストボディの JSON パースと形の検証のみを行う。
 * `word` の詳細な検証(文字種・長さ)は WordText.parse() が担う(責務の分離)。
 */
export class JsonRequestParser {
  async parse(request: Request): Promise<GenerateSynonymsRequestBody> {
    let json: unknown;
    try {
      json = await request.json();
    } catch (error) {
      throw new ValidationError('request body must be valid JSON', error);
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(`invalid request body: ${parsed.error.message}`, parsed.error);
    }

    return {
      word: parsed.data.word,
      language: parsed.data.language ?? DEFAULT_LANGUAGE,
    };
  }
}
