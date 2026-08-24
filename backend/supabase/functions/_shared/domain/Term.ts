import { InvalidWordError } from './errors.ts';

export type LanguageCode = 'en';

const WORD_PATTERN = /^[A-Za-z][A-Za-z'\- ]*$/;
const MAX_LENGTH = 64;

/**
 * 検索対象の語。docs/db-schema.md 3.2 の正規化ルールの唯一の置き場所。
 * 前後の空白を除去 → 連続空白を1つに圧縮 → 小文字化。
 * 文字種を厳格に制限するのは、プロンプトインジェクション対策とトークン浪費防止の
 * 両方を兼ねるため(docs/security.md 3)。
 */
export class Term {
  private constructor(
    readonly displayText: string,
    readonly normalizedText: string,
    readonly language: LanguageCode,
  ) {}

  static fromInput(raw: unknown, language: unknown): Term {
    if (typeof raw !== 'string') {
      throw new InvalidWordError('word must be a string');
    }
    if (language !== undefined && language !== 'en') {
      throw new InvalidWordError('language must be "en"');
    }

    const displayText = raw.trim().replace(/\s+/g, ' ');

    if (displayText.length < 1 || displayText.length > MAX_LENGTH) {
      throw new InvalidWordError(`word length must be between 1 and ${MAX_LENGTH} characters`);
    }
    if (!WORD_PATTERN.test(displayText)) {
      throw new InvalidWordError(
        'word must contain only English letters, spaces, apostrophes and hyphens',
      );
    }

    const normalizedText = displayText.toLowerCase();

    return new Term(displayText, normalizedText, 'en');
  }
}
