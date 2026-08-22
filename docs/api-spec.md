# API 仕様

本ドキュメントが **API 契約の唯一の正典**（[ADR-0002](./adr/0002-no-shared-package-for-now.md)）。
frontend / backend の型定義はどちらもこの仕様の写像であり、
不一致が生じた場合は本ドキュメントを正とする。

## 1. API の分割方針

**書き込み・外部 API 呼び出しを伴う操作のみ Edge Function とし、読み取りは PostgREST を直接使う**
（[ADR-0009](./adr/0009-read-path-via-postgrest.md)）。

| 操作 | 経路 | 理由 |
| --- | --- | --- |
| 類義語生成 | Edge Function `POST /functions/v1/synonyms` | DeepSeek キーの秘匿、入力検証、レート制限、永続化 |
| 検索履歴の取得 | PostgREST（`supabase.from('lookups').select(...)`） | RLS が認可を担保する。Edge Function を挟む価値がない |
| プロフィール取得 / 更新 | PostgREST | 同上 |
| 認証 | Supabase Auth（`supabase.auth.*`） | 標準機能 |

**MVP の Edge Function は 1 本のみ。**

## 2. 共通仕様

### 2.1 ベース URL

```
https://<project-ref>.supabase.co/functions/v1
```

### 2.2 認証

すべてのエンドポイントで Supabase Auth の access token（JWT）が必須。

```
Authorization: Bearer <access_token>
Content-Type: application/json
apikey: <anon key>
```

Edge Function は JWT 検証を有効にしたうえで、
`Authorization` ヘッダから解決したユーザー ID を**常にサーバー側で決定する**。
リクエストボディに `userId` を含めることは許さない（なりすまし防止）。

### 2.3 CORS

`ALLOWED_ORIGINS` に列挙したオリジンのみを許可する（`*` は使わない）。

| 環境 | 許可オリジン |
| --- | --- |
| 本番 | `https://<本番ドメイン>` |
| テスト | `http://localhost:8081`, プレビュー用ドメイン |

ネイティブアプリからのリクエストには `Origin` が付かないため、
`Origin` が無い場合は CORS ヘッダを返さずそのまま処理する（ブラウザ以外は CORS の対象外）。
プリフライト（`OPTIONS`）には `204` を返す。

### 2.4 エラーレスポンスの共通形式

すべてのエラーは同じ形で返す。**HTTP ステータスだけで分岐させない**（同じ 4xx でも UX が異なるため）。

```jsonc
{
  "error": {
    "code": "rate_limited",          // 機械可読な識別子。分岐はこれで行う
    "message": "1 時間あたりの生成回数の上限に達しました。",  // ユーザーにそのまま表示可能
    "retryAfterSeconds": 480,        // 任意。再試行可能な場合のみ
    "details": { "limit": 60 }       // 任意。デバッグ用
  }
}
```

`message` は**ユーザーにそのまま表示できる日本語**とする。
内部の例外メッセージやスタックトレースを含めない（情報漏洩防止）。

### 2.5 エラーコード一覧

| `code` | HTTP | 発生条件 | 再試行 | クライアントの振る舞い（フォールバック UX） |
| --- | --- | --- | --- | --- |
| `invalid_request` | 400 | 単語が空 / 64 文字超 / 英字以外を含む / `maxResults` 範囲外 | ✗ | 入力欄にインラインエラーを表示。ボタンは押せる状態のまま |
| `unauthorized` | 401 | JWT 欠落・期限切れ・不正 | ✗ | セッション更新を 1 回試み、失敗ならログイン画面へ遷移 |
| `rate_limited` | 429 | ユーザーの時間あたり生成上限超過 | ✓ | `retryAfterSeconds` のカウントダウンを表示し、その間ボタンを無効化 |
| `upstream_rate_limited` | 429 | DeepSeek 側が 429 を返した | ✓ | 「混雑しています」＋再試行ボタン。自動再試行はしない |
| `upstream_timeout` | 504 | DeepSeek がタイムアウト | ✓ | 「時間がかかっています」＋再試行ボタン |
| `upstream_unavailable` | 502 | DeepSeek が 5xx / ネットワークエラー | ✓ | 「一時的に利用できません」＋再試行ボタン。**期限切れキャッシュがあれば §3.4 の縮退応答を返す** |
| `upstream_invalid_response` | 502 | DeepSeek の出力が JSON として解釈できない / スキーマ不一致 | △ | 「結果を取得できませんでした」＋再試行ボタン。ログに raw を残す |
| `internal_error` | 500 | 想定外の例外 | △ | 「エラーが発生しました」＋再試行ボタン |

