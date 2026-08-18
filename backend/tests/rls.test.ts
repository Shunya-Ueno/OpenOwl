import { assert, assertEquals } from '@std/assert';
import { TestEnv } from './support/TestEnv.ts';
import { TestUser } from './support/TestUser.ts';
import { assertNotVisible, assertPermissionDenied } from './support/assertions.ts';

/**
 * docs/security.md の「RLS の検証」6項目を実 DB に対して確認する。
 *
 * このプロジェクトの認可の根拠は RLS であり(docs/adr/0004)、
 * ここが破れると全ユーザーの検索履歴が漏れる。**LLM を呼ばないので実行コストはゼロ**。
 */

const env = TestEnv.load();
const admin = env.adminClient();

interface Fixture {
  readonly wordId: string;
  readonly generationId: string;
}

/**
 * 辞書データ(words / synonym_generations / synonyms)を1件用意する。
 *
 * これらはユーザーに紐づかない共有データなので、テストごとに作り直さず
 * 使い回す(docs/testing/e2e-strategy.md のテストデータ方針)。
 */
async function ensureFixture(): Promise<Fixture> {
  const { data: word, error: wordError } = await admin
    .from('words')
    .upsert({ text: 'rlsprobe', language: 'en' }, { onConflict: 'language,text' })
    .select('id')
    .single();
  if (wordError || !word) throw new Error(`単語の準備に失敗: ${wordError?.message}`);

  const { data: existing } = await admin
    .from('synonym_generations')
    .select('id')
    .eq('word_id', word.id)
    .eq('status', 'succeeded')
    .limit(1)
    .maybeSingle();
  if (existing) return { wordId: word.id, generationId: existing.id };

  const { data: generation, error: generationError } = await admin
    .from('synonym_generations')
    .insert({
      word_id: word.id,
      model: 'test-fixture',
      prompt_version: 'test',
      status: 'succeeded',
    })
    .select('id')
    .single();
  if (generationError || !generation) {
    throw new Error(`生成記録の準備に失敗: ${generationError?.message}`);
  }
  return { wordId: word.id, generationId: generation.id };
}

/** 指定ユーザーに履歴を1件、service role で用意する(INSERT ポリシーがないため)。 */
async function giveHistoryTo(userId: string, fixture: Fixture): Promise<void> {
  const { error } = await admin.from('search_history').insert({
    user_id: userId,
    word_id: fixture.wordId,
    generation_id: fixture.generationId,
    raw_input: 'rlsprobe',
    outcome: 'cache',
  });
  if (error) throw new Error(`履歴の準備に失敗: ${error.message}`);
}

Deno.test('RLS: 自分の検索履歴は読める(締めすぎていないこと)', async () => {
  const fixture = await ensureFixture();
  const user = await TestUser.create(env);
  try {
    await giveHistoryTo(user.id, fixture);
    const { data, error } = await user.client.from('search_history').select('id, raw_input');
    assertEquals(error, null);
    assert((data?.length ?? 0) >= 1, '自分の履歴が読めていない(締めすぎ)');
  } finally {
    await user.destroy();
  }
});

Deno.test('RLS: 他ユーザーの検索履歴は1件も見えない', async () => {
  const fixture = await ensureFixture();
  const [owner, observer] = await Promise.all([TestUser.create(env), TestUser.create(env)]);
  try {
    await giveHistoryTo(owner.id, fixture);
    const result = await observer.client.from('search_history').select('id');
    assertNotVisible(result, '他ユーザーの履歴が見えている(重大な漏洩)');
  } finally {
    await Promise.all([owner.destroy(), observer.destroy()]);
  }
});

Deno.test('RLS: search_history に自分では INSERT できない', async () => {
  const fixture = await ensureFixture();
  const user = await TestUser.create(env);
  try {
    // ここを許すとレート制限のカウントを自由に操作できてしまう。
    const { error } = await user.client.from('search_history').insert({
      user_id: user.id,
      word_id: fixture.wordId,
      raw_input: 'forged',
      outcome: 'cache',
    });
    assertPermissionDenied(error, 'search_history への INSERT');
  } finally {
    await user.destroy();
  }
});

Deno.test('RLS: search_history を削除できない(クォータ回避の防止)', async () => {
  const fixture = await ensureFixture();
  const user = await TestUser.create(env);
  try {
    await giveHistoryTo(user.id, fixture);

    const before = await user.client.from('search_history').select('id');
    const countBefore = before.data?.length ?? 0;
    assert(countBefore > 0, '前提となる履歴が用意できていない');

    await user.client.from('search_history').delete().neq('id', crypto.randomUUID());

    const after = await user.client.from('search_history').select('id');
    assertEquals(after.data?.length, countBefore, '履歴が削除できてしまった');
  } finally {
    await user.destroy();
  }
});

Deno.test('RLS: synonyms に INSERT できない(辞書データの汚染防止)', async () => {
  const fixture = await ensureFixture();
  const user = await TestUser.create(env);
  try {
    // CHECK 制約(sort_order は 1..20)と FK を**満たす**値を使う。
    // 制約違反する値だと、権限が誤って開放されても制約エラーで拒否され、
    // テストが「正しい理由で」通らなくなる。
    const { error } = await user.client.from('synonyms').insert({
      generation_id: fixture.generationId,
      sort_order: 20,
      term: 'forged',
    });
    assertPermissionDenied(error, 'synonyms への INSERT');
  } finally {
    await user.destroy();
  }
});

Deno.test('RLS: 他人の profiles は更新できない', async () => {
  const [actor, victim] = await Promise.all([TestUser.create(env), TestUser.create(env)]);
  try {
    const { data } = await actor.client
      .from('profiles')
      .update({ display_name: 'hijacked' })
      .eq('id', victim.id)
      .select('id');

    assertEquals(data?.length ?? 0, 0, '他人の profiles を更新できてしまった');

    const { data: after } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', victim.id)
      .single();
    assert(after?.display_name !== 'hijacked', '被害者の display_name が書き換えられている');
  } finally {
    await Promise.all([actor.destroy(), victim.destroy()]);
  }
});

Deno.test('RLS: anon では各テーブルを読めない', async () => {
  const anon = env.anonClient();

  for (const table of ['profiles', 'search_history', 'words', 'synonyms'] as const) {
    const result = await anon.from(table).select('*').limit(1);
    assertNotVisible(result, `anon が ${table} を読めてしまった`);
  }
});
