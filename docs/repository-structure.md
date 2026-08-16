# リポジトリ構成と技術選定

## ディレクトリ構造

```
OpenOwl/
├── package.json                # ワークスペース定義 + 開発コマンドの入口
├── README.md
├── CLAUDE.md
├── docs/
│   └── adr/
│
├── backend/                    # ⬜ Phase 3 で作成
│   ├── package.json            # npm script の置き場（依存は持たない）
│   ├── .env.example
│   └── supabase/
│       ├── config.toml         # ローカルスタック・Function ごとの設定
│       ├── seed.sql            # ローカル開発用の初期データ
│       ├── migrations/
│       │   └── 20260101000000_init.sql
│       ├── functions/
│       │   ├── deno.json       # import map / lint / fmt
│       │   ├── _shared/        # 複数 Function から使う共通レイヤー
│       │   │   ├── domain/
│       │   │   ├── application/
│       │   │   ├── infrastructure/
│       │   │   ├── http/
│       │   │   └── config/
│       │   └── generate-synonyms/
│       │       └── index.ts    # 合成ルート（依存を組み立てて serve）
│       └── tests/              # ⬜ Phase 6: 実 Supabase に対する統合テスト
│
├── frontend/                   # ⬜ Phase 5 で作成
│   ├── package.json
│   ├── app.config.ts           # Expo 設定
│   ├── .env.example
│   ├── src/
│   │   ├── app/                # 画面（ルーティング）
│   │   ├── features/           # 機能単位（auth / synonyms）
│   │   ├── domain/             # ドメインモデル
│   │   ├── infrastructure/     # Supabase クライアント、ストレージ
│   │   └── ui/                 # 共通コンポーネント・デザイントークン
│   └── e2e/                    # ⬜ Phase 6
│
└── .github/workflows/          # ⬜ Phase 6
```

`frontend/src/` の内訳は Phase 4（フロントエンド設計）で確定します。上記は暫定です。

## モノレポの方針

### `frontend/` と `backend/` を分ける理由

- **ランタイムが違う**: `backend/` は Deno（Edge Functions）、`frontend/` は Node + Metro バンドラ。
  同一ディレクトリに置くと lint/tsconfig/依存解決の設定が衝突します。
- **デプロイ単位が違う**: バックエンドは `supabase functions deploy`、
  フロントエンドは EAS Build / App Store。リリースサイクルも独立しています。
- **1リポジトリにする理由**: API 仕様とスキーマの変更をフロント側の追随と**同じコミットで**行えること。
  分割リポジトリだと契約変更が2つの PR に分かれ、齟齬が起きます。

### ワークスペース管理: npm workspaces

ルートの `package.json` で `"workspaces": ["frontend"]` を宣言し、
`backend/` は npm 依存を持たない（Deno のため）スクリプト置き場として扱います。

Turborepo / Nx / pnpm workspaces は**導入しません**。
ワークスペースが実質1つで、ビルドキャッシュの共有対象もないため、得られるものより設定コストが上回ります。
導入を再検討するトリガー: ワークスペースが3つ以上になったとき、または CI のビルド時間が5分を超えたとき。

詳細 → [ADR-0001](./adr/0001-monorepo-structure.md)

### 共通型パッケージ（`packages/shared`）を今は作らない

MVP で共有したい型は「1エンドポイントのリクエスト/レスポンス」と「DB の行型」だけです。
これに対して、Deno と Metro の両方から解決できるパッケージを整備するコストは見合いません。

- API の契約は [`api-spec.md`](./api-spec.md) を単一の正とし、両側で型を定義する
- DB の行型は `supabase gen types typescript` で**それぞれ**生成する（手書きしない）

`packages/shared` を導入するトリガーは ADR に明記してあります → [ADR-0002](./adr/0002-shared-types-deferred.md)

## 技術選定

### バックエンド

