import { assertEquals, assert } from '@std/assert';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/functions/_shared/infrastructure/supabase/database.types.ts';
import { TestEnv } from './support/TestEnv.ts';
import { TestUser } from './support/TestUser.ts';
import { SynonymsApi, expectErrorEnvelope } from './support/SynonymsApi.ts';

/**
 * generate-synonyms の契約(docs/api-spec.md)を実サービスに対して検証する。
 *
 * **LLM を実際に呼ぶのは「成功パス」のテストだけ**。他は LLM に到達する前に
 * 弾かれる経路か、キャッシュに当たる経路(docs/testing/e2e-strategy.md)。
 */

const env = TestEnv.load();
const api = new SynonymsApi(env);
const admin = createClient<Database>(env.supabaseUrl, env.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 生成パスを毎回通すための固定単語。テスト前に既存の生成結果を消して
// 必ず新規生成させる(モックではなく、テストデータの管理)。
const GENERATION_TEST_WORD = 'happy';

async function clearGenerationsFor(word: string): Promise<void> {
  const { data } = await admin.from('words').select('id').eq('text', word).eq('language', 'en').maybeSingle();
  if (!data) return;
  // synonyms は on delete cascade で一緒に消える。
  await admin.from('synonym_generations').delete().eq('word_id', data.id);
}

Deno.test('成功パス: 実際に Gemini を呼び、api-spec どおりの応答を返す', async () => {
  const user = await TestUser.create(env);
  try {
    await clearGenerationsFor(GENERATION_TEST_WORD);

    const res = await api.generate(user.accessToken, { word: GENERATION_TEST_WORD });
    assertEquals(res.status, 200, `想定外の応答: ${JSON.stringify(res.body)}`);

    const body = res.body as Record<string, unknown>;
    assertEquals(body.source, 'generated', 'キャッシュが残っており生成パスを通っていない');
    assert(typeof body.requestId === 'string');
    assert(typeof body.generationId === 'string');
    assert(typeof body.generatedAt === 'string');

    const word = body.word as Record<string, unknown>;
    assertEquals(word.text, GENERATION_TEST_WORD);
    assertEquals(word.language, 'en');

    // LLM の出力は非決定的なため、特定の語ではなく「構造」を検証する
    // (docs/adr/0006-no-mocks-testing-policy.md)。
    const synonyms = body.synonyms as Record<string, unknown>[];
    assert(Array.isArray(synonyms) && synonyms.length >= 3, `類義語が少なすぎる: ${synonyms?.length}`);
    for (const [index, synonym] of synonyms.entries()) {
      assert(typeof synonym.id === 'string', 'synonyms[].id は必須(api-spec.md)');
      assertEquals(synonym.sortOrder, index + 1, 'sortOrder が昇順で連番になっていない');
      assert(typeof synonym.term === 'string' && /^[A-Za-z][A-Za-z'\- ]*$/.test(synonym.term as string));
      assert(typeof synonym.definition === 'string' && (synonym.definition as string).length > 0);
      assert(typeof synonym.nuance === 'string' && (synonym.nuance as string).length > 0);
    }

    const usage = body.usage as Record<string, unknown>;
    assert(typeof usage.dailyLimit === 'number' && typeof usage.remainingToday === 'number');
    assert((usage.remainingToday as number) < (usage.dailyLimit as number), '残り回数が減っていない');
  } finally {
    await user.destroy();
  }
});

Deno.test('2回目の同じ単語は source: "cache" になり LLM を呼ばない', async () => {
  const user = await TestUser.create(env);
  try {
    // 1回目でキャッシュを温める(既に温まっていればそのまま使う)。
    const first = await api.generate(user.accessToken, { word: GENERATION_TEST_WORD });
    assertEquals(first.status, 200);

    const second = await api.generate(user.accessToken, { word: GENERATION_TEST_WORD });
    assertEquals(second.status, 200);

    const body = second.body as Record<string, unknown>;
    assertEquals(body.source, 'cache', 'キャッシュが効いていない(コスト削減の要が壊れている)');
    assertEquals(
      (body as { generationId: string }).generationId,
      (first.body as { generationId: string }).generationId,
      '同じ生成結果が再利用されていない',
    );
  } finally {
    await user.destroy();
  }
});

Deno.test('入力の正規化: 大文字・前後の空白は同じ単語として扱われる', async () => {
  const user = await TestUser.create(env);
  try {
    const res = await api.generate(user.accessToken, { word: `  ${GENERATION_TEST_WORD.toUpperCase()}  ` });
    assertEquals(res.status, 200, `想定外の応答: ${JSON.stringify(res.body)}`);
    const word = (res.body as { word: Record<string, unknown> }).word;
    assertEquals(word.text, GENERATION_TEST_WORD, '正規化されていない');
  } finally {
    await user.destroy();
  }
});

Deno.test('不正な単語は LLM に到達する前に 400 で拒否される', async () => {
  const user = await TestUser.create(env);
  try {
    for (const invalid of ['', '   ', '123', '日本語', 'a'.repeat(65), 'hello!']) {
      const res = await api.generate(user.accessToken, { word: invalid });
      assertEquals(res.status, 400, `"${invalid}" が 400 で拒否されていない`);
      const error = expectErrorEnvelope(res.body);
      assertEquals(error.code, 'invalid_request');
      assertEquals(error.retryable, false, '不正入力を retryable にしてはいけない(無駄な再送を招く)');
    }
  } finally {
    await user.destroy();
  }
});

Deno.test('対応していない言語は 400 unsupported_language', async () => {
  const user = await TestUser.create(env);
  try {
    const res = await api.generate(user.accessToken, { word: 'happy', language: 'ja' });
    assertEquals(res.status, 400);
    assertEquals(expectErrorEnvelope(res.body).code, 'unsupported_language');
  } finally {
    await user.destroy();
  }
});

Deno.test('未認証は 401 unauthorized', async () => {
  const res = await api.generate(null, { word: 'happy' });
  assertEquals(res.status, 401);
  assertEquals(expectErrorEnvelope(res.body).code, 'unauthorized');
});

Deno.test('無効なトークンは 401 unauthorized', async () => {
  const res = await api.generate('invalid-token', { word: 'happy' });
  assertEquals(res.status, 401);
  assertEquals(expectErrorEnvelope(res.body).code, 'unauthorized');
});

Deno.test('POST / OPTIONS 以外は 405', async () => {
  const user = await TestUser.create(env);
  try {
    const res = await api.generate(user.accessToken, { word: 'happy' }, 'GET');
    assertEquals(res.status, 405);
    assertEquals(expectErrorEnvelope(res.body).code, 'method_not_allowed');
  } finally {
    await user.destroy();
  }
});

Deno.test('CORS プリフライトは 204 で必要なヘッダを返す', async () => {
  // verify_jwt = false にした判断(docs/security.md)が効いているかの確認でもある。
  // ランタイム層で JWT を検証していると、Authorization を持たない OPTIONS が 401 になる。
  const res = await api.preflight();
  assertEquals(res.status, 204, 'プリフライトが 204 で返っていない');
  assert(res.headers.get('access-control-allow-origin') !== null);
  assert((res.headers.get('access-control-allow-methods') ?? '').includes('POST'));
  assert((res.headers.get('access-control-allow-headers') ?? '').includes('authorization'));
});

Deno.test('クライアントが送る user_id は無視される(なりすまし防止)', async () => {
  const userA = await TestUser.create(env);
  const userB = await TestUser.create(env);
  try {
    // A のトークンで、B の id を詐称して送る。
    const res = await api.generate(userA.accessToken, {
      word: GENERATION_TEST_WORD,
      user_id: userB.id,
      userId: userB.id,
    });
    assertEquals(res.status, 200);

    // 履歴は必ず JWT のユーザー(A)側に記録される。
    const { data: bHistory } = await admin
      .from('search_history')
      .select('id')
      .eq('user_id', userB.id);
    assertEquals(bHistory?.length ?? 0, 0, 'ボディの user_id が信用されている(なりすまし可能)');

    const { data: aHistory } = await admin
      .from('search_history')
      .select('id')
      .eq('user_id', userA.id);
    assert((aHistory?.length ?? 0) > 0, '認証済みユーザー側に履歴が記録されていない');
  } finally {
    await userA.destroy();
    await userB.destroy();
  }
});