「再試行 ✗」のエラーで自動再試行してはならない（同じ結果になり、コストだけが増える）。

## 3. `POST /functions/v1/synonyms`

英単語 1 語を受け取り、類義語を生成して返す。結果は DB に保存され、履歴に記録される。

### 3.1 リクエスト

```jsonc
{
  "word": "improve",        // 必須
  "language": "en",         // 任意。既定 "en"。MVP は "en" のみ許可
  "maxResults": 8,          // 任意。既定 8、範囲 1〜12
  "forceRefresh": false     // 任意。既定 false。true でキャッシュを無視して再生成
}
```

| フィールド | 型 | 必須 | 制約 |
| --- | --- | --- | --- |
| `word` | `string` | ✓ | trim 後 1〜64 文字。`^[A-Za-z][A-Za-z '\-]*$` に一致すること |
| `language` | `string` | — | `"en"` のみ |
| `maxResults` | `number` | — | 整数 1〜12 |
| `forceRefresh` | `boolean` | — | — |

**`word` の正規表現を厳格にする理由**は 2 つある。
1 つは**プロンプトインジェクション対策**（改行や記号を含む任意文字列を LLM に渡さない）、
もう 1 つは**コスト制御**（長文を投げてトークンを浪費させられない）。
`security.md` §3 も参照。

`forceRefresh` はユーザーが明示的に「別の候補を見る」を押したときのみ `true` にする。
既定で `true` にしてはならない（キャッシュ機構が無意味になり課金が増える）。

### 3.2 レスポンス（200）

```jsonc
{
  "term": {
    "id": "0f8e...",
    "text": "improve",        // display_text
    "language": "en"
  },
  "generation": {
    "id": "3b21...",
    "model": "deepseek-chat",
    "createdAt": "2026-08-22T04:11:09.482Z",
    "cached": true,           // 既存の生成結果を再利用したか
    "stale": false            // 期限切れキャッシュによる縮退応答か（§3.4）
  },
  "synonyms": [
    {
      "text": "enhance",
      "partOfSpeech": "verb",
      "register": "formal",
      "nuance": "既にあるものの質をさらに高めるときに使う。"
    },
    {
      "text": "refine",
      "partOfSpeech": "verb",
      "register": "neutral",
      "nuance": "細部を調整して洗練させるニュアンス。"
    }
  ]
}
```

| フィールド | 説明 |
| --- | --- |
| `generation.id` | 生成結果の ID。**永続化に失敗した場合は `null`**（§3.5 手順10の注記）。`null` の場合、この結果は履歴にもキャッシュにも残らない |
| `generation.cached` | `true` なら DeepSeek を呼んでいない（＝課金なし）。UI で「保存済みの結果」と示してもよい |
| `generation.stale` | `true` なら上流障害時の縮退応答。UI に「最新ではない可能性があります」を添える |
| `synonyms[].nuance` | ユーザーの `native_language`（既定 `ja`）で返る。`null` の場合がある |

`synonyms` は**関連の強い順**で並ぶ（`synonym_items.position` の昇順）。

### 3.3 レート制限

ユーザー単位で、**DeepSeek を実際に呼んだ回数**を数える。キャッシュヒットは
上限を消費しない。カウント元は `generation_attempts`（`docs/db-schema.md` §3.6）で、
`lookups` ではない。`lookups` はユーザーが削除できる履歴テーブルであり、
そこから数えると履歴削除で上限がリセットできてしまうため
（[ADR-0008](./adr/0008-global-generation-cache.md) の設計とは独立の問題）。

| 項目 | 既定値 | 環境変数 |
| --- | --- | --- |
| 1 時間あたり | 60 回 | `RATE_LIMIT_PER_HOUR` |

上限超過時は `429` / `rate_limited` を返し、`Retry-After` ヘッダ（本文の
`retryAfterSeconds` と同じ秒数）も併せて返す。この秒数はスライディングウィンドウ内で
最も古い呼び出しが窓の外に出るまでの実際の残り時間であり、固定値ではない。

### 3.4 上流障害時の縮退応答（stale-on-error）

