# OpenOwl

外国語学習モバイルアプリ。英単語を入力すると、LLM がニュアンス付きの類義語を提示します。

> **現在のステータス: 設計フェーズ（Phase 2 完了 / 実装未着手）**
> このリポジトリにはまだアプリケーションコードは含まれていません。
> 現時点で確定しているのは、リポジトリ構成・技術選定・バックエンド設計（DBスキーマ / API仕様 / RLS）です。
> 実装が進むたびに本 README を更新します。

## 概要

| 項目 | 内容 |
| --- | --- |
| プラットフォーム | iOS / Android（React Native） |
| MVP 機能 | ①認証（Email+Password / Google / Apple） ②類義語生成 |
| バックエンド | Supabase（Auth / Postgres / Edge Functions） |
| LLM | Google Gemini Flash-Lite（Edge Functions からのみ呼び出す） |
| 将来機能 | 単語帳、例文生成、ロールプレイ会話 |

詳細は [`docs/`](./docs/) を参照してください。まず読むべきは
[`docs/architecture.md`](./docs/architecture.md) と [`docs/roadmap.md`](./docs/roadmap.md) です。

## ディレクトリ構成

```
OpenOwl/
├── README.md              # このファイル
├── CLAUDE.md              # AI エージェント向けのプロジェクト規約
├── LICENSE
├── docs/                  # 設計ドキュメント（実装より先に更新する）
│   ├── README.md          # ドキュメントの索引
│   ├── roadmap.md
│   ├── architecture.md
│   ├── repository-structure.md
│   ├── db-schema.md
│   ├── api-spec.md
│   ├── backend-design.md
│   ├── security.md
│   ├── error-handling.md
│   └── adr/               # 設計判断の記録
├── backend/               # ⬜ Phase 3 で作成
│   └── supabase/
│       ├── config.toml
│       ├── migrations/    # SQL マイグレーション
│       └── functions/     # Edge Functions（Deno / TypeScript）
├── frontend/              # ⬜ Phase 5 で作成
│   └── ...                # React Native (Expo) アプリ本体
└── .github/workflows/     # ⬜ Phase 6 で作成（CI）
```

構成の根拠は [`docs/repository-structure.md`](./docs/repository-structure.md) を参照。

## 前提ツール

| ツール | バージョン | 用途 |
| --- | --- | --- |
| Node.js | 22.x (LTS) | フロントエンド、ツールチェーン |
| npm | 10.x 以降 | パッケージ管理（npm workspaces） |
| Supabase CLI | 2.x 以降 | ローカル Supabase、マイグレーション、Edge Functions デプロイ |
| Deno | 2.x | Edge Functions のランタイム（Supabase CLI 同梱のものでも可） |
| Docker Desktop | 最新 | `supabase start` がコンテナを使用 |
| Xcode / Android Studio | 最新 | 実機・シミュレータビルド（Phase 5 以降） |

## セットアップ手順（現時点で実行可能な範囲）

### 1. リポジトリを取得する

```bash
git clone https://github.com/Shunya-Ueno/OpenOwl.git
cd OpenOwl
```

### 2. ドキュメントを読む

現時点ではこれが「セットアップ」の本体です。
[`docs/README.md`](./docs/README.md) から各設計ドキュメントに辿れます。

### 3. 外部サービスの準備（オーナー作業）

実装フェーズに入る前に、以下は人間が管理コンソール上で行う必要があります。
**AI エージェントはこれらを代行しません。API キーやシークレットをチャットに貼らないでください。**

| # | 作業 | 必要フェーズ |
| --- | --- | --- |
| 1 | Supabase プロジェクトを2つ作成（本番用 / テスト用） | Phase 3 |
| 2 | Google AI Studio で Gemini API キーを発行 | Phase 3 |
| 3 | Google Cloud Console で OAuth クライアント ID を発行 | Phase 5 |
| 4 | Apple Developer Program 加入 + Sign in with Apple 設定 | Phase 5 |

