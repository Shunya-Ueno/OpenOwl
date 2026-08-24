# CLAUDE.md

このファイルは Claude Code（および他の AI エージェント）が本リポジトリで作業する際の規約を定める。
人間の開発者にとっても「このプロジェクトのルール」の正典として機能する。

## プロジェクト概要

OpenOwl は英単語の類義語生成を軸にした外国語学習アプリ。iOS ネイティブを主戦場とし、
同一コードベースから Web/PWA 版を Vercel で配信する。

- MVP スコープは **認証** と **類義語生成** の 2 機能のみ
- 将来的に「単語帳」「例文生成」「ロールプレイ会話」への拡張を予定（ただし先回り実装はしない）

## 技術スタック（確定事項・変更は ADR を伴うこと）

| レイヤー | 採用技術 |
| --- | --- |
| フロントエンド | React Native (Expo) + TypeScript, Expo for Web |
| ルーティング | Expo Router |
| サーバー状態 | TanStack Query |
| クライアント状態 | Zustand（最小限） |
| 認証 | Supabase Auth（Email/Password, Google, Apple） |
| DB | Supabase Postgres（RLS 必須） |
| API | Supabase Edge Functions (Deno + TypeScript) |
| LLM | DeepSeek API (`deepseek-chat`) |
| Web/PWA 配信 | Vercel |
| 単体テスト | Deno 内蔵 `Deno.test` + `node:assert`（backend） / Vitest（frontend） |
| E2E | Playwright（Web・PR のゲート） / Maestro（iOS・週次） |
| CI | GitHub Actions |

## ディレクトリ構造

```
OpenOwl/
├── docs/                       # 設計ドキュメント（実装より先に更新する）
│   └── adr/                    # 設計判断の記録
├── backend/
│   └── supabase/
│       ├── config.toml
│       ├── migrations/         # <timestamp>_<snake_case>.sql
│       └── functions/
│           ├── _shared/        # 複数関数で共有するレイヤー（*.test.ts を併置）
│           └── synonyms/       # 類義語生成エンドポイント
├── frontend/                   # Expo アプリ
│   ├── app/                    # Expo Router の画面
│   ├── src/                    # features/ と shared/（*.test.ts を併置）
│   └── e2e/                    # web/(Playwright) preview/ maestro/
└── .github/workflows/          # ci.yml / deploy.yml / e2e-preview.yml / e2e-ios.yml
```

## 開発コマンド

### backend

```bash
cd backend
supabase link --project-ref <ref>            # プロジェクト紐付け
supabase migration new <name>                # マイグレーション雛形生成
supabase db push                             # リモートへマイグレーション適用
supabase db diff -f <name>                   # スキーマ差分からマイグレーション生成
supabase functions deploy synonyms           # Edge Function をデプロイ
supabase functions logs synonyms --tail      # 実行ログ
supabase secrets set KEY=value               # サーバー側シークレット設定
deno check supabase/functions/**/*.ts        # 型チェック
deno fmt && deno lint                        # 整形・静的解析
```

```bash
cd backend/supabase/functions
deno task check                              # fmt --check + lint + 型チェック（CI と同じ）
deno task test                               # 単体テスト
```

### frontend

```bash
cd frontend
npm install
npm run start          # Expo dev server
npm run ios            # iOS シミュレータ
npm run web            # Web
npm run build:web      # 静的エクスポート → dist/
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint
npm run test           # 単体テスト（Vitest / 純粋ロジックのみ）
npm run e2e            # Web の E2E（要 build:web + E2E アカウント）
npm run e2e:ui         # 同上・対話モード
```

iOS ネイティブの E2E は `frontend/e2e/maestro/README.md` を参照。

## コーディング規約

### 全般

