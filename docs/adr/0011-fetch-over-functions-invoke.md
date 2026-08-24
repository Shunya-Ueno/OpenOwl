# ADR-0011: Edge Function の呼び出しに functions.invoke ではなく fetch を使う

- **状態**: Accepted
- **日付**: 2026-08-22
- **フェーズ**: 4

## 背景

クライアントから `POST /functions/v1/synonyms` を呼ぶ手段が 2 つある。

1. `supabase.functions.invoke('synonyms', { body })`
2. 素の `fetch` に `Authorization` / `apikey` ヘッダを自分で付ける

[`api-spec.md`](../api-spec.md) は、エラー時に `{ error: { code, message, retryAfterSeconds } }`
という本文と、429 では `Retry-After` ヘッダを返すと定めている。
[`frontend-design.md`](../frontend-design.md) §7 のフォールバック UX は、
**この `code` による分岐**を前提に組み立てられている。

## 決定

**素の `fetch` を薄いアダプタ（`EdgeFunctionSynonymsApi`）で包んで使う。**
`supabase.functions.invoke` は使わない。

## 理由

- `invoke` は非 2xx を SDK 独自のエラー型に包む。エラー本文とレスポンスヘッダを
  取り出せるかどうかが SDK のバージョンと内部仕様に依存する。
  本設計ではエラー本文の `code` が UX の分岐条件そのものなので、
  そこを不確実な経路に載せたくない。
- `Retry-After` ヘッダとステータスコードを直接読みたい。
- タイムアウト（`AbortSignal`）を自分で制御したい。サーバー側の上流タイムアウトが
  20 秒であり、クライアントはそれより長く待つ必要がある（切ってしまうと縮退応答を捨てる）。
- **backend と同じ判断**をしている。backend も DeepSeek 呼び出しに SDK を使わず
  素の `fetch` を薄いクラスで包んでいる（[`repository-structure.md`](../repository-structure.md) §4）。
  理由も同じ（タイムアウト・リトライ・エラー変換を SDK 任せにしない）。
- 呼び出しは 1 エンドポイントのみ。SDK が省略してくれる手間が小さい。

## 検討したが採用しなかった案

| 案 | 却下理由 |
| --- | --- |
| `functions.invoke` を使う | エラー本文とヘッダの取得経路が SDK 内部仕様に依存する。UX の根幹がそこに乗る |
| `invoke` を使いつつ、失敗時だけ `fetch` で再取得 | 同じリクエストを 2 回投げることになる。生成 API では課金が二重になりうる |

## 結果 / 影響

- 認証・PostgREST は引き続き `supabase-js` を使う。差し替えるのは Edge Function 呼び出しのみ。
- アクセストークンは呼び出しのたびに `supabase.auth.getSession()` から取得する
  （store に保持した古いトークンを使うとリフレッシュ直後に 401 になる）。
- `apikey` ヘッダを自分で付ける必要がある。付け忘れると Supabase のゲートウェイで弾かれる。
