# セキュリティ設計

## 原則

1. **秘密鍵はサーバ側にしか存在しない。** `GEMINI_API_KEY` と Supabase の secret key は
   Edge Functions の実行環境にのみ置き、クライアントバンドル・リポジトリ・ログに一切出さない。
2. **クライアントからの入力は識別情報を含めて信用しない。** ユーザー ID は必ず検証済み JWT から取得する。
3. **最終防衛線は RLS。** アプリ層のチェックは UX のためであり、認可の根拠にはしない。
4. **ポリシーのないテーブルは拒否される。** 書き込みを許したくない操作にはポリシーを「書かない」。

## キー管理

| キー / シークレット | 保管場所 | クライアント配布 | 用途 |
| --- | --- | --- | --- |
| Supabase publishable key（旧 anon key） | `frontend/.env`（`EXPO_PUBLIC_*`）→ アプリバンドル | ✅ 可 | 認証、RLS 越しの読み取り |
| Supabase secret key（旧 service_role key） | Edge Functions 環境変数（Supabase が自動注入） | ❌ **厳禁** | RLS をバイパスした書き込み |
| `GEMINI_API_KEY` | Edge Functions のシークレット（`supabase secrets set`） | ❌ **厳禁** | Gemini API 呼び出し |
| ユーザーの access / refresh token | 端末の Keychain / Keystore（`expo-secure-store`） | — | セッション維持 |

### 具体的な禁止事項

- `EXPO_PUBLIC_` 接頭辞の変数に機密値を入れない。**この接頭辞の値はバンドルに平文で埋め込まれ、
  APK / IPA から抽出できる。**
- `.env` 系ファイルをコミットしない（`.gitignore` に登録し、`.env.example` にはプレースホルダのみ置く）。
- クライアントから Gemini API を直接呼ばない。**必ず Edge Functions を経由する。**
- ログ・エラーレスポンス・クラッシュレポートにトークンやキーを含めない
  （Edge Functions のログ出力はホワイトリスト方式のフィールドのみ出す → [`backend-design.md`](./backend-design.md)）。
- セッションを `AsyncStorage` に保存しない（平文保存のため）。`expo-secure-store` を使う。
  なお SecureStore は Android で1値あたり約 2KB の制限があるため、
  セッション JSON を分割保存するストレージアダプタを実装する（Phase 5 の実装項目）。

### キーのローテーション

`GEMINI_API_KEY` が漏洩した場合の手順を運用として決めておく（実施はオーナー）:

1. Google AI Studio で該当キーを失効させ、新しいキーを発行
2. `supabase secrets set GEMINI_API_KEY=<新キー>` で更新
3. Edge Function を再デプロイ（シークレット更新は次回起動時から反映）
4. 該当期間の `synonym_generations` のトークン消費量を確認し、不正利用の有無を判断

## 認証設計

### 対応するサインイン方式

| 方式 | 実装 | 備考 |
| --- | --- | --- |
| Email + Password | `supabase.auth.signUp` / `signInWithPassword` | メール確認を有効化する |
| Google | ネイティブ SDK で ID トークン取得 → `signInWithIdToken({ provider: 'google', token })` | iOS/Android/Web でクライアント ID が別 |
| Apple | `expo-apple-authentication` で ID トークン取得 → `signInWithIdToken({ provider: 'apple', token, nonce })` | iOS 審査要件。Apple は**生 nonce の SHA-256** をリクエストに使い、生 nonce を Supabase に渡す |

### Supabase Auth の設定（ダッシュボード側 / オーナー作業）

- メール確認（Confirm email）を **有効**にする。
- パスワードの最小長を 8 文字以上にし、漏洩パスワードチェック（HaveIBeenPwned 連携）を有効にする。
- リダイレクト URL の許可リストに、アプリのスキーム（例: `openowl://auth-callback`）のみを登録する。
  ワイルドカードを許可しない。
- Google / Apple の Provider を有効化し、クライアント ID・シークレットを登録する。
  **これらの値は AI に渡さず、オーナーが直接ダッシュボードへ入力する。**

### セッションの扱い

- アクセストークンは短命（既定1時間）。`supabase-js` が自動でリフレッシュする。
- サインアウト時は SecureStore 上のセッションも確実に破棄する。
- 端末紛失時のセッション失効は Supabase 側の「全セッション無効化」で対応する（MVP では UI を作らない）。

