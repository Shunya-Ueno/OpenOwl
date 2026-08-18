import { assert, assertEquals } from '@std/assert';
import { z } from 'zod';
import { TestEnv } from './support/TestEnv.ts';
import { TestUser } from './support/TestUser.ts';
import { SynonymsApi, expectErrorEnvelope } from './support/SynonymsApi.ts';
import {
  WORD_MAX_LENGTH,
  WORD_PATTERN,
} from '../supabase/functions/_shared/domain/model/WordText.ts';
import {
  ALLOWED_HEADERS,
  ALLOWED_METHODS,
} from '../supabase/functions/_shared/http/CorsHandler.ts';

/**
 * generate-synonyms の契約(docs/api-spec.md)を実サービスに対して検証する。
 *
 * **LLM を実際に呼ぶのは「成功パス」のテストだけ**。他は LLM に到達する前に
 * 弾かれる経路か、キャッシュに当たる経路(docs/testing/e2e-strategy.md)。
 */

const env = TestEnv.load();
const api = new SynonymsApi(env);
const admin = env.adminClient();

// 生成パスを毎回通すための固定単語。テスト前に既存の生成結果を消して
// 必ず新規生成させる(モックではなく、テストデータの管理)。
const GENERATION_TEST_WORD = 'happy';

// 応答は外部入力として unknown で受け、検証で絞り込む(CLAUDE.md の規約)。
// as キャストで絞ると、形が崩れたときにアサーション失敗ではなく
// 実行時例外になり、原因の切り分けが遠回りになる。
const successResponseSchema = z.object({
  requestId: z.string().min(1),
  word: z.object({ id: z.string(), text: z.string(), language: z.string() }),
  source: z.enum(['generated', 'cache']),
  generationId: z.string().min(1),
  generatedAt: z.string().min(1),
  synonyms: z.array(
    z.object({
      id: z.string().min(1),
      sortOrder: z.number(),
      term: z.string().min(1),
      partOfSpeech: z.string().nullable(),
      definition: z.string(),
      nuance: z.string(),
    }),
  ),
  usage: z.object({ dailyLimit: z.number(), remainingToday: z.number() }),
});

function expectSuccess(body: unknown): z.infer<typeof successResponseSchema> {
  const parsed = successResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(`応答が api-spec.md の形と一致しません: ${JSON.stringify(body)}`);
  }
  return parsed.data;
}

async function clearGenerationsFor(word: string): Promise<void> {
  const { data } = await admin
    .from('words')
    .select('id')
    .eq('text', word)
    .eq('language', 'en')
    .maybeSingle();
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

    const body = expectSuccess(res.body);
    assertEquals(body.source, 'generated', 'キャッシュが残っており生成パスを通っていない');
    assertEquals(body.word.text, GENERATION_TEST_WORD);
    assertEquals(body.word.language, 'en');

    // LLM の出力は非決定的なため、特定の語ではなく「構造」を検証する
    // (docs/adr/0006-no-mocks-testing-policy.md)。
    assert(body.synonyms.length >= 3, `類義語が少なすぎる: ${body.synonyms.length}`);
    for (const [index, synonym] of body.synonyms.entries()) {
      assertEquals(synonym.sortOrder, index + 1, 'sortOrder が昇順で連番になっていない');
      // 単語の形は本体の WORD_PATTERN を再利用する(許可文字を広げたときに
      // テスト側の複製が取り残されて偽の失敗を出すのを防ぐ)。
      assert(WORD_PATTERN.test(synonym.term), `term が単語の形ではない: ${synonym.term}`);
      assert(synonym.term.length <= WORD_MAX_LENGTH);
      assert(synonym.definition.length > 0);
      assert(synonym.nuance.length > 0);
    }

    assert(body.usage.remainingToday < body.usage.dailyLimit, '残り回数が減っていない');
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
    const firstBody = expectSuccess(first.body);

    const second = await api.generate(user.accessToken, { word: GENERATION_TEST_WORD });
    assertEquals(second.status, 200);
    const secondBody = expectSuccess(second.body);

    assertEquals(secondBody.source, 'cache', 'キャッシュが効いていない(コスト削減の要が壊れている)');
    assertEquals(
      secondBody.generationId,
      firstBody.generationId,
      '同じ生成結果が再利用されていない',
    );
  } finally {
    await user.destroy();
  }
});

Deno.test('入力の正規化: 大文字・前後の空白は同じ単語として扱われる', async () => {
  const user = await TestUser.create(env);
  try {
    const res = await api.generate(user.accessToken, {
      word: `  ${GENERATION_TEST_WORD.toUpperCase()}  `,
    });
    assertEquals(res.status, 200, `想定外の応答: ${JSON.stringify(res.body)}`);
    assertEquals(expectSuccess(res.body).word.text, GENERATION_TEST_WORD, '正規化されていない');
  } finally {
    await user.destroy();
  }
});

Deno.test('不正な単語は LLM に到達する前に 400 で拒否される', async () => {
  const user = await TestUser.create(env);
  const invalidWords = ['', '   ', '123', '日本語', 'a'.repeat(WORD_MAX_LENGTH + 1), 'hello!'];
  try {
    // どれも LLM に到達しない読み取り専用の経路なので、直列にする理由がない。
    const results = await Promise.all(
      invalidWords.map((word) => api.generate(user.accessToken, { word })),
    );

    for (const [index, res] of results.entries()) {
      const invalid = invalidWords[index];
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

Deno.test('未認証・無効なトークンは 401 unauthorized', async () => {
  for (const token of [null, 'invalid-token']) {
    const res = await api.generate(token, { word: 'happy' });
    assertEquals(res.status, 401, `token=${token} が 401 になっていない`);
    assertEquals(expectErrorEnvelope(res.body).code, 'unauthorized');
  }
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
  // 本体の定数と完全一致で比べる。includes で部分一致にすると、
  // 許可メソッド/ヘッダが削られる回帰(CORS が壊れる)を検出できない。
  assertEquals(res.headers.get('access-control-allow-methods'), ALLOWED_METHODS);
  assertEquals(res.headers.get('access-control-allow-headers'), ALLOWED_HEADERS);
});

Deno.test('クライアントが送る user_id は無視される(なりすまし防止)', async () => {
  const [actor, victim] = await Promise.all([TestUser.create(env), TestUser.create(env)]);
  try {
    // actor のトークンで、victim の id を詐称して送る。
    const res = await api.generate(actor.accessToken, {
      word: GENERATION_TEST_WORD,
      user_id: victim.id,
      userId: victim.id,
    });
    assertEquals(res.status, 200);

    // 履歴は必ず JWT のユーザー(actor)側に記録される。
    const { data: victimHistory } = await admin
      .from('search_history')
      .select('id')
      .eq('user_id', victim.id);
    assertEquals(victimHistory?.length ?? 0, 0, 'ボディの user_id が信用されている(なりすまし可能)');

    const { data: actorHistory } = await admin
      .from('search_history')
      .select('id')
      .eq('user_id', actor.id);
    assert((actorHistory?.length ?? 0) > 0, '認証済みユーザー側に履歴が記録されていない');
  } finally {
    await Promise.all([actor.destroy(), victim.destroy()]);
  }
});
