# API 仕様（Edge Functions）

**このドキュメントがフロントエンドとバックエンドの契約の単一の正です**（[ADR-0002](./adr/0002-shared-types-deferred.md)）。
仕様を変更する PR では、フロント・バック両方の型定義を同一 PR で更新してください。

- ベース URL: `https://<project-ref>.supabase.co/functions/v1`
- 認証: すべてのエンドポイントで `Authorization: Bearer <supabase access token>` が必須
- リクエスト/レスポンスの形式: `application/json`（UTF-8）
- フィールド命名: JSON は `camelCase`（DB の `snake_case` は Edge Function 内で変換する）

## エンドポイント一覧

| メソッド | パス | 概要 | 認証 |
| --- | --- | --- | --- |
| `POST` | `/generate-synonyms` | 単語の類義語を生成（またはキャッシュから取得）して返す | 必須 |
| `OPTIONS` | `/generate-synonyms` | CORS プリフライト | 不要 |
| `POST` | `/delete-account` | 自分のアカウントを削除する | 必須 |
| `OPTIONS` | `/delete-account` | CORS プリフライト | 不要 |

検索履歴の取得など、RLS で保護できる読み取りは Edge Function を作らず
**PostgREST に直接問い合わせます**（[ADR-0004](./adr/0004-edge-functions-for-privileged-ops.md)）。
アカウント削除は RLS では表現できない特権操作（`auth.users` の削除は service_role が必要）のため
Edge Function にしています。

---

## `POST /generate-synonyms`

英単語を1つ受け取り、類義語のリストを返します。
同じ単語の生成結果が有効期間内に存在する場合は、LLM を呼ばずにキャッシュを返します。

### リクエスト

```http
POST /functions/v1/generate-synonyms HTTP/1.1
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "word": "happy",
  "language": "en"
}
```

| フィールド | 型 | 必須 | 既定値 | 制約 |
| --- | --- | --- | --- | --- |
| `word` | `string` | ✅ | — | 1〜64文字。`^[A-Za-z][A-Za-z'\- ]*$` にマッチすること。前後の空白は除去され、小文字化して扱われる |
| `language` | `string` | — | `"en"` | ISO 639-1。**MVP は `"en"` のみ対応**。それ以外は 400 |

- **ユーザー識別子はリクエストに含めません。** サーバは JWT から取得します（偽装防止）。
- `forceRefresh` のような再生成フラグは**設けません**。
  キャッシュの鮮度は `prompt_version` / `model` / TTL で管理し、
  ユーザー操作で LLM 呼び出しを増やせる口を作らないためです（コスト管理）。

### レスポンス（200 OK）

```json
{
  "requestId": "0c7a1f2e-2d1a-4a2f-9f0f-2b3c4d5e6f70",
  "word": {
    "id": "8f14e45f-ceea-467a-9c0f-6a3f4c2b1d90",
    "text": "happy",
    "language": "en"
  },
  "source": "generated",
  "generationId": "b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "generatedAt": "2026-08-16T04:21:33.120Z",
  "synonyms": [
    {
      "id": "1d2e3f40-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
      "sortOrder": 1,
      "term": "joyful",
      "partOfSpeech": "adjective",
      "definition": "喜びに満ちた",
      "nuance": "happy より感情の強さが大きく、書き言葉寄り"
    },
    {
      "id": "2e3f4051-6b7c-4d8e-9f0a-1b2c3d4e5f60",
      "sortOrder": 2,
      "term": "content",
      "partOfSpeech": "adjective",
      "definition": "満ち足りた",
      "nuance": "高揚ではなく、静かな満足を表す"
    }
  ],
  "usage": {
    "dailyLimit": 30,
    "remainingToday": 27
  }
}
```

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `requestId` | `string (uuid)` | この呼び出しの識別子。ログと突き合わせるためクライアントはエラー表示時に保持する |
| `word.id` | `string (uuid)` | `words.id`。将来の単語帳で参照する |
| `word.text` | `string` | 正規化後の単語 |
| `word.language` | `string` | 言語コード |
| `source` | `"generated" \| "cache"` | LLM を呼んだか、既存結果を再利用したか |
| `generationId` | `string (uuid)` | `synonym_generations.id` |
| `generatedAt` | `string (ISO 8601)` | 生成時刻（キャッシュの場合は元の生成時刻） |
| `synonyms` | `Synonym[]` | 3〜8件。`sortOrder` 昇順 |
| `synonyms[].partOfSpeech` | `"noun"\|"verb"\|"adjective"\|"adverb"\|"other" \| null` | 品詞 |
| `synonyms[].definition` | `string` | 学習者向けの短い語義（日本語） |
| `synonyms[].nuance` | `string` | 元の単語との使い分け（日本語） |
| `usage.dailyLimit` | `number` | 1日あたりの生成上限 |
| `usage.remainingToday` | `number` | 本日の残り回数。UI に残量を出すために返す |

### エラーレスポンス

すべてのエラーは同一のエンベロープで返します。

```json
{
  "error": {
    "code": "rate_limited",
    "message": "本日の生成上限に達しました。",
    "retryable": true,
    "retryAfterSeconds": 1800,
    "requestId": "0c7a1f2e-2d1a-4a2f-9f0f-2b3c4d5e6f70"
  }
}
```