## RLS ポリシー設計

### 方針

| テーブル | anon | authenticated | service_role（Edge Functions） |
| --- | --- | --- | --- |
| `profiles` | 拒否 | 自分の行の SELECT / UPDATE | 全操作 |
| `words` | 拒否 | 全行 SELECT | 全操作 |
| `synonym_generations` | 拒否 | 全行 SELECT | 全操作 |
| `synonyms` | 拒否 | 全行 SELECT | 全操作 |
| `search_history` | 拒否 | **自分の行の SELECT のみ** | 全操作 |

判断の要点:

- **`words` / `synonym_generations` / `synonyms` を全ユーザーに開放してよい理由**:
  これらは辞書データであり、個人情報を一切含みません（[`db-schema.md`](./db-schema.md) の通り
  `synonym_generations` には意図的に `user_id` を持たせていません）。
  開放することで、履歴表示のときにクライアントが1クエリで join して読めます。
- **`search_history` に INSERT ポリシーを与えない理由**:
  書き込みは必ず Edge Function 経由にし、レート制限とキャッシュ判定を必ず通すためです。
  クライアントから直接 INSERT できると、この記録が信用できなくなります。
- **`search_history` に DELETE ポリシーを与えない理由**:
  レート制限をこのテーブルの行数で数えているため、削除できるとクォータをリセットできてしまいます。
- **`profiles` に INSERT ポリシーを与えない理由**:
  行の作成は `auth.users` のトリガー（`security definer`）が行うためです。
- **`(select auth.uid())` と書く理由**:
  そのまま `auth.uid()` と書くと行ごとに関数が評価されます。
  サブクエリにすると1回だけ評価され（InitPlan）、行数が増えても劣化しません。

### DDL（Phase 3 で `db-schema.md` の DDL と同じマイグレーションに含める）

```sql
-- =============================================
-- RLS 有効化（例外なく全テーブル）
-- =============================================
alter table public.profiles            enable row level security;
alter table public.words               enable row level security;
alter table public.synonym_generations enable row level security;
alter table public.synonyms            enable row level security;
alter table public.search_history      enable row level security;

-- =============================================
-- テーブル権限（Supabase の既定 GRANT を明示的に絞る）
-- =============================================
revoke all on public.profiles, public.words, public.synonym_generations,
              public.synonyms, public.search_history
  from anon, authenticated;

grant select         on public.words               to authenticated;
grant select         on public.synonym_generations to authenticated;
grant select         on public.synonyms            to authenticated;
grant select         on public.search_history      to authenticated;
grant select, update on public.profiles            to authenticated;

-- =============================================
-- profiles: 自分の行のみ
-- =============================================
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
-- INSERT / DELETE ポリシーは意図的に作らない（作成はトリガー、削除は auth.users の cascade）

-- =============================================
-- 辞書データ: 認証済みユーザーは読み取りのみ
-- =============================================
create policy "words_select_authenticated" on public.words
  for select to authenticated using (true);

create policy "synonym_generations_select_authenticated" on public.synonym_generations
  for select to authenticated using (true);

create policy "synonyms_select_authenticated" on public.synonyms
  for select to authenticated using (true);
-- 書き込みポリシーは意図的に作らない（Edge Function が service_role で書く）

-- =============================================
-- search_history: 自分の履歴の読み取りのみ
-- =============================================
create policy "search_history_select_own" on public.search_history
  for select to authenticated
  using ((select auth.uid()) = user_id);
-- INSERT / UPDATE / DELETE ポリシーは意図的に作らない
```

### RLS の検証（Phase 3 の完了条件）

`supabase db reset` 後、**実際のクエリで**以下を確認する（モックではなく実 DB）。

1. ユーザー A・B を作成し、A のトークンで `search_history` を SELECT → **B の行が0件**であること
2. A のトークンで `search_history` に INSERT → **権限エラー**になること
3. A のトークンで `synonyms` に INSERT → **権限エラー**になること
4. A のトークンで他人の `profiles` を UPDATE → **0行更新**になること
5. anon キーで各テーブルを SELECT → **すべて拒否**されること
6. Supabase の Advisor（`get_advisors`）で RLS 関連の警告が0件であること

