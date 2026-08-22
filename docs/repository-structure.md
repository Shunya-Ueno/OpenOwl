# リポジトリ構成と技術選定

## 1. ディレクトリ構造

モノレポとし、リポジトリ直下で `frontend/` と `backend/` を分離する
（[ADR-0001](./adr/0001-monorepo-layout.md)）。

```
OpenOwl/
├── README.md
├── CLAUDE.md
├── LICENSE
├── .gitignore
├── docs/                                  # 設計ドキュメント
│   ├── README.md
│   ├── architecture.md
│   ├── repository-structure.md
│   ├── db-schema.md
│   ├── api-spec.md
│   ├── llm-integration.md
│   ├── security.md
│   ├── deployment.md
│   ├── roadmap.md
│   └── adr/
│
├── backend/                               # ── フェーズ 3 で作成 ──
│   ├── supabase/
│   │   ├── config.toml                    # Supabase CLI 設定
│   │   ├── migrations/                    # <timestamp>_<name>.sql（追記のみ）
│   │   │   ├── 20260101000000_init_schema.sql
│   │   │   ├── 20260101000100_rls_policies.sql
│   │   │   └── 20260101000200_functions.sql
│   │   ├── seed.sql                       # 参照用マスタのみ。ダミーデータは置かない
│   │   └── functions/
│   │       ├── deno.json                  # Deno 設定 + import map
│   │       ├── _shared/                   # 複数 Function で共有するレイヤー
│   │       │   ├── domain/
│   │       │   ├── application/
│   │       │   ├── infrastructure/
│   │       │   └── interface/
│   │       └── synonyms/
│   │           └── index.ts               # 合成ルート + HTTP エントリポイント
│   └── README.md                          # backend 固有の手順
│
├── frontend/                              # ── フェーズ 5 で作成 ──
│   ├── app.json / app.config.ts           # Expo 設定
│   ├── package.json
│   ├── tsconfig.json
│   ├── app/                               # Expo Router のルート定義（画面）
│   ├── src/
│   │   ├── features/                      # 機能単位（auth / synonyms / history / profile）
│   │   └── shared/                        # supabase クライアント、api、query、ui、theme
│   ├── public/                            # Web 専用の静的ファイル
│   │   ├── manifest.webmanifest
│   │   └── sw.js
│   └── vercel.json                        # SPA フォールバック / ヘッダ
│
└── .github/workflows/                     # ── フェーズ 6 で作成 ──
```

> **注**: `frontend/src/` の内訳は当初この場所で層優先（`domain` / `application` /
> `infrastructure` / `ui`）として素描していたが、フェーズ 4 で feature 優先へ変更した
> （[ADR-0010](./adr/0010-feature-based-frontend-structure.md)）。
> 正典は [`frontend-design.md`](./frontend-design.md) §4。

**現時点（フェーズ 4 完了時）で存在するのは `docs/` と `backend/` および直下のファイル。**
空ディレクトリを先に作らない方針とする（存在＝中身がある、を保つため）。

### `backend/supabase/` という二重の階層について

Supabase CLI は `supabase/` ディレクトリをプロジェクトルートとして認識する。
`backend/` 直下に `migrations/` や `functions/` を置くのではなく `backend/supabase/` を挟むのは、
CLI の規約に従うことでコマンドを素の形（`supabase db push`）で使えるようにするため。
`backend/` で `supabase link` を実行すれば、CLI は `backend/supabase/` を認識する。

## 2. 共通型定義（`packages/shared`）の扱い

**結論: 現時点では `packages/shared` を作らず、frontend / backend それぞれで型を定義する。**
（[ADR-0002](./adr/0002-no-shared-package-for-now.md)）

理由:

1. **共有したい型が API の DTO 1 組しかない**。MVP の Edge Function は 1 本
   （`POST /synonyms`）で、共有対象はそのリクエスト / レスポンス型だけ。
   このために npm workspaces + Metro の monorepo 設定 + Deno の import map 調整を
   導入するのは、得られる利益に対してセットアップと維持のコストが見合わない。
