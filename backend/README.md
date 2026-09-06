# backend

Supabase（Auth / Postgres / Edge Functions）を用いたバックエンド。設計は
[`../docs/db-schema.md`](../docs/db-schema.md)、[`../docs/api-spec.md`](../docs/api-spec.md)、
[`../docs/llm-integration.md`](../docs/llm-integration.md)、[`../docs/security.md`](../docs/security.md) を参照。

## 対象プロジェクト

現在の実装は Supabase プロジェクト **OpenOwl-Vercel**（`xbobgxcsharwyasfzoik`）に対して行っている。
`supabase/config.toml` の `project_id` もこの値に固定してある。

## セットアップ

```bash
cd backend
supabase login                                # 初回のみ
supabase link --project-ref xbobgxcsharwyasfzoik
```

## マイグレーション

`supabase/migrations/` 配下の SQL は既に `xbobgxcsharwyasfzoik` に適用済み。
新しい変更を加える場合は以下の手順に従う（追記のみ。既存ファイルは書き換えない）。

```bash
supabase migration new <snake_case_name>
# supabase/migrations/<timestamp>_<name>.sql を編集
supabase db push
```

DB 型を再生成してコミットする（手書き禁止。CLAUDE.md 参照）:

```bash
supabase gen types typescript --linked \
  > supabase/functions/_shared/infrastructure/supabase/database.types.ts
```

## Edge Functions

`synonyms`（[`POST /synonyms`](../docs/api-spec.md) 相当）のみが存在する。
デプロイ:

```bash
supabase functions deploy synonyms
supabase functions logs synonyms --tail
```

**`main` への push では `.github/workflows/deploy.yml` が
マイグレーション適用 → Function デプロイ → Vercel 本番の順に自動実行する**
（[../docs/deployment.md](../docs/deployment.md) §5）。手動デプロイは
検証や緊急時のためのもので、通常は不要。

## テスト / 静的解析

```bash
cd supabase/functions
deno task check   # deno fmt --check && deno lint && deno check .
deno task test    # 単体テスト
```

CI（`ci.yml` の `backend` ジョブ）が実行するのと同じコマンド。

単体テストの対象は**外部 I/O を持たない純粋ロジックだけ**
（[ADR-0016](../docs/adr/0016-unit-tests-limited-to-pure-logic.md)）:
`Term` の正規化規則、`mapDomainErrorToHttp` の写像、`RequestSchema` の既定値、
`SynonymPromptBuilder` のプロンプト固定。
リポジトリ実装・`DeepSeekClient`・ユースケースには単体テストを書かない
（書くにはモックが要り、方針違反になる）。それらの正しさは E2E が担保する。

テスト用の依存は**追加しない**。ランナーは Deno 内蔵の `Deno.test`、
アサーションは `node:assert/strict` を使う。

`deno fmt` の対象から `database.types.ts` を除外してある
（`supabase gen types` が生成するファイルなので、整形すると再生成のたびに差分が出る）。

`deno.lock` はコミットする（依存の integrity を CI で固定するため）。
`deno.json` の `imports` を変更したら、`deno check .` を一度実行して
lock を更新したうえでコミットすること。

## Secrets

以下を **Supabase ダッシュボード → Project Settings → Edge Functions → Secrets**、
または `supabase secrets set KEY=value` で設定する。`DEEPSEEK_API_KEY` 以外も
既定値がないため、初回デプロイ後に必ずすべて設定すること
（未設定だと関数が起動時に環境変数検証エラーで落ちる）。

| 変数 | 例 | 必須 | 説明 |
| --- | --- | :---: | --- |
| `DEEPSEEK_API_KEY` | `sk-xxxxxxxx` | ✓ | DeepSeek API キー。**絶対にリポジトリにコミットしない** |
| `ALLOWED_ORIGINS` | `http://localhost:8081,http://127.0.0.1:4173,https://openowl.vercel.app` | ✓ | CORS 許可オリジン（カンマ区切り、**完全一致**）。テスト用プロジェクトには E2E の配信元 `http://127.0.0.1:4173` を必ず含める（[testing-ci.md](../docs/testing-ci.md) §5.5(d)） |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | — | 既定値あり |
| `DEEPSEEK_MODEL` | `deepseek-chat` | — | 既定値あり。`deepseek-reasoner` は使わない（[ADR-0007](../docs/adr/0007-deepseek-chat-over-reasoner.md)） |
| `DEEPSEEK_TIMEOUT_MS` | `20000` | — | 既定 20000 |
| `SYNONYM_CACHE_TTL_DAYS` | `30` | — | 既定 30 |
| `RATE_LIMIT_PER_HOUR` | `60` | — | 既定 60 |

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` は
Edge Functions 実行環境に自動注入されるため手動設定は不要。

## 動作確認

```bash
# サインアップ(初回のみ)して access_token を得る
curl -sS -X POST "https://xbobgxcsharwyasfzoik.supabase.co/auth/v1/signup" \
  -H "apikey: <anon key>" -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"xxxxxxxx"}'

# 類義語生成
curl -sS -X POST "https://xbobgxcsharwyasfzoik.supabase.co/functions/v1/synonyms" \
  -H "apikey: <anon key>" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"word":"improve"}'
```