- **TypeScript strict モード必須**。`any` は禁止。外部入力は `unknown` で受けて zod で絞り込む。
- **オブジェクト指向で書く**。関数の羅列にしない。
  - ドメインの概念は `class` / `interface` として表現する（`Term`, `SynonymGeneration`, `Lookup` など）
  - レイヤーは Domain → Application → Infrastructure → Interface（HTTP）の 4 層
  - **依存は内向き**。Domain は他のどの層にも依存しない。Infrastructure は Domain の
    `interface`（ポート）を実装する
- **命名**: クラス / 型は `PascalCase`、変数・関数は `camelCase`、DB のテーブル・列は `snake_case`、
  定数は `SCREAMING_SNAKE_CASE`、ファイル名はクラスと同名（`GenerateSynonymsUseCase.ts`）。
- **エラーは型で表現する**。`DomainError` を基底にした具象エラークラスを投げ、
  HTTP 層でのみステータスコードへ変換する。文字列比較でエラー分岐しない。
- **コメントは「なぜ」を書く**。「何を」しているかはコードで表す。
- 1 ファイル 1 エクスポート（クラス）を原則とする。

### 禁止事項

- **モック / スタブ / ダミーデータの使用は禁止**。
  実装・テストとも実際の Supabase / DeepSeek に接続する。
  レイヤー分離のための `interface` は**テストダブル差し替えのためではなく**、
  依存方向の制御と将来の LLM プロバイダ差し替えのために存在する。
  具体的に禁止されるもの: `vi.mock` / `vi.fn`、ポートの偽実装、
  `fetch` や Supabase クライアントの差し替え、Playwright の `page.route()` による
  レスポンス偽装、`@testing-library/react-native`（レンダラが実物ではない）。
- **秘密情報をリポジトリへコミットしない**。`.env*` は `.gitignore` 済み。
  API キーらしき文字列をコードに書かない。
- **DeepSeek をクライアントから直接呼ばない**。必ず Edge Functions を経由する。
- **RLS を無効化しない**。`service_role` キーはフロントエンドで使わない。
- **デスクトップ幅向けの分岐実装をしない**（後述）。

## テストの書き方

正典は `docs/testing-ci.md`。モック禁止が層の切り分けを決めている。

- **単体テストは外部 I/O を持たない純粋ロジックだけに書く**（ADR-0016）。
  正規化規則、バリデーション、エラー → HTTP の写像、プロンプト組み立て、パース処理。
  リポジトリ実装・ユースケース・コンポーネントには単体テストを書かない。
- **それ以外の正しさは E2E が担保する。** したがって
  **E2E を落としたまま放置しない**。E2E がこの構成の唯一の安全網である。
- 新しいロジックは、**純粋な関数 / クラスに切り出せばテストできる層に移る**。
  迷ったら切り出す方向に倒す。
- E2E のセレクタは `frontend/src/shared/testIds.ts` の `testID` に一本化する。
  **表示文言でセレクタを書かない**（文言は変わり、エラーメッセージはサーバー由来）。
- E2E で **DeepSeek を叩くスペックを増やさない**。生成を伴わずに検証できることは
  生成なしで検証する。実生成は日次のスケジュール実行だけに留める（`docs/testing-ci.md` §6.5）。
- カバレッジ閾値は設けない。数字のためのテストを誘発するため。

## UI / 画面幅の前提

- 本アプリの UI は**モバイル幅（〜480px）を前提として設計する**。
- Web/PWA 版は**モバイルブラウザからのアクセスのみを想定**する。
- デスクトップブラウザで開かれた場合は、**モバイル幅のレイアウトを固定幅で中央寄せ表示**する
  だけに留める。メディアクエリによる大画面向けレイアウト分岐は作らない。
- タブレット / PC 専用 UI は設計・実装のいずれもスコープ外。

## Supabase に関する注意

- **すべてのテーブルで RLS を有効化する**。ポリシーを書かないテーブルは「全拒否」になる、
  という前提で設計する（= 明示的に許可したアクセスだけが通る）。
- ポリシー内の `auth.uid()` は `(select auth.uid())` と書く。
  行ごとの再評価を避け、インデックスが効くようにするため。
