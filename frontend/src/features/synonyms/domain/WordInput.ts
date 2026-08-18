import { z } from 'zod';

const MAX_LENGTH = 64;
const WORD_PATTERN = /^[A-Za-z][A-Za-z'\- ]*$/;

const schema = z
  .string()
  .min(1, '英単語を入力してください。')
  .max(MAX_LENGTH, `${MAX_LENGTH}文字以内で入力してください。`)
  .regex(WORD_PATTERN, '英字で入力してください(アポストロフィ・ハイフン・スペースのみ使用可)。');

/**
 * ユーザーが入力する英単語の値オブジェクト。
 *
 * バックエンドの WordText(backend/.../domain/model/WordText.ts)と**意図的に同じ検証ルール**
 * を持つ。共通型パッケージを作らない方針(docs/adr/0002)により重複を許容しているが、
 * 送信前にここで弾くことでネットワーク往復と無駄な課金を避けられる
 * (最終的な強制力はサーバ側の WordText.parse() にある。ここはあくまで UX のため)。
 */
export class WordInput {
  private constructor(readonly value: string) {}

  /** @throws ZodError 検証に失敗した場合。フォームの表示にはこのメッセージをそのまま使う。 */
  static parse(raw: string): WordInput {
    const trimmed = schema.parse(raw);
    return new WordInput(trimmed.trim());
  }

  /** react-hook-form の zodResolver に渡すためのスキーマ。 */
  static get schema() {
    return schema;
  }
}
