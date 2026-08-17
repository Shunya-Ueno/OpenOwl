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

    // raw も長さを検証する。raw は search_history.raw_input に保存され、
    // そのカラムには char_length between 1 and 64 の CHECK 制約がある。
    // 正規化後の長さだけを見ると「空白64文字 + hello」のような入力が検証を通過し、
    // Gemini を課金呼び出しした後に INSERT が制約違反で失敗する。
    // search_history はレート制限のカウント元でもあるため、行が書けないと
    // 課金だけが発生してカウントが増えない無制限ループになる。
    if (input.length < 1 || input.length > MAX_LENGTH) {
      throw new ValidationError(
        `word length must be between 1 and ${MAX_LENGTH} characters`,
      );
    }

    const raw = input;
    const normalized = input.trim().toLowerCase();

    if (normalized.length < 1 || normalized.length > MAX_LENGTH) {
      throw new ValidationError(
        `word length must be between 1 and ${MAX_LENGTH} characters after normalization`,
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
