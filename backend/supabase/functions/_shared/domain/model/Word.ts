/** 辞書に登録された単語(words テーブルの1行に対応)。 */
export class Word {
  constructor(
    readonly id: string,
    readonly text: string,
    readonly language: string,
  ) {}
}