2. **ランタイムが異なる**。Edge Functions は Deno、フロントは Metro バンドラで動く。
   両者から 1 つのパッケージを解決させるには、Deno 側は相対パスまたは import map、
   Metro 側は `watchFolders` と `nodeModulesPaths` の設定が必要になる。
   デプロイ時のバンドル範囲（`supabase functions deploy` が関数ディレクトリ外の
   相対 import をどう扱うか）にも依存し、壊れたときの原因追跡が難しい。
3. **DB 型は共有しない方が正しい**。`supabase gen types typescript` で生成される型は
   フロント側の PostgREST 呼び出しに使うもので、Edge Function 側は `service_role` で
   別の関心を持つ。無理に共通化すると、片方の都合でもう片方が壊れる。
4. **契約の正典はドキュメントに置く**。型を 2 箇所に書くことのリスクは「ズレ」だが、
   [`api-spec.md`](./api-spec.md) を単一の正典とし、
   さらにサーバー側で zod による実行時検証を行うため、ズレは実行時に必ず検出される。

**導入するタイミング（トリガー条件）**:

- Edge Function が 2 本以上になり、同じ DTO を共有し始めたとき
- 型の不一致に起因するバグが実際に 1 件でも発生したとき

そのときは `packages/shared/src/api/` に **型定義と zod スキーマのみ**（実行時依存ゼロ）を置き、
frontend / backend の両方から参照する。ディレクトリ位置は上記の構造に予約しておく。

## 3. 使用予定パッケージ（フロントエンド）

フェーズ 5 で導入予定。バージョンは実装時点の最新安定版にピン留めする。

### 3.1 基盤

| パッケージ | 用途 | 選定理由 |
| --- | --- | --- |
| `expo` (SDK 54 以降) | ランタイム / ビルド基盤 | iOS と Web を単一コードベースで扱える唯一の現実的な選択肢。EAS Build により Xcode 依存を最小化できる |
| `react-native` / `react` | UI ランタイム | 前提 |
| `react-native-web` | Web レンダラ | Expo for Web が内部で使用。RN のコンポーネントを DOM に写像する |
| `typescript` | 型 | 前提。`strict: true` |
| `react-native-safe-area-context` | セーフエリア | iOS のノッチ / ホームインジケータ対応。Expo Router が依存 |
| `react-native-screens` | ネイティブ画面遷移 | 遷移パフォーマンス。Expo Router が依存 |

### 3.2 ルーティング

| パッケージ | 用途 |
| --- | --- |
| `expo-router` | ファイルベースルーティング |

**React Navigation を直接使わず Expo Router を採用する**
（[ADR-0003](./adr/0003-expo-router.md)）。理由:

- Expo Router は React Navigation の上に構築されているため、機能的に劣らない
- **Web で実 URL を持つ**。PWA として配信する以上、`/synonyms?word=improve` のような
  URL が成立することは必須に近い。React Navigation 単体で Web の URL 設計を行うと
  `linking` 設定を手書きすることになり、画面追加のたびに 2 箇所を更新する必要がある
- **OAuth のリダイレクトコールバック**（`/auth/callback`）をルートとして自然に表現できる
- ネイティブのディープリンクと Web の URL が同じ定義から生成されるため、
  プラットフォーム差異が減る（§ architecture.md 6 の方針と一致）

### 3.3 状態管理

| パッケージ | 用途 | 選定理由 |
| --- | --- | --- |
| `@tanstack/react-query` | サーバー状態（履歴取得、類義語生成） | 本アプリの状態はほぼ全てがサーバー由来。キャッシュ / 再取得 / ローディング / エラーの状態機械を自前で書かずに済む。生成のリトライ UX（`mutation` の `isPending` / `error`）とも相性が良い |
| `zustand` | クライアント状態（認証セッション、UI 状態） | Auth セッションのようなグローバルだが小さい状態のためだけに Redux Toolkit を入れるのは過剰。Provider 地獄にならず、`onAuthStateChange` の購読結果を流し込むだけで済む |

**Redux Toolkit を採用しない理由**: MVP における「クライアント固有の状態」は
認証セッションと入力中の単語程度で、Redux が解決する問題（複雑な状態遷移、
時間軸デバッグ、大規模チームでの規約）が存在しない
（[ADR-0004](./adr/0004-state-management.md)）。