## Edge Functions のセキュリティ

- `config.toml` で `verify_jwt = true` を設定し、無効な JWT をランタイム層で弾く。
  さらに関数内でも `auth.getUser(jwt)` により**ユーザーを再確認**する（多層防御）。
- **クライアントが送る `user_id` は受け付けない。** リクエストボディにユーザー識別子を含めない設計とする
  （[`api-spec.md`](./api-spec.md)）。
- CORS は許可オリジンを絞る。モバイルアプリからの呼び出しが主のため、
  ブラウザからの利用を想定する範囲でのみ `Access-Control-Allow-Origin` を設定する。
- 外部 API 呼び出しには必ずタイムアウトを設定し、ハングによる実行時間課金を防ぐ。

### プロンプトインジェクション対策

ユーザー入力（単語）がプロンプトに入るため、以下で入力面を狭めます。

- 入力は **1〜64文字、`^[A-Za-z][A-Za-z'\- ]*$` にマッチするもののみ**受け付ける
  （英字・アポストロフィ・ハイフン・スペースのみ。改行や記号、日本語、命令文の混入を構造的に排除）。
- 検証に落ちた入力は LLM に**渡す前に** 400 で拒否する（トークンを消費しない＝コスト面でも有利）。
- 出力は JSON スキーマで構造を固定し、想定外の形の応答は不正として扱う。
- 応答の各フィールドは長さ・件数を検証してから DB に保存する
  （プロンプト由来の巨大出力がそのまま保存されるのを防ぐ）。

### レート制限

| 制限 | 既定値 | 対象 | 目的 |
| --- | --- | --- | --- |
| 1日あたりの新規生成 | 30回/ユーザー | `outcome in ('generated','failed')` | LLM コストの上限 |
| 毎分あたりのリクエスト | 10回/ユーザー | 全リクエスト | バースト・DB 負荷の抑制 |

- カウントは `search_history` への集計クエリで行う（[`db-schema.md`](./db-schema.md)）。
- 上限超過時は `429` と `retryAfterSeconds` を返す（[`error-handling.md`](./error-handling.md)）。
- 値は環境変数で調整可能にし、コード変更なしに絞れるようにする。

## 脅威と対策の一覧

| 脅威 | 影響 | 対策 |
| --- | --- | --- |
| Gemini API キーの漏洩 | 第三者による課金消費 | サーバ側のみ保持。クライアント配布禁止。ログ出力禁止。ローテーション手順を用意 |
| 他ユーザーの検索履歴の閲覧 | プライバシー侵害 | `search_history` は owner-only RLS。共有テーブルに `user_id` を置かない |
| クライアントによる `user_id` 偽装 | なりすまし | JWT 検証済みの ID のみ使用。ボディの識別子は受け付けない |
| LLM の乱用によるコスト増大 | 課金 | レート制限、キャッシュ、`maxOutputTokens` 上限、リトライ1回まで |
| プロンプトインジェクション | 不適切な出力・情報漏洩 | 入力の文字種制限、構造化出力、出力検証 |
| 履歴削除によるクォータ回避 | コスト | DELETE ポリシーを作らない |
| 総当たりログイン | アカウント乗っ取り | Supabase Auth の既定レート制限 + パスワード強度設定 + メール確認 |
| 端末紛失時のトークン悪用 | なりすまし | セキュアストレージ保存、短命アクセストークン |

## App Store 提出に向けた注意（Phase 5 で対応）

- `TODO(Phase 5)`: **アカウント削除機能**。App Store のガイドラインでは、
  アプリ内でアカウント作成ができる場合、**アプリ内からアカウントを削除できる導線が必須**です。
  MVP の機能スコープには挙がっていませんが、審査要件のため実装が必要になります。
  実装方法は Edge Function（`delete-account`）で `auth.admin.deleteUser` を呼ぶ形を想定
  （関連データは FK の `on delete cascade` で消えるようスキーマ側は既に対応済み）。
- `TODO(Phase 5)`: プライバシーポリシーの URL とアプリ内表示。LLM に送信するデータの説明を含める。
- `TODO(Phase 5)`: App Privacy（データ収集の申告）で、メールアドレスと検索単語の扱いを記載する。
