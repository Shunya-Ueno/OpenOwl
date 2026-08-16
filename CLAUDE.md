# CLAUDE.md

このリポジトリで作業する AI エージェント（Claude Code など）向けの規約です。
人間の開発者が読んでも構いません。**作業前に必ずこのファイルと [`docs/README.md`](./docs/README.md) を読むこと。**

## プロジェクト概要

OpenOwl は外国語学習モバイルアプリです。MVP のスコープは以下の2機能のみ。

1. **認証** — Supabase Auth（Email+Password / Google / Apple）
2. **類義語生成** — 英単語を入力し、Edge Functions 経由で Gemini Flash-Lite を呼んで類義語を表示・保存

将来的に単語帳・例文生成・ロールプレイ会話へ拡張する前提だが、
**それらを先回りして実装しない**（YAGNI）。拡張を「阻害しない」設計に留める。

現在のフェーズと停止条件は [`docs/roadmap.md`](./docs/roadmap.md) を参照。

## 技術スタック（確定事項・独断で変更しない）

| レイヤー | 採用技術 |
| --- | --- |
| フロントエンド | React Native + TypeScript（Expo / EAS Build） |
| バックエンド | Supabase（Auth, Postgres, Edge Functions） |
| LLM | Google Gemini Flash-Lite |
| リポジトリ | モノレポ（`frontend/` + `backend/`） |
| CI | GitHub Actions |
| E2E | 実 Supabase / 実 Gemini に接続（モック不使用） |

これらの変更が必要と判断した場合は、勝手に変えず ADR 案として提示し、人間の承認を得ること。

## ディレクトリ構造

```
OpenOwl/
├── docs/                       # 設計ドキュメント（実装より先に更新する）
│   └── adr/                    # 設計判断の記録（追記のみ）
├── backend/                    # Phase 3 で作成
│   └── supabase/
│       ├── config.toml
│       ├── migrations/         # <timestamp>_<name>.sql（前方適用のみ）
│       └── functions/
│           ├── _shared/        # 共通レイヤー（domain / infrastructure / http）
│           └── generate-synonyms/
├── frontend/                   # Phase 5 で作成（React Native アプリ本体）
└── .github/workflows/          # Phase 6 で作成
```

`frontend/` と `backend/` は相互に import しない。両者の契約は
[`docs/api-spec.md`](./docs/api-spec.md) と生成された DB 型のみ。
共通型パッケージ（`packages/shared`）は MVP では作らない（[ADR-0002](./docs/adr/0002-shared-types-deferred.md)）。

## 開発コマンド

実装フェーズ到達前のものは未整備。整備され次第このセクションを更新すること。

```bash
# Supabase（backend/ で実行、またはルートの npm script 経由）
npm run supabase:start          # ローカルスタック起動
npm run supabase:stop
npm run db:reset                # DB 再作成 + マイグレーション適用 + seed
npm run db:diff -- <name>       # スキーマ差分からマイグレーション生成
npm run db:types                # DB から TypeScript 型生成
npm run functions:serve         # Edge Functions ローカル起動
npm run functions:deploy        # Edge Functions デプロイ

# フロントエンド
npm run start                   # Expo 開発サーバ
npm run ios / npm run android

# 品質チェック（コミット前に必ず実行）
npm run lint
npm run typecheck
npm run test:e2e                # 実サービス接続。CI ではテスト用プロジェクトを使用
```

## コーディング規約

### 設計原則

- **オブジェクト指向で書く。** `class` / `interface` を活用し、責務分離されたレイヤー構成にする。
  ユーティリティ関数の羅列にしない。ドメインの語彙（`Word`, `Synonym`, `SynonymGeneration`）を型として表現する。
- **レイヤー構成**（[`docs/backend-design.md`](./docs/backend-design.md)）
  `http`（HTTP境界） → `application`（ユースケース） → `domain`（モデル・ポート） ← `infrastructure`（実装）
  依存の向きは常に **infrastructure → domain**。domain は外部 SDK を import しない。
- **依存性注入はコンストラクタ経由**。DI コンテナは導入しない。組み立ては各 Function の `index.ts`（合成ルート）で行う。
- **早期 return とガード節**を使い、ネストを浅く保つ。
- 過剰な抽象化をしない。**インターフェースは「差し替える具体的な理由がある箇所」にのみ**定義する
  （現状: LLM プロバイダ、永続化）。

### TypeScript

- `strict: true`。`any` 禁止。外部からの入力は `unknown` で受けてバリデータで絞り込む。
- `null` / `undefined` を握りつぶさない。ドメイン型では省略可能性を明示する。
- エラーは `Error` を継承した独自クラス階層で表現する（`AppError` → `ValidationError` など）。
  文字列や生オブジェクトを throw しない。
