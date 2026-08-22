# ロードマップ / フェーズ計画

## MVP スコープ（今回）

MVP に含む機能は **認証** と **類義語生成** の 2 つのみ。それ以外は明示的にスコープ外とする。

| # | フェーズ | 内容 | 状態 |
| --- | --- | --- | --- |
| 0 | ドキュメント整備 | `docs/` 構成、`README.md`、`CLAUDE.md` | 完了 |
| 1 | リポジトリ構成・技術選定 | ディレクトリ構造、パッケージ選定、Vercel デプロイ構成 | 完了 |
| 2 | バックエンド設計 | DB スキーマ、RLS、Edge Functions API、DeepSeek 連携設計 | 完了 |
| 3 | バックエンド実装 | マイグレーション、Edge Function 実装 | 完了 |
| 4 | フロントエンド設計 | 画面構成、状態管理、ディレクトリ構造、Web/PWA 対応 | 完了 |
| 5 | フロントエンド実装 | Expo アプリ実装 | 未着手 |
| 6 | E2E / CI / デプロイ | GitHub Actions、E2E テスト、Vercel パイプライン | 未着手 |

各フェーズの完了時に設計内容を報告する。

## 将来機能（スコープ外・設計時に阻害しないことだけ担保する）

以下は MVP に含めないが、DB スキーマと API 層がこれらの追加を妨げないことを設計上の制約とする。
ただし**先回りしてテーブルやエンドポイントを作らない**（YAGNI）。

| 機能 | 想定する拡張ポイント | 先回り実装 |
| --- | --- | --- |
| 単語帳（保存・復習） | `terms` / `synonym_items` を参照する `vocabulary_entries` を新設 | しない |
| 例文生成 | `terms` に紐づく `example_generations` を新設。`lookups.kind` に `example` を追加 | しない（`kind` 列のみ用意） |
| ロールプレイ会話 | 独立した `conversation_sessions` / `conversation_messages` | しない |
| 多言語対応（英語以外） | `terms.language` 列で既に表現可能 | 列のみ用意（値は `en` 固定） |
| 発音・音声 | `terms` に紐づく別テーブル、または外部 TTS | しない |

## スコープ外であることを明示する項目

- **デスクトップ画面幅向け UI**：`architecture.md`「UI 前提」参照。設計・実装ともに行わない。
- **Vercel をバックエンドに使うこと**：Vercel はフロント配信のみ。API Routes / Vercel Edge Functions は採用しない。
- **モック / スタブ / ダミーデータ**：開発・テストとも実 Supabase・実 DeepSeek に接続する。