### 3.4 Supabase / 認証

| パッケージ | 用途 | 備考 |
| --- | --- | --- |
| `@supabase/supabase-js` (v2) | Auth / PostgREST / Functions 呼び出し | 公式クライアント |
| `expo-secure-store` | ネイティブのセッション永続化 | Keychain 経由。Web では未使用 |
| `expo-auth-session` + `expo-web-browser` | Google OAuth（ネイティブ） | `signInWithIdToken` に渡す ID トークンを取得 |
| `expo-apple-authentication` | Apple ログイン（ネイティブ） | **iOS 審査要件のため必須**。ネイティブ UI を出す |
| `expo-linking` | ディープリンク / リダイレクト URL 生成 | カスタムスキームと Web URL を統一的に扱う |
| `expo-crypto` | PKCE 用の乱数 / ハッシュ | OAuth フローで必要になる場合 |

### 3.5 その他

| パッケージ | 用途 | 選定理由 |
| --- | --- | --- |
| `zod` | 入力バリデーション / API レスポンス検証 | Edge Function 側でも同じライブラリを使い、検証の書き方をプロジェクト全体で統一する |
| `expo-constants` | 環境変数 / アプリ設定の参照 | `EXPO_PUBLIC_*` の読み出し |
| `eslint` + `eslint-config-expo` + `prettier` | 静的解析・整形 | Expo 公式構成に従う |

**採用しないもの**:

- UI コンポーネントライブラリ（NativeBase / Tamagui / gluestack 等）
  … MVP の画面数が少なく、React Native の素のプリミティブ + `StyleSheet` で足りる。
  依存を増やすと Web ビルドサイズと Expo SDK 追従コストが上がる。
- `react-native-reanimated` の明示的導入
  … 現時点でカスタムアニメーション要件がない。必要になった時点で追加する。
- i18n ライブラリ … アプリ UI の多言語対応は MVP スコープ外。

## 4. 使用予定パッケージ（バックエンド / Deno）

| パッケージ | 用途 |
| --- | --- |
| `jsr:@supabase/supabase-js@2` | Postgres アクセス、JWT からのユーザー解決 |
| `npm:zod` | リクエスト検証、DeepSeek レスポンス検証 |
| （標準の `fetch`） | DeepSeek 呼び出し。HTTP クライアントライブラリは入れない |

DeepSeek 公式 SDK / OpenAI SDK は**使わない**。
DeepSeek API は OpenAI 互換の単純な HTTP エンドポイントであり、
必要なのは 1 つの POST だけ。SDK を挟むとタイムアウト・リトライ・
`AbortController` の制御が SDK 実装に依存し、コスト制御（リトライ回数の上限）が曖昧になる。
素の `fetch` を薄いクラス（`DeepSeekClient`）で包む方が意図を明示できる。

## 5. Vercel デプロイ構成（概要）

詳細は [`deployment.md`](./deployment.md)。ここでは構成の要点のみ。

| 設定項目 | 値 |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | Other（Expo のプリセットは使わず明示指定する） |
| Install Command | `npm ci` |
| Build Command | `npx expo export --platform web` |
| Output Directory | `dist` |
| Node.js Version | 22.x |
| デプロイ対象 | `frontend/` の静的ビルド成果物のみ |
| Vercel 上の関数 | **なし**（API Routes / Serverless / Edge Functions は使わない） |

`backend/` は Vercel にデプロイしない。Supabase CLI（将来的には GitHub Actions）から
Supabase へ直接デプロイする。`.vercelignore` またはビルド設定で `backend/` と `docs/` が
ビルドに含まれないことを保証する（Root Directory 指定により自動的に除外される）。

**環境変数の扱い**: Vercel に設定するのは `EXPO_PUBLIC_SUPABASE_URL` と
`EXPO_PUBLIC_SUPABASE_ANON_KEY` の 2 つのみ。どちらもビルド時に JS バンドルへ
埋め込まれ公開される前提の値で、実際の保護は Postgres の RLS が担う。
`DEEPSEEK_API_KEY` と `SUPABASE_SERVICE_ROLE_KEY` を Vercel に置いてはならない。
