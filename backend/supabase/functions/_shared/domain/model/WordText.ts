import { ValidationError } from '../error/AppError.ts';

const WORD_PATTERN = /^[A-Za-z][A-Za-z'\- ]*$/;
const MAX_LENGTH = 64;

/**
 * ユーザーが入力した英単語を表す値オブジェクト。
 * 正規化(trim + 小文字化)と検証を1箇所に閉じ込める。
 * LLM を呼ぶ前(=課金前)に検証を通すため、生成の入口で必ず parse() を通すこと。
 */
export class WordText {
  private constructor(
    /** 正規化済み(trim + 小文字化)。words.text と一致する形式。 */
    readonly value: string,
    /** ユーザーが実際に入力した文字列。search_history.raw_input に保存する。 */
    readonly raw: string,
  ) {}

  static parse(input: unknown): WordText {
    if (typeof input !== 'string') {
      throw new ValidationError('word must be a string');
    }

    const raw = input;
    const normalized = input.trim().toLowerCase();

    if (normalized.length < 1 || normalized.length > MAX_LENGTH) {
      throw new ValidationError(
        `word length must be between 1 and ${MAX_LENGTH} characters`,
      );
    }
    if (!WORD_PATTERN.test(normalized)) {
      throw new ValidationError(
        'word must contain only English letters, apostrophes, hyphens, and spaces',
      );
    }

    return new WordText(normalized, raw);
  }

  equals(other: WordText): boolean {
    return this.value === other.value;
  }
}
