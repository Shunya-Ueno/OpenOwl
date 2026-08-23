import { describe, it, expect } from 'vitest';
import { WordInput, InvalidWordInputError } from './WordInput';

/**
 * クライアント側の検証はサーバー側の Term と同じ規則でなければならない
 * (docs/frontend-design.md 7.2)。ずれると、ボタンを押せたのに 400 が返る
 * （またはその逆で無駄なリクエストが飛ぶ）ことになる。
 *
 * backend の Term.test.ts と対になるテスト。両者の期待値を意図的に揃えてある。
 */
describe('WordInput.parse', () => {
  it('正規化は trim → 連続空白の圧縮 の順に効き、normalizedText は小文字になる', () => {
    const input = WordInput.parse('   Give   UP  ');

    expect(input.displayText).toBe('Give UP');
    expect(input.normalizedText).toBe('give up');
  });

  it('許可された記号(アポストロフィ・ハイフン・スペース)を通す', () => {
    for (const word of ["don't", 'well-known', 'give up', "mother-in-law's"]) {
      expect(WordInput.parse(word).normalizedText).toBe(word.toLowerCase());
    }
  });

  it('英字以外を含む入力を拒否する', () => {
    for (const word of ['improve1', '日本語', '<script>', 'improve; DROP TABLE terms']) {
      expect(() => WordInput.parse(word)).toThrow(InvalidWordInputError);
    }
  });

  it('先頭が英字でない入力を拒否する', () => {
    for (const word of ['-improve', "'improve"]) {
      expect(() => WordInput.parse(word)).toThrow(InvalidWordInputError);
    }
  });

  it('空文字・空白のみを拒否する', () => {
    for (const word of ['', '   ', '\t\n']) {
      expect(() => WordInput.parse(word)).toThrow(InvalidWordInputError);
    }
  });

  it('64 文字が境界(64 は通り 65 は落ちる)', () => {
    expect(WordInput.parse('a'.repeat(64)).normalizedText).toBe('a'.repeat(64));
    expect(() => WordInput.parse('a'.repeat(65))).toThrow(InvalidWordInputError);
  });

  it('長さ判定は trim 後に行う', () => {
    expect(WordInput.parse(`   ${'a'.repeat(64)}   `).normalizedText).toBe('a'.repeat(64));
  });

  it('改行は空白に潰れる(サーバー側 Term と同じ挙動)', () => {
    expect(WordInput.parse('improve\nreduce').normalizedText).toBe('improve reduce');
  });
});

describe('WordInput.validationError', () => {
  it('妥当な入力では null を返す', () => {
    expect(WordInput.validationError('improve')).toBeNull();
  });

  it('不正な入力では画面にそのまま出せる日本語を返す', () => {
    const message = WordInput.validationError('improve1');

    expect(message).not.toBeNull();
    expect(typeof message).toBe('string');
    expect(message?.length).toBeGreaterThan(0);
  });

  it('理由ごとに異なるメッセージを返す', () => {
    const empty = WordInput.validationError('');
    const tooLong = WordInput.validationError('a'.repeat(65));
    const badChars = WordInput.validationError('improve1');

    expect(new Set([empty, tooLong, badChars]).size).toBe(3);
  });
});
