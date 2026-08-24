# OpenOwl

英単語の**類義語生成**を軸にした外国語学習アプリ。
iOS ネイティブアプリを主戦場としつつ、同一コードベースから Web/PWA 版を配信する。

- フロントエンド: React Native (Expo) + TypeScript / Expo for Web
- バックエンド: Supabase (Auth, Postgres, Edge Functions)
- LLM: DeepSeek API（Edge Functions からのみ呼び出す）
- Web/PWA ホスティング: Vercel（フロント配信のみ）

> **現在の状態: フェーズ 6（E2E / CI / デプロイ）まで完了。MVP の実装は一通り揃っている。**
> `backend/`・`frontend/`・`.github/workflows/` がすべて実装済み。
> 設計の全体像は [`docs/`](./docs/README.md) を参照。
>
> ただし**外部サービス側の設定（下記「外部サービスの準備」と
> [`docs/deployment.md`](./docs/deployment.md) §5.2）は人手で行う必要がある**。
> これらが未設定だと CI とデプロイは動かない。

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [docs/README.md](./docs/README.md) | 設計ドキュメントの索引 |
| [docs/architecture.md](./docs/architecture.md) | 全体アーキテクチャ、Vercel / Supabase の役割分担、UI 前提 |
| [docs/repository-structure.md](./docs/repository-structure.md) | ディレクトリ構造とパッケージ選定 |
| [docs/db-schema.md](./docs/db-schema.md) | DB スキーマと RLS |
| [docs/api-spec.md](./docs/api-spec.md) | Edge Functions API 仕様 |
| [docs/llm-integration.md](./docs/llm-integration.md) | DeepSeek 連携設計 |
| [docs/security.md](./docs/security.md) | シークレット管理・認可境界 |
| [docs/frontend-design.md](./docs/frontend-design.md) | 画面構成・状態管理・ディレクトリ構造・Web/PWA 対応 |
| [docs/testing-ci.md](./docs/testing-ci.md) | テスト戦略・E2E ツール選定・GitHub Actions・CI のシークレット管理 |
| [docs/deployment.md](./docs/deployment.md) | Vercel / Supabase デプロイ構成 |
| [CLAUDE.md](./CLAUDE.md) | AI エージェント向けのプロジェクト規約 |

## ディレクトリ構造

```
OpenOwl/
├── README.md
├── CLAUDE.md                  # AI エージェント向け規約
├── docs/                      # 設計ドキュメント
│   └── adr/                   # Architecture Decision Record
├── backend/                   # Supabase
│   └── supabase/
│       ├── config.toml
│       ├── migrations/        # SQL マイグレーション
│       └── functions/         # Edge Functions (Deno) + 単体テスト
├── frontend/                  # Expo アプリ
│   ├── app/                   # Expo Router の画面
│   ├── src/                   # features/ と shared/
│   └── e2e/                   # Playwright（Web）+ Maestro（iOS）
└── .github/workflows/         # CI / デプロイ
```

詳細は [docs/repository-structure.md](./docs/repository-structure.md)。

## 前提ツール

| ツール | バージョン目安 | 用途 |
| --- | --- | --- |
| Node.js | 22 LTS | フロントエンドのビルド / ツールチェーン |
| npm | 10 以上 | パッケージ管理（ワークスペースは使わない。[ADR-0002](./docs/adr/0002-no-shared-package-for-now.md)） |
| Supabase CLI | 最新 | マイグレーション・Edge Functions のデプロイ |
| Deno | 2.x | Edge Functions のローカル型チェック（Supabase CLI 同梱版でも可） |
| Xcode | 最新 | iOS 実機 / シミュレータ（フェーズ 5 以降） |

## セットアップ（現時点）

現時点ではリポジトリにアプリケーションコードが存在しないため、
セットアップ＝**外部サービスの準備**と**ドキュメントの確認**が中心になる。

```bash
git clone git@github.com:Shunya-Ueno/OpenOwl.git
cd OpenOwl
```

### 1. 外部サービスの準備（人手が必要な作業）

以下はすべて管理画面での操作が必要で、AI エージェントは代行しない。
フェーズ 3（バックエンド実装）に入る前に完了している必要がある。