| 技術 | 選定理由 | 検討した代替案 |
| --- | --- | --- |
| Supabase（Auth / Postgres / Edge Functions） | 確定事項。Auth・DB・サーバレス関数・RLS が1つのプロジェクトに揃い、MVP で運用対象を増やさずに済む | — |
| Deno + TypeScript | Edge Functions のランタイム（選択肢なし） | — |
| Gemini Flash-Lite | 確定事項。類義語生成は高度な推論を要さず、軽量モデルで十分。低コスト・低レイテンシ | — |
| Gemini REST API を `fetch` で直接呼ぶ | SDK を挟まないことでコールドスタートを抑え、`AbortController` によるタイムアウトとリトライ制御を完全に自前で持てる。呼ぶのは1エンドポイントのみで SDK の恩恵が薄い | `@google/genai` SDK（依存とバージョン追従のコスト） |
| `zod`（npm: 経由） | Edge Function の入力検証と LLM 応答の検証に使用。`unknown` から型安全に絞り込める | 手書きのバリデータ（記述量とバグ混入） |
| PostgREST（`supabase-js` 経由の直接クエリ） | 履歴の読み取りなど、RLS で守れる操作に専用エンドポイントを作らない | 全操作を Edge Functions 化（実装量・レイテンシ・コストが増える） |

### フロントエンド（Phase 4 で最終確定 / 現時点の想定）

| 技術 | 選定理由 | 検討した代替案 |
| --- | --- | --- |
| React Native + TypeScript | 確定事項 | — |
| **Expo（+ EAS Build）** | Apple/Google ログインに必要なネイティブモジュールが公式に揃い、iOS ビルドを macOS なしで回せる。App Store 提出（EAS Submit）まで一本で通せる | Bare React Native（ネイティブ設定の手当てが増え、MVP には過剰） |
| **Expo Router** | ファイルベースルーティング。OAuth コールバックのディープリンク処理が標準で組み込まれ、ルートグループ `(auth)` / `(app)` で認証ガードを表現できる。内部は React Navigation なので知見も流用できる | React Navigation を直接使う（ディープリンク設定を手書きする分だけ手間） |
| `@supabase/supabase-js` | 公式クライアント。Auth・PostgREST・Functions 呼び出しを一元化 | — |
| `expo-secure-store`（セッション永続化） | アクセストークン/リフレッシュトークンを Keychain / Keystore に保存する。`AsyncStorage` は平文保存のため認証情報には使わない | `AsyncStorage`（公式サンプルでは使われるが、機密性が不足） |
| `@tanstack/react-query` | 通信状態（loading / error / retry / キャッシュ）を宣言的に扱える。**リトライ回数とリトライ対象を一箇所で制御できる**ことがコスト管理上重要 | 自前の `useState` + `useEffect`（リトライ制御が各画面に散る） |
| React Context（Auth 状態） | 認証状態は「単一の真実」を持つだけで十分。`onAuthStateChange` を購読する Provider を1つ置く | Redux / Zustand（MVP の状態量に対して過剰） |
| `react-hook-form` + `zod` | フォーム検証。zod スキーマをバックエンドの検証ルールと**同じ意味**で書けるため、入力仕様のズレが起きにくい | 手書き検証 |
| `expo-apple-authentication` | Sign in with Apple（iOS 審査要件）。ネイティブ UI で ID トークンを取得し `signInWithIdToken` に渡す | Web ベースの OAuth フロー（審査で不利・UX が劣る） |
| `@react-native-google-signin/google-signin` | Google ログインのネイティブフロー。ブラウザ往復なしで ID トークンを取得できる | `expo-auth-session` による Web フロー（UX が劣るが、必要ならフォールバックとして併用） |

**状態管理の方針（暫定）**: 「サーバ状態は React Query、認証状態は Context、それ以外はローカル state」。
グローバルなクライアント状態が実際に3つ以上出てきた時点で Zustand の導入を検討します。
最終判断は Phase 4。

### 開発ツール

| 技術 | 用途 | 備考 |
| --- | --- | --- |
| ESLint + Prettier | Lint / フォーマット | フロントは `eslint-config-expo`、バックエンドは `deno lint` / `deno fmt` |
| TypeScript `strict` | 型チェック | `any` 禁止 |
| GitHub Actions | CI | Phase 6 |
| Maestro もしくは Detox | E2E | Phase 6 で選定（Expo との相性と CI 実行コストで判断） |

## 命名・配置の規約

- ディレクトリ名は `kebab-case`、クラスを含むファイルはクラス名（`PascalCase`）に合わせる。
- `_shared/` 配下は「2つ以上の Function から使われる」ものだけを置く。
  1箇所でしか使わないものは各 Function ディレクトリに置く（早すぎる共通化を避ける）。
- SQL マイグレーションは `<timestamp>_<snake_case_name>.sql`。適用済みファイルは書き換えない。