DeepSeek 呼び出しが失敗し、かつ **TTL 切れの生成結果が DB に存在する**場合、
エラーではなく `200` で古い結果を返す（`generation.stale = true`）。

理由: ユーザーにとって「少し古い類義語」は「エラー画面」より明確に有用であり、
類義語というデータの性質上、時間経過で内容が陳腐化しない。
TTL 切れキャッシュが無い場合のみ、§2.5 のエラーを返す。

### 3.5 処理手順

```
1. CORS プリフライト処理（OPTIONS → 204）
2. JWT 検証 → user_id を確定           … 失敗: 401 unauthorized
3. リクエストボディを zod で検証        … 失敗: 400 invalid_request
4. word を正規化（trim → 空白圧縮 → 小文字）
5. レート制限チェック                   … 超過: 429 rate_limited
6. find_or_create_term → term
7. forceRefresh でなければ find_cached_generation（TTL 以内）
   ├─ ヒット → record_cached_lookup → 200 (cached: true)
   └─ ミス   → 8 へ
8. DeepSeek 呼び出し（タイムアウト付き / リトライ最大 1 回）
   └─ 失敗 → TTL 切れキャッシュを検索
              ├─ あり → record_cached_lookup → 200 (cached: true, stale: true)
              └─ なし → §2.5 のエラー
9. レスポンスを zod で検証              … 失敗: 502 upstream_invalid_response
   呼び出しが成功した時点で record_generation_attempt を記録する
   （レート制限のカウント対象化。失敗時は記録しない）
10. 類義語が 0 件なら永続化せずそのまま 200 で返す（下記の注記）
11. save_synonym_generation（生成 + 明細 + 履歴を 1 トランザクション）
12. 200 (cached: false)
```

**手順 10（0 件）について**: `{"synonyms":[]}` をそのまま 30 日キャッシュすると、
モデルの一時的な揺らぎやプロンプト改善の余地があるにもかかわらず、同じ語が
長期間「該当なし」に固定されてしまう。結果はそのままユーザーに返すが、
`terms` / `synonym_generations` への保存は行わない。この場合 `generation.id` は
`null` になる。

**手順 11 が失敗した場合**、生成自体は成功しているため、
エラーを返さず結果を返し、永続化失敗を error レベルでログに記録する。
DeepSeek のコストを既に払っている以上、ユーザーに結果を渡さないのは損失が二重になる。
（履歴に残らないことは許容する。次回同じ語を引けば再生成される。）この場合も
`generation.id` は `null` になる（実在しない ID を発行すると、本物の生成結果と
区別がつかなくなるため）。

## 4. 読み取り系（PostgREST 直接）

Edge Function を作らない。RLS が認可を担保する。

### 4.1 検索履歴

```ts
// 直近 30 件（単語重複を除いた最新）
const { data } = await supabase
  .from('lookups')
  .select(`
    id,
    created_at,
    cache_hit,
    terms ( id, display_text, language ),
    synonym_generations (
      id,
      model,
      created_at,
      synonym_items ( position, synonym_text, part_of_speech, register, nuance )
    )
  `)
  .order('created_at', { ascending: false })
  .limit(30);
```

`user_id` の条件を書いていないのは、**RLS が自動で自分の行だけに絞る**ため。
クライアント側で `eq('user_id', ...)` を書くのは冗長であり、
「書き忘れたら漏れる」という誤った前提を生むので**書かない**。

### 4.2 履歴の削除

```ts
await supabase.from('lookups').delete().eq('id', lookupId);
```

RLS の `lookups_delete_own` により他人の行は削除できない。

### 4.3 プロフィール

```ts
await supabase.from('profiles').select('display_name, native_language').single();
await supabase.from('profiles').update({ display_name: name }).eq('id', userId);
```

## 5. バージョニング方針

MVP ではパスにバージョンを含めない（`/functions/v1/` の `v1` は Supabase 固有のもので、
アプリの API バージョンではない）。

理由: クライアントは自社アプリのみで、破壊的変更が必要になった場合は
**新しい関数名**（`synonyms-v2`）を追加して移行期間を設ける方が、
1 つの関数内でバージョン分岐を持つより単純。
App Store 経由の旧バージョンアプリが残ることを考慮し、
**フィールドの削除・意味変更は行わず、追加のみで進める**ことを原則とする。

`prompt_version` は API のバージョンとは独立している（プロンプト変更時に上げる内部的な値で、
レスポンス形式が変わらない限りクライアントには影響しない）。
