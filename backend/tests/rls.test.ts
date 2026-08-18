import { assertEquals, assert } from '@std/assert';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/functions/_shared/infrastructure/supabase/database.types.ts';
import { TestEnv } from './support/TestEnv.ts';
import { TestUser } from './support/TestUser.ts';

/**
 * docs/security.md の「RLS の検証」6項目を実 DB に対して確認する。
 *
 * このプロジェクトの認可の根拠は RLS であり(docs/adr/0004)、
 * ここが破れると全ユーザーの検索履歴が漏れる。**LLM を呼ばないので実行コストはゼロ**。
 */

const env = TestEnv.load();
const admin = createClient<Database>(env.supabaseUrl, env.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** ユーザーA・Bを作り、A に履歴を1件だけ service role で書き込む。 */
async function setupTwoUsers() {
  const userA = await TestUser.create(env);
  const userB = await TestUser.create(env);

  // 履歴は Edge Function 経由でしか作れない(INSERT ポリシーがない)ため、
  // RLS の読み取り検証用のデータは service role で用意する。
  const { data: word, error: wordError } = await admin
    .from('words')
    .upsert({ text: 'rlsprobe', language: 'en' }, { onConflict: 'language,text' })
    .select('id')
    .single();
  if (wordError || !word) throw new Error(`単語の準備に失敗: ${wordError?.message}`);

  const { error: historyError } = await admin.from('search_history').insert({
    user_id: userA.id,
    word_id: word.id,
    raw_input: 'rlsprobe',
    outcome: 'cache',
  });
  if (historyError) throw new Error(`履歴の準備に失敗: ${historyError.message}`);

  return { userA, userB, wordId: word.id };
}

Deno.test('RLS: 自分の検索履歴は読める', async () => {
  const { userA, userB } = await setupTwoUsers();
  try {
    const { data, error } = await userA.client(env).from('search_history').select('id, raw_input');
    assertEquals(error, null);
    assert(data !== null && data.length >= 1, '自分の履歴が読めていない(締めすぎ)');
  } finally {
    await userA.destroy();
    await userB.destroy();
  }
});

Deno.test('RLS: 他ユーザーの検索履歴は1件も見えない', async () => {
  const { userA, userB } = await setupTwoUsers();
  try {
    const { data, error } = await userB.client(env).from('search_history').select('id');
    assertEquals(error, null);
    assertEquals(data?.length, 0, 'B から A の履歴が見えている(重大な漏洩)');
  } finally {
    await userA.destroy();
    await userB.destroy();
  }
});

Deno.test('RLS: search_history に自分では INSERT できない', async () => {
  const { userA, userB, wordId } = await setupTwoUsers();
  try {
    // ここを許すとレート制限のカウントを自由に操作できてしまう。
    const { error } = await userA.client(env).from('search_history').insert({
      user_id: userA.id,
      word_id: wordId,
      raw_input: 'forged',
      outcome: 'cache',
    });
    assert(error !== null, 'search_history に INSERT できてしまった');
  } finally {
    await userA.destroy();
    await userB.destroy();
  }
});

Deno.test('RLS: search_history を削除できない(クォータ回避の防止)', async () => {
  const { userA, userB } = await setupTwoUsers();
  try {
    const before = await userA.client(env).from('search_history').select('id');
    const countBefore = before.data?.length ?? 0;
    assert(countBefore > 0, '前提となる履歴が用意できていない');

    await userA.client(env).from('search_history').delete().neq('id', crypto.randomUUID());

    const after = await userA.client(env).from('search_history').select('id');
    assertEquals(after.data?.length, countBefore, '履歴が削除できてしまった');
  } finally {
    await userA.destroy();
    await userB.destroy();
  }
});

Deno.test('RLS: synonyms に INSERT できない(辞書データの汚染防止)', async () => {
  const userA = await TestUser.create(env);
  try {
    const { data: generation } = await admin
      .from('synonym_generations')
      .select('id')
      .limit(1)
      .maybeSingle();

    const { error } = await userA.client(env).from('synonyms').insert({
      generation_id: generation?.id ?? crypto.randomUUID(),
      sort_order: 99,
      term: 'forged',
    });
    assert(error !== null, 'synonyms に INSERT できてしまった');
  } finally {
    await userA.destroy();
  }
});

Deno.test('RLS: 他人の profiles は更新できない', async () => {
  const userA = await TestUser.create(env);
  const userB = await TestUser.create(env);
  try {
    const { data } = await userA
      .client(env)
      .from('profiles')
      .update({ display_name: 'hijacked' })
      .eq('id', userB.id)
      .select('id');

    assertEquals(data?.length ?? 0, 0, '他人の profiles を更新できてしまった');

    const { data: victim } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', userB.id)
      .single();
    assert(victim?.display_name !== 'hijacked', 'B の display_name が書き換えられている');
  } finally {
    await userA.destroy();
    await userB.destroy();
  }
});

Deno.test('RLS: anon では各テーブルを読めない', async () => {
  const anon = createClient<Database>(env.supabaseUrl, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const table of ['profiles', 'search_history', 'words', 'synonyms'] as const) {
    const { data, error } = await anon.from(table).select('*').limit(1);
    // 権限エラーになるか、少なくとも1行も返らないこと。
    const denied = error !== null || (data?.length ?? 0) === 0;
    assert(denied, `anon が ${table} を読めてしまった`);
  }
});
