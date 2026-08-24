import assert from 'node:assert/strict';
import { generateSynonymsRequestSchema } from './RequestSchema.ts';

// docs/api-spec.md 3.1。既定値と「未知フィールドは無視」を固定する。

Deno.test('RequestSchema: word だけで通り、残りは既定値が入る', () => {
  const parsed = generateSynonymsRequestSchema.parse({ word: 'improve' });

  assert.deepStrictEqual(parsed.word, 'improve');
  assert.deepStrictEqual(parsed.language, 'en');
  assert.deepStrictEqual(parsed.maxResults, 8);
  assert.deepStrictEqual(parsed.forceRefresh, false);
});

Deno.test('RequestSchema: 未知フィールドは無視する(strict にしない)', () => {
  const parsed = generateSynonymsRequestSchema.parse({
    word: 'improve',
    // クライアントが送ってきても、user_id は決してここから読まない
    // (docs/security.md 1: ユーザー ID は JWT の検証結果から決める)。
    userId: '00000000-0000-0000-0000-000000000000',
    unknownField: true,
  });

  assert.deepStrictEqual('userId' in parsed, false);
  assert.deepStrictEqual('unknownField' in parsed, false);
});

Deno.test('RequestSchema: maxResults は 1〜12 の整数', () => {
  assert.deepStrictEqual(
    generateSynonymsRequestSchema.parse({ word: 'a', maxResults: 1 }).maxResults,
    1,
  );
  assert.deepStrictEqual(
    generateSynonymsRequestSchema.parse({ word: 'a', maxResults: 12 }).maxResults,
    12,
  );

  for (const maxResults of [0, 13, 1.5, -1]) {
    assert.deepStrictEqual(
      generateSynonymsRequestSchema.safeParse({ word: 'a', maxResults }).success,
      false,
      `maxResults=${maxResults} は拒否されるべき`,
    );
  }
});

Deno.test('RequestSchema: word が無い / 文字列でない場合は失敗する', () => {
  for (const body of [{}, { word: 123 }, { word: null }, { word: ['improve'] }]) {
    assert.deepStrictEqual(generateSynonymsRequestSchema.safeParse(body).success, false);
  }
});

Deno.test('RequestSchema: forceRefresh は真偽値のみ', () => {
  assert.deepStrictEqual(
    generateSynonymsRequestSchema.parse({ word: 'a', forceRefresh: true }).forceRefresh,
    true,
  );
  assert.deepStrictEqual(
    generateSynonymsRequestSchema.safeParse({ word: 'a', forceRefresh: 'true' }).success,
    false,
  );
});

Deno.test('RequestSchema: word の中身の妥当性はここでは見ない(Term が見る)', () => {
  // スキーマは形だけを保証し、文字種・長さの検証は Term.fromInput に一本化してある。
  // 正規化規則の置き場所を 2 つにしないため(docs/db-schema.md 3.2)。
  assert.deepStrictEqual(generateSynonymsRequestSchema.safeParse({ word: '日本語' }).success, true);
});
