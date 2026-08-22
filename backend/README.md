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

## Secrets

以下を **Supabase ダッシュボード → Project Settings → Edge Functions → Secrets**、
または `supabase secrets set KEY=value` で設定する。`DEEPSEEK_API_KEY` 以外も
既定値がないため、初回デプロイ後に必ずすべて設定すること
（未設定だと関数が起動時に環境変数検証エラーで落ちる）。

| 変数 | 例 | 必須 | 説明 |
| --- | --- | :---: | --- |
| `DEEPSEEK_API_KEY` | `sk-xxxxxxxx` | ✓ | DeepSeek API キー。**絶対にリポジトリにコミットしない** |
| `ALLOWED_ORIGINS` | `http://localhost:8081,https://openowl.vercel.app` | ✓ | CORS 許可オリジン（カンマ区切り、完全一致） |
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
