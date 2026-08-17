# ADR-0001: モノレポ構成と npm workspaces の採用

- **ステータス**: Accepted
- **日付**: 2026-08-16
- **決定者**: Claude（設計フェーズ / Opus）

## 背景

リポジトリ直下に `frontend/` と `backend/` を置くモノレポ構成が要件で確定している。
残る論点は「モノレポをどのツールで管理するか」。
`backend/` は Deno（Supabase Edge Functions）、`frontend/` は Node + Metro バンドラで動く。

## 選択肢

1. **npm workspaces のみ** — ルート `package.json` に `workspaces: ["frontend"]`。
   `backend/` は npm 依存を持たず、Supabase CLI をスクリプトから叩くだけ。
2. **pnpm workspaces** — ディスク効率とストリクトな依存解決に優れる。
   ただし React Native / Metro はシンボリックリンク主体の `node_modules` と相性の問題が出やすく、
   `node-linker=hoisted` などの追加設定が要る。
3. **Turborepo / Nx を追加** — タスクグラフとリモートキャッシュ。

## 決定

**npm workspaces のみ**を採用する。ビルドオーケストレータ（Turborepo / Nx）は導入しない。

## 理由

- 実質的なワークスペースは `frontend` の1つだけ。`backend` は Deno なので npm の依存解決の外にある。
  タスクグラフを組む対象がないため、Turborepo / Nx の主要な価値（並列実行・キャッシュ）が効かない。
- pnpm の利点（ディスク効率）はワークスペース1つでは小さく、
  Metro との相性問題を踏むリスクの方が大きい。React Native では素直な hoisting が安全。
- 開発者が追加でインストールするツールを増やさない。Node と Supabase CLI だけで完結させる。

## 影響

- ルート `package.json` は「開発コマンドの入口」として機能する。
  実体は `frontend`（npm script 委譲）と `supabase` CLI 呼び出し。
- `backend/package.json` は依存を持たず、スクリプト定義のみを置く。
- 再検討のトリガー:
  - ワークスペースが3つ以上になった（例: `packages/shared` + Web 版の追加）
  - CI のインストール〜ビルドが5分を超えた
  - 同じ lint/test を複数ワークスペースで重複実行するようになった
