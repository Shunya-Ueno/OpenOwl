# frontend

Expo（React Native + TypeScript）アプリ。iOS ネイティブ + Web/PWA。
設計は [`../docs/frontend-design.md`](../docs/frontend-design.md) を参照。

## セットアップ

```bash
cd frontend
npm install
cp .env.example .env.local   # テスト用 Supabase プロジェクトの値を設定する
npm run start                 # Expo dev server
npm run web                   # Web のみ
npm run ios                   # iOS シミュレータ
```

## 環境変数

[`.env.example`](./.env.example) を参照。`EXPO_PUBLIC_` 接頭辞の値は
ビルド時に JS バンドルへ埋め込まれ公開されるため、秘密情報は置かない
（詳細はリポジトリ直下の [`README.md`](../README.md)）。

`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` は Google ネイティブサインインにのみ使う。
未設定でもアプリ自体は起動し、Email/Password 認証と類義語生成は動作する
（Google ログインボタンを押したときだけエラーになる）。

## 開発コマンド

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run build:web    # 静的エクスポート → dist/
npm run test         # 単体テスト（Vitest）
npm run e2e          # Web の E2E（Playwright）
npm run e2e:ui       # 同上・対話モード
```

## テスト

設計は [`../docs/testing-ci.md`](../docs/testing-ci.md)。モック禁止の方針から、
**単体テストは外部 I/O を持たない純粋ロジックのみ**を対象とし、
画面の挙動は実ブラウザ・実 Supabase に対する E2E が担う
（[ADR-0016](../docs/adr/0016-unit-tests-limited-to-pure-logic.md)）。

```
src/**/*.test.ts      # 単体テスト（Vitest）。ソースと同じ場所に置く
e2e/web/              # Playwright。PR のマージ条件
e2e/preview/          # Vercel プレビューへのスモーク
e2e/maestro/          # Maestro（iOS ネイティブ）。README を参照
```

E2E を回すには、`.env.local` に Supabase の値に加えて
**E2E 専用アカウント**の資格情報が必要（[`../docs/testing-ci.md`](../docs/testing-ci.md) §6.3）。

```bash
# frontend/.env.local に追記
E2E_USER_EMAIL=e2e@example.com
E2E_USER_PASSWORD=xxxxxxxx
```

```bash
npm run build:web    # E2E は dist/ をそのまま配信して動かす
npm run e2e
```

E2E のセレクタは [`src/shared/testIds.ts`](./src/shared/testIds.ts) に集約してある。
`testID` は Web では `data-testid`、iOS では accessibility identifier になるため、
**Playwright と Maestro で同じ識別子を共有できる**。

## ディレクトリ構造

feature-based（[ADR-0010](../docs/adr/0010-feature-based-frontend-structure.md)）。

```
app/                  # Expo Router のルート定義のみ
src/
├── features/
│   ├── auth/
│   ├── synonyms/
│   ├── history/
│   └── profile/
└── shared/            # supabase クライアント、api、query、ui、theme
e2e/                    # Playwright(web/ preview/) と Maestro(maestro/)
public/                 # Web 専用(manifest / sw.js / icons)
```

## モックは使わない

開発中も実際の Supabase（テスト用プロジェクト）と実際の DeepSeek に接続する。
Storybook / MSW / ダミーデータ生成器は導入しない
（docs/frontend-design.md §12）。

テストでも同様に、`vi.mock` / `vi.fn`、Playwright の `page.route()` による
レスポンス偽装、`@testing-library/react-native` は使わない。
ネットワークの**観測**（`page.on('request')` で回数を数える）は差し替えではないので使う。
