# Architecture Decision Record (ADR)

判断が分かれた設計上の選択と、その理由を記録します。
**ADR は追記のみ**です。決定を覆す場合は既存 ADR を書き換えず、
新しい ADR を追加し、旧 ADR のステータスを `Superseded by ADR-XXXX` に変更します。

「今どうなっているか」は `docs/*.md` の設計ドキュメントを、
「なぜそうなったか」はこの ADR を読んでください。

## 一覧

| ID | タイトル | ステータス |
| --- | --- | --- |
| [0001](./0001-monorepo-structure.md) | モノレポ構成と npm workspaces の採用 | Accepted |
| [0002](./0002-shared-types-deferred.md) | 共通型パッケージ（`packages/shared`）を MVP では作らない | Accepted |
| [0003](./0003-expo-managed-workflow.md) | React Native の実行基盤に Expo を採用する | Accepted |
| [0004](./0004-edge-functions-for-privileged-ops.md) | Edge Functions は特権操作のみ。読み取りは PostgREST + RLS を使う | Accepted |
| [0005](./0005-relational-synonyms-over-jsonb.md) | 類義語をリレーショナルに保存する（jsonb 単一カラムにしない） | Accepted |
| [0006](./0006-no-mocks-testing-policy.md) | モックを使わないテスト方針とその運用 | Accepted |
| [0007](./0007-shared-synonym-cache.md) | 生成結果をユーザー横断でキャッシュする | Accepted |
| [0008](./0008-expo-router.md) | ルーティングに Expo Router を採用する | Accepted |
| [0009](./0009-feature-based-frontend-structure.md) | フロントエンドを feature-based 構成にする | Accepted |
| [0010](./0010-frontend-state-management.md) | 状態管理はグローバルストアを導入せず、性質ごとに道具を分ける | Accepted |

## テンプレート

```markdown
# ADR-XXXX: <タイトル>

- **ステータス**: Proposed / Accepted / Superseded by ADR-YYYY
- **日付**: YYYY-MM-DD
- **決定者**: <モデル名 or 人名>

## 背景
何が問題で、何を決める必要があるのか。

## 選択肢
検討した案と、それぞれの利点・欠点。

## 決定
採用した案。

## 理由
なぜそれを選んだか。何を重視し、何を捨てたか。

## 影響
この決定によって何が変わるか。将来見直す条件（トリガー）は何か。
```