| # | サービス | 作業内容 | 必要な理由 |
| --- | --- | --- | --- |
| 1 | Supabase | プロジェクト作成（本番用 / テスト用の 2 つ） | Auth・DB・Edge Functions の実行基盤 |
| 2 | Supabase | Auth プロバイダで Email / Google / Apple を有効化 | MVP の認証要件 |
| 3 | DeepSeek | アカウント作成、API キー発行、**従量課金の残高チャージ** | 類義語生成。課金が発生する |
| 4 | Google Cloud Console | OAuth クライアント ID を Web 用 / iOS 用に発行 | Google ログイン |
| 5 | Apple Developer Program | App ID / Service ID / Sign in with Apple キー発行（**年会費が発生**） | Apple ログイン（iOS 審査要件） |
| 6 | Vercel | プロジェクト作成、GitHub リポジトリ連携 | Web/PWA 配信 |
| 7 | Vercel | **本番ブランチ向けの Deploy Hook 作成** | 本番デプロイの起動（[ADR-0015](./docs/adr/0015-production-deploy-gated-on-backend.md)） |
| 8 | Supabase（テスト） | **E2E 専用アカウントを 1 つ作成**（メール確認まで） | E2E のサインイン。CI に `service_role` を置かないため |
| 9 | GitHub | Environments / Variables / Secrets の登録 | CI とデプロイの実行 |

7〜9 の詳細は [docs/deployment.md](./docs/deployment.md) §5.2 にある表を参照。

### 2. 環境変数

環境変数は**置き場所によって公開範囲が違う**。ここを間違えると DeepSeek API キーが漏洩する。

#### Supabase Edge Functions（サーバー側・非公開）

`supabase secrets set` で設定する。クライアントには一切送出されない。

| 変数名 | 例 | 説明 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | `sk-...` | **絶対にフロントエンドへ置かない。** |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | 既定値。切り替え用 |
| `DEEPSEEK_MODEL` | `deepseek-chat` | 選定理由は [docs/llm-integration.md](./docs/llm-integration.md) |
| `DEEPSEEK_TIMEOUT_MS` | `20000` | 上流タイムアウト |
| `SYNONYM_CACHE_TTL_DAYS` | `30` | 生成結果の再利用期間 |
| `RATE_LIMIT_PER_HOUR` | `60` | ユーザーあたりの生成回数上限 |
| `ALLOWED_ORIGINS` | `https://openowl.vercel.app,http://localhost:8081,http://127.0.0.1:4173` | CORS 許可オリジン（完全一致）。テスト用プロジェクトには E2E の配信元 `http://127.0.0.1:4173` も必要 |

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` は
Edge Functions 実行環境に自動注入されるため、手動設定は不要。

```bash
cd backend
supabase secrets set DEEPSEEK_API_KEY=sk-xxxxxxxx
supabase secrets list   # 値は表示されない。設定済みかの確認のみ
```

#### Vercel（フロントエンド・**公開される**）

Expo の `EXPO_PUBLIC_` 接頭辞付き変数は**ビルド時に JS バンドルへ埋め込まれる**。
ブラウザの DevTools から誰でも読めるため、秘密情報を入れてはいけない。

| 変数名 | 対象環境 | 説明 |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Production / Preview | Supabase プロジェクト URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Production / Preview | anon（publishable）キー。公開前提の鍵で、保護は RLS が担う |

Preview 環境にはテスト用 Supabase プロジェクトの値を設定する。詳細は
[docs/deployment.md](./docs/deployment.md)。

#### ローカル開発（フェーズ 5 以降）

`frontend/.env.local` に上記 2 つを記述する。`.env*` は `.gitignore` 済み。

```bash
# frontend/.env.local
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## 開発コマンド

```bash
# --- backend ---
cd backend
supabase link --project-ref <project-ref>   # プロジェクト紐付け
supabase db push                            # マイグレーション適用
supabase functions deploy synonyms          # Edge Function デプロイ
supabase functions logs synonyms            # 実行ログ

cd backend/supabase/functions
deno task check        # fmt --check + lint + 型チェック
deno task test         # 単体テスト（純粋ロジックのみ）

# --- frontend ---
cd frontend
npm install
npm run start          # Expo dev server（iOS / Web）
npm run web            # Web のみ
npm run build:web      # 静的エクスポート → dist/
npm run typecheck
npm run lint
npm run test           # 単体テスト（Vitest）
npm run e2e            # Web の E2E（Playwright）※ build:web と E2E 用アカウントが必要
```

コマンドの正典は [CLAUDE.md](./CLAUDE.md) に置く。
テストの回し方と前提は [docs/testing-ci.md](./docs/testing-ci.md) §8。

## 設計上の重要な前提

- **UI はモバイル幅（〜480px）専用**。デスクトップ幅向けのレイアウト最適化は行わない。
- **バックエンドは Supabase Edge Functions に一本化**。Vercel はフロント配信のみで、API を持たない。
- **モック禁止**。開発・テストとも実際の Supabase / DeepSeek に接続する。
  この制約から、単体テストは外部 I/O を持たない純粋ロジックのみを対象とし、
  それ以外は実サービスに対する E2E が担う（[docs/testing-ci.md](./docs/testing-ci.md)）。
- **DeepSeek API キーはサーバー側のみ**。クライアントから DeepSeek を直接叩く実装は行わない。

## ライセンス

[LICENSE](./LICENSE) を参照。