- 命名: クラス/型は `PascalCase`、変数・関数は `camelCase`、定数は `UPPER_SNAKE_CASE`、
  ファイル名はクラス名に合わせる（`GeminiSynonymGenerator.ts`）。

### データベース

- スキーマ変更は**必ずマイグレーションファイル経由**。ダッシュボードで直接 DDL を打たない。
- マイグレーションは前方適用のみ。適用済みファイルを書き換えず、新しいファイルを追加する。
- テーブル・カラムは `snake_case`。テーブル名は複数形（`words`, `synonyms`）。
- タイムスタンプは `timestamptz`、既定値は `now()`。
- **新規テーブルを作ったら同じマイグレーション内で必ず `enable row level security` を書く。**

### Git

- 作業ブランチ: `claude/<topic>`。`main` に直接コミットしない。
- コミットメッセージは Conventional Commits（`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`）。
- 設計変更を含む変更は、該当ドキュメントの更新を同一コミット/PR に含める。
- Pull Request は明示的に依頼されたときだけ作成する。

## Supabase に関する注意事項

### RLS（最重要）

- **すべてのテーブルで RLS を有効化する。例外なし。**
- ポリシーが存在しない操作は「拒否」。書き込みを許可したくないテーブルには
  INSERT/UPDATE/DELETE ポリシーを**書かない**（Edge Functions が service role で書く）。
- ポリシー内では `auth.uid()` を `(select auth.uid())` の形で書く。
  行ごとの再評価を避け、インデックスが効くようにするため。
- ポリシーは `to authenticated` / `to anon` を明示し、暗黙に `public` へ広げない。
- RLS を追加・変更したら `supabase db reset` 後に、
  **別ユーザーのデータが見えないことを実際のクエリで確認する。**

### キー管理

| キー | 置き場所 | 備考 |
| --- | --- | --- |
| publishable key（旧 anon key） | クライアント（`EXPO_PUBLIC_*`） | RLS 前提で公開可 |
| secret key（旧 service_role key） | Edge Functions のみ | **クライアント配布・リポジトリコミット厳禁** |
| `GEMINI_API_KEY` | Edge Functions のみ | 同上。クライアントから Gemini を直接叩かない |

- `.env` 系のファイルは絶対にコミットしない。`.env.example` にはプレースホルダのみ書く。
- ログ・エラーメッセージにキーやアクセストークンを含めない。

### Edge Functions

- ランタイムは Deno。npm パッケージは `npm:` 指定でのみ使用し、依存は最小限にする。
- 認証必須のエンドポイントでは、`Authorization` ヘッダの JWT を検証してから処理する。
  クライアントから渡された `user_id` を信用しない（**必ず検証済み JWT から取得する**）。
- 外部 API 呼び出しには必ずタイムアウト（`AbortController`）を設定する。
- リトライは「リトライして意味のあるエラー（429 / 5xx / ネットワーク）」に限り、最大1回。
  4xx（不正リクエスト）はリトライしない。**無駄なトークン消費はコストに直結する。**
- CORS プリフライト（`OPTIONS`）を必ず処理する。

## テスト方針: モック禁止

- **モック・スタブ・ダミーデータ・偽 API サーバを使わない。**
  開発中の動作確認も自動テストも、実際の Supabase と実際の Gemini API に接続して行う。
- テストは**テスト専用の Supabase プロジェクト**に対して実行する（本番と分離）。
- テストデータはテスト内で作成し、終了時に片付ける（同一プロジェクトを共有するため）。
- `ILlmClient` などのインターフェースは「プロバイダ差し替えのためのポート」であり、
  **テスト用のフェイク実装を作るための口ではない**。フェイク実装を追加しないこと。

## AI エージェントへの作業ルール

- 現在のフェーズを [`docs/roadmap.md`](./docs/roadmap.md) で確認し、**スコープ外の作業をしない**。
- モデルの使い分けを守る:
  設計・レビュー・リファクタリングは **Opus / Fable**、実装は **Sonnet**。
  作業報告には使用モデルを明記する。
- 判断が分かれる設計上の選択は、自分で妥当な方を選び、理由を ADR に残す。
- ただし以下は**必ず作業を止めて人間に確認する**:
  - Apple Developer Program / Google Cloud Console など、外部サービス管理画面での作業が必要な場合
  - API キーやシークレットの入力が必要な場合
  - 課金が発生する契約・プラン選択が必要な場合
- 一度に大量のファイルを生成せず、区切りよくコミットして報告する。