| HTTP | `code` | `retryable` | 発生条件 |
| --- | --- | --- | --- |
| 400 | `invalid_request` | ❌ | JSON が不正、`word` が未指定・文字種違反・長すぎる |
| 400 | `unsupported_language` | ❌ | `language` が `"en"` 以外 |
| 401 | `unauthorized` | ❌ | `Authorization` ヘッダなし、JWT が無効・期限切れ |
| 405 | `method_not_allowed` | ❌ | `POST` / `OPTIONS` 以外 |
| 422 | `not_a_known_word` | ❌ | LLM が「英単語として認識できない」と判断した |
| 429 | `rate_limited` | ✅ | 1日 or 毎分の上限超過。`retryAfterSeconds` を必ず含む |
| 502 | `llm_output_truncated` | ❌ | LLM の出力がトークン上限に達して途中で切れた。同じ入力では決定的に再発するためリトライしない |
| 502 | `llm_invalid_response` | ✅ | LLM の応答がスキーマに適合しない |
| 503 | `llm_unavailable` | ✅ | LLM 側の 5xx / 429、ネットワーク到達不可 |
| 504 | `llm_timeout` | ✅ | LLM 呼び出しがタイムアウト（既定 10 秒） |
| 500 | `internal_error` | ✅ | 上記以外（DB エラー等） |

- `rate_limited` は「1日の上限」と「毎分のバースト」の両方で返りますが、`message` は
  どちらの上限に当たったかで文言が変わります（`retryAfterSeconds` も 60 秒程度 / 数時間と大きく異なる）。
  クライアントは `message` をそのまま表示し、`retryAfterSeconds` で待機時間を出してください。
- `message` は**そのままユーザーに表示できる日本語**にします。
  ただし内部の詳細（スタックトレース、外部 API の生エラー）は含めません。
- `retryable: false` のエラーをクライアントが自動リトライすることは禁止です
  （トークン・API 呼び出しの無駄になるため）。
- クライアント側の表示文言とフォールバック動作は [`error-handling.md`](./error-handling.md) を参照。

### CORS

```
Access-Control-Allow-Origin: <許可オリジン>
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Max-Age: 86400
```

`OPTIONS` には `204` を返します。

### 呼び出し例

**supabase-js（フロントエンド）**

```ts
const { data, error } = await supabase.functions.invoke<GenerateSynonymsResponse>(
  'generate-synonyms',
  { body: { word: input } },
);
```

`supabase.functions.invoke` は現在のセッションの access token を自動で付与します。

**curl（動作確認用）**

```bash
curl -X POST "$SUPABASE_URL/functions/v1/generate-synonyms" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"word":"happy"}'
```

---

## `POST /delete-account`

自分のアカウントを完全に削除します。確認ダイアログはクライアント側の責務です。

### リクエスト

```http
POST /functions/v1/delete-account HTTP/1.1
Authorization: Bearer <access_token>
```

本文はありません。**削除対象は常に JWT から取得したユーザー自身**で、
リクエストボディで別のユーザーIDを指定することはできません。

### レスポンス（204 No Content）

本文なし。成功時、以下がサーバ側で連鎖的に削除されます（`db-schema.md` の `on delete cascade`）。

- `auth.users` の当該行
- `profiles`（1:1）
- `search_history`（そのユーザーの検索履歴すべて）

`words` / `synonym_generations` / `synonyms` はユーザーに紐づかない共有辞書データのため、
**削除されません**（他ユーザーのキャッシュとして残り続ける、意図的な設計）。

クライアントは 204 を受け取ったら、自分のセッションを明示的に `signOut` してください。
サーバ側でユーザーが消えても、手元のアクセストークンは自動では失効通知されません。

### エラーレスポンス

`generate-synonyms` と同じエンベロープ形式を使います。

| HTTP | `code` | `retryable` | 発生条件 |
| --- | --- | --- | --- |
| 401 | `unauthorized` | ❌ | `Authorization` ヘッダなし、JWT が無効・期限切れ |
| 405 | `method_not_allowed` | ❌ | `POST` / `OPTIONS` 以外 |
| 500 | `internal_error` | ✅ | Auth Admin API の呼び出し失敗など |

### CORS

`generate-synonyms` と同じ設定です（[上記参照](#cors)）。

### 呼び出し例

**supabase-js（フロントエンド）**

```ts
const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
if (!error) {
  await supabase.auth.signOut();
}
```

---

## 読み取り系（Edge Function を作らない操作）

以下は RLS で保護されるため、クライアントから `supabase-js` で直接問い合わせます。

### 検索履歴の取得

```ts
const { data } = await supabase
  .from('search_history')
  .select(`
    id,
    raw_input,
    outcome,
    created_at,
    words ( id, text, language ),
    synonym_generations (
      id,
      created_at,
      synonyms ( id, sort_order, term, part_of_speech, definition, nuance )
    )
  `)
  .neq('outcome', 'failed')
  .order('created_at', { ascending: false })
  .limit(20);
```

`user_id` の絞り込みは書きません。**RLS が自動的に自分の行だけに限定します。**

### プロフィールの取得・更新

```ts
await supabase.from('profiles').select('*').single();
await supabase.from('profiles').update({ display_name: name }).eq('id', userId);
```

## バージョニング方針

- **後方互換な変更（フィールド追加）はそのまま行う。** クライアントは未知のフィールドを無視すること。
- **破壊的変更が必要な場合は新しい Function 名**（例: `generate-synonyms-v2`）としてデプロイし、
  旧版は移行完了まで残す。モバイルアプリは古いバージョンが端末に残り続けるため、
  エンドポイントを一斉に切り替えることはできない。
- エラーコードは追加のみ。既存コードの意味を変えない。
