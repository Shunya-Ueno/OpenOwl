import { z } from 'zod';

const MAX_LENGTH = 64;
const WORD_PATTERN = /^[A-Za-z][A-Za-z'\- ]*$/;

// バックエンドの WordText は「raw の長さ」と「正規化後の文字種」を検証する。
// クライアントも同じ順序で揃える: まず入力そのものの長さ、次に trim + 小文字化した値の形。
// trim を挟まずに正規表現を当てると、前後に空白のある入力を誤って弾いてしまう。
const schema = z
  .string()
  .min(1, '英単語を入力してください。')
  .max(MAX_LENGTH, `${MAX_LENGTH}文字以内で入力してください。`)
  .transform((raw) => raw.trim().toLowerCase())
  .refine((value) => value.length >= 1, { message: '英単語を入力してください。' })
  .refine((value) => WORD_PATTERN.test(value), {
    message: '英字で入力してください(アポストロフィ・ハイフン・スペースのみ使用可)。',
  });

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
    return new WordInput(schema.parse(raw));
  }

  /** react-hook-form の zodResolver に渡すためのスキーマ。 */
  static get schema() {
    return schema;
  }
}
