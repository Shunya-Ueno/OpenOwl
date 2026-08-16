# OpenOwl ドキュメント

OpenOwl（外国語学習アプリ）の設計ドキュメント一式です。
**実装より先にドキュメントを更新する**ことをプロジェクトの原則とします。

## ドキュメント構成

| ファイル | 内容 | 主な読者 | 状態 |
| --- | --- | --- | --- |
| [`roadmap.md`](./roadmap.md) | フェーズ計画・スコープ境界・完了条件 | 全員 | ✅ |
| [`architecture.md`](./architecture.md) | システム全体構成、コンポーネント責務、リクエストフロー | 全員 | ✅ |
| [`repository-structure.md`](./repository-structure.md) | モノレポのディレクトリ構成、技術選定と使用パッケージ | 開発者 | ✅ |
| [`db-schema.md`](./db-schema.md) | テーブル定義、ER図、インデックス、DDL | バックエンド | ✅ |
| [`api-spec.md`](./api-spec.md) | Edge Functions のエンドポイント仕様（req/res/エラー） | 全員 | ✅ |
| [`backend-design.md`](./backend-design.md) | Edge Functions の内部クラス設計・レイヤー構成 | バックエンド | ✅ |
| [`security.md`](./security.md) | RLS ポリシー、APIキー管理、認証フロー、脅威と対策 | 全員 | ✅ |
| [`error-handling.md`](./error-handling.md) | エラー分類、リトライ方針、フォールバックUX | 全員 | ✅ |
| [`adr/`](./adr/) | Architecture Decision Record（意思決定の記録） | 全員 | ✅ |
| `frontend/` | （将来）画面遷移図、状態管理方針、ディレクトリ構成 | フロントエンド | ⬜ Phase 4 |
| `testing/` | （将来）E2E戦略、CI パイプライン、テスト用環境の扱い | 全員 | ⬜ Phase 6 |

## この構成にした理由

1. **1ファイル = 1つの関心事**
   `architecture.md` に全部を書くと肥大化し、部分更新のたびに全体レビューが必要になります。
   DBスキーマ・API仕様・セキュリティは変更頻度も担当者も異なるため分離しました。

2. **「決定」と「現状」を分離**
   `docs/*.md` は**現在の設計（常に最新の正）**、`docs/adr/*.md` は**なぜそう決めたか（追記のみ、書き換えない）**を記録します。
   設計ドキュメントに「〜という案もあったが〜」という経緯を混ぜると、
   読み手が「今どうなっているか」を読み取れなくなるためです。

3. **将来フェーズのディレクトリを先に確保しない**
   `frontend/`・`testing/` は Phase 4 以降で実際に書く段階になってから作成します。
   空ディレクトリを先に切っても Git では追跡されず、`.gitkeep` は雑音になるためです。
   ただし「どこに書くか」だけはこの表で先に決めておきます。

4. **API仕様を単一の正とする**
   MVP 時点では型定義を `frontend`/`backend` それぞれで持つため（[ADR-0002](./adr/0002-shared-types-deferred.md)）、
   両者の契約は [`api-spec.md`](./api-spec.md) が唯一の正となります。ここがズレると本番で壊れます。

## ドキュメント運用ルール

- 設計変更を伴う PR は、該当ドキュメントの更新を同一 PR に含める。
- 判断が分かれた設計上の選択は ADR を1本追加する（テンプレートは [`adr/README.md`](./adr/README.md)）。
- 決定を覆す場合は既存 ADR を書き換えず、新しい ADR を追加して旧 ADR を `Superseded` にする。
- 未確定事項は本文中に `TODO(Phase N):` の形式で残し、放置されないようにする。
