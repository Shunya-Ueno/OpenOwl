/**
 * サーバーと同じ規則をクライアントにも置き、ボタンを押す前に弾く
 * (docs/frontend-design.md 7.2、docs/api-spec.md 3.1)。
 * 二重実装は意図的: こちらは「無駄なリクエストを飛ばさない」ため、
 * サーバー側は「信頼できない入力を防ぐ」ため。クライアント検証を通っても
 * サーバーは必ず再検証する。
 */
const WORD_PATTERN = /^[A-Za-z][A-Za-z '\-]*$/;
const MAX_LENGTH = 64;

export class InvalidWordInputError extends Error {}

export class WordInput {
  private constructor(
    readonly displayText: string,
    readonly normalizedText: string,
  ) {}

  static parse(raw: string): WordInput {
    const displayText = raw.trim().replace(/\s+/g, ' ');

    if (displayText.length < 1) {
      throw new InvalidWordInputError('英単語を入力してください。');
    }
    if (displayText.length > MAX_LENGTH) {
      throw new InvalidWordInputError(`${MAX_LENGTH}文字以内で入力してください。`);
    }
    if (!WORD_PATTERN.test(displayText)) {
      throw new InvalidWordInputError('英字・スペース・ハイフン・アポストロフィのみ使用できます。');
    }

    return new WordInput(displayText, displayText.toLowerCase());
  }

  static validationError(raw: string): string | null {
    try {
      WordInput.parse(raw);
      return null;
    } catch (error) {
      return error instanceof InvalidWordInputError ? error.message : '入力を確認してください。';
    }
  }
}