- ポリシーには必ず `TO authenticated` を付ける。未認証ロールへの露出を防ぐ。
- スキーマ変更は**必ずマイグレーションファイル経由**。
  ダッシュボードの SQL エディタで本番スキーマを直接変更しない（差分が失われる）。
- Edge Functions では、ユーザーの権限で読み書きする処理は
  リクエストの `Authorization` ヘッダをそのまま引き継いだクライアントを使う。
  RLS をバイパスする `service_role` クライアントは、
  **共有データ（`terms` / 生成結果）の書き込みに限って**使う。
- 生成された DB 型（`supabase gen types typescript`）はコミットする。手書きしない。

## DeepSeek 連携に関する注意

- モデルは `deepseek-chat` を使う。`deepseek-reasoner` は使わない（理由は
  `docs/llm-integration.md` および `docs/adr/0007-deepseek-chat-over-reasoner.md`）。
- **トークンを無駄にしない**:
  - システムプロンプトは固定文字列にし、変動部分（単語）を後ろに置く
    （プロンプトキャッシュのヒット率を上げるため）
  - 生成前に DB キャッシュを引く。同一単語の再生成は既定で行わない
  - リトライは**最大 1 回**。かつ 429 / 5xx / ネットワークエラーに限る。
    4xx（バリデーションエラー等）はリトライしない
  - `max_tokens` を必ず指定する
- 入力単語は Edge Function 側で厳格にバリデーションする（英字と一部記号のみ、64 文字以内）。
  プロンプトインジェクションとトークン浪費の両方を防ぐため。
- LLM の出力は**必ず zod で検証**してから DB に保存する。パース失敗時は 502 を返す。

## Vercel デプロイに関する注意

- Vercel は**フロントエンドの静的配信のみ**に使う。
  API Routes / Vercel Edge Functions / Serverless Functions は**採用しない**。
  バックエンドは Supabase Edge Functions に一本化する。
- Vercel の Root Directory は `frontend`、ビルド成果物は `dist`。
- **`main` に対する Vercel の自動デプロイは無効化してある**（`frontend/vercel.json` の
  `git.deploymentEnabled`）。本番フロントエンドは `.github/workflows/deploy.yml` が
  Supabase のデプロイ完了後に Deploy Hook で起動する。`docs/deployment.md` §4 の
  順序制約を守るため（ADR-0015）。この設定を勝手に戻さない。
- `EXPO_PUBLIC_` 接頭辞の環境変数は **JS バンドルに埋め込まれ公開される**。
  秘密情報を置かない。
- Preview デプロイはテスト用 Supabase プロジェクトを向ける。
  Supabase Auth の Redirect URLs にプレビュー用のワイルドカードを登録する必要がある。

## 作業の進め方

- **ドキュメント優先**。設計を変える場合は `docs/` を先に更新し、その後コードを変更する。
- 判断が分かれる設計選択をしたら `docs/adr/` に ADR を追加する。
- 以下に該当したら**作業を止めて人間に確認する**:
  - Apple Developer Program / Google Cloud Console / Vercel / DeepSeek / Supabase の
    管理画面での操作が必要になったとき
  - API キーやシークレットの入力が必要になったとき
  - 課金が発生する契約・プラン選択が必要になったとき

## モデルの使い分け

| 作業 | 使用モデル |
| --- | --- |
| 設計・コードレビュー・リファクタリング | Opus または Fable |
| 実装（コード記述、テストコード、CI 設定ファイル） | Sonnet |

各フェーズの報告時に、どのモデルで作業したかを明記すること。

## Git 運用

- 作業ブランチ: `claude/<topic>-<suffix>`
- コミットメッセージは命令形の英語 1 行 + 必要なら本文（例: `Add DB schema design for MVP`）
- 1 フェーズ = 1 コミット以上。フェーズ途中の巨大コミットを避ける。
- PR は明示的に依頼された場合のみ作成する。
