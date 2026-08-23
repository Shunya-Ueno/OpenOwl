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
npm run typecheck   # tsc --noEmit
npm run lint         # ESLint
npm run build:web    # 静的エクスポート → dist/
```

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
public/                 # Web 専用(manifest / sw.js / icons)
```

## モックは使わない

開発中も実際の Supabase（テスト用プロジェクト）と実際の DeepSeek に接続する。
Storybook / MSW / ダミーデータ生成器は導入しない
（docs/frontend-design.md §12）。