詳細は [`docs/roadmap.md`](./docs/roadmap.md#人間の作業が必要なブロッカー) を参照。

### 4. ローカル環境の起動（⬜ Phase 3 以降で有効になります）

```bash
# Supabase ローカルスタックの起動（Postgres / Auth / Edge Runtime）
npm run supabase:start

# マイグレーションの適用
npm run db:reset

# Edge Functions のローカル実行
npm run functions:serve
```

## 環境変数

秘密情報は**リポジトリにコミットしません**。各ディレクトリに `.env.example` を置き、
実値は `.env`（`.gitignore` 済み）または Supabase / EAS のシークレットストアに保存します。

### バックエンド（Edge Functions のシークレット）

`supabase secrets set` またはダッシュボードから登録します。**クライアントには一切配布しません。**

| 変数名 | 例 | 説明 |
| --- | --- | --- |
| `GEMINI_API_KEY` | `AIza...` | Gemini API キー。Edge Functions のみが保持 |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` | 使用モデル。モデル更新時に差し替えられるよう env 化 |
| `GEMINI_TIMEOUT_MS` | `10000` | LLM 呼び出しのタイムアウト |
| `SYNONYM_RATE_LIMIT_PER_DAY` | `30` | 1ユーザーあたりの1日の新規生成回数上限 |
| `SYNONYM_RATE_LIMIT_PER_MINUTE` | `10` | バースト制御 |
| `SYNONYM_CACHE_TTL_DAYS` | `90` | 既存生成結果を再利用する期間 |

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` などの `SUPABASE_` 接頭辞を持つ変数は
Supabase が Edge Functions に自動注入するため、手動設定は不要です（設定も不可）。

### フロントエンド（`frontend/.env`）

Expo の `EXPO_PUBLIC_` 接頭辞付き変数は**バンドルに埋め込まれ、クライアントから読み取れます**。
公開して問題ない値のみを置きます。

| 変数名 | 説明 |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key（旧 anon key）。RLS 前提で公開してよい |

> ⚠️ Supabase の **secret key（旧 service_role key）と `GEMINI_API_KEY` を
> `frontend/` 側に置くことは絶対に禁止**です。これらはサーバー側専用です。
> 詳細は [`docs/security.md`](./docs/security.md) を参照。

## 開発コマンド

`⬜` は該当フェーズで実装され次第、有効になります。

| コマンド | 内容 | 状態 |
| --- | --- | --- |
| `npm run supabase:start` / `supabase:stop` | ローカル Supabase スタックの起動・停止 | ⬜ Phase 3 |
| `npm run db:reset` | ローカル DB を再作成しマイグレーションを適用 | ⬜ Phase 3 |
| `npm run db:diff -- <name>` | スキーマ差分から新規マイグレーションを生成 | ⬜ Phase 3 |
| `npm run db:types` | DB から TypeScript 型を生成 | ⬜ Phase 3 |
| `npm run functions:serve` | Edge Functions をローカル起動 | ⬜ Phase 3 |
| `npm run functions:deploy` | Edge Functions をデプロイ | ⬜ Phase 3 |
| `npm run start` | Expo 開発サーバの起動 | ⬜ Phase 5 |
| `npm run ios` / `npm run android` | 各プラットフォームでの起動 | ⬜ Phase 5 |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript 型チェック | ⬜ Phase 3 |
| `npm run test:e2e` | E2E テスト（実 Supabase / 実 Gemini に接続） | ⬜ Phase 6 |

## 開発方針（要点）

- **モック禁止**: 実装・テストとも、Supabase と Gemini API には実際に接続します。
  ダミーデータ・モックサーバ・スタブ実装は使いません。
  テストは専用の Supabase プロジェクトと実 API キーに対して実行します。
- **オブジェクト指向**: class / interface を用い、責務分離されたレイヤー構成にします。
  関数の羅列ではなくドメインモデルを中心に設計します。
- **ドキュメント優先**: 設計変更は必ず `docs/` の更新を伴います。
- **コスト意識**: Gemini Flash-Lite を使用し、プロンプトは短く、無駄なリトライはしません。
  同一単語の再生成は DB キャッシュで回避します。

詳細な規約は [`CLAUDE.md`](./CLAUDE.md) を参照してください。

## ライセンス

[MIT](./LICENSE)
