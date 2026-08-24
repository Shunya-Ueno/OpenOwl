# ADR-0002: 現時点では packages/shared を作らない

- **状態**: Accepted
- **日付**: 2026-08-22
- **フェーズ**: 1

## 背景

Edge Function のリクエスト / レスポンス型を frontend と backend の両方が必要とする。
共通パッケージ（`packages/shared`）を作るか、各側で型を定義するかを決める必要がある。

## 決定

**現時点では `packages/shared` を作らず、frontend / backend でそれぞれ型を定義する。**
API 契約の正典は `docs/api-spec.md` とし、サーバー側で zod による実行時検証を行う。

## 理由

- 共有対象が **DTO 1 組のみ**。MVP の Edge Function は `POST /synonyms` の 1 本しかない。
- ランタイムが異なる。Deno（Edge Functions）と Metro（Expo）の両方から 1 パッケージを
  解決させるには import map / `watchFolders` / `nodeModulesPaths` の調整が必要で、
  さらに `supabase functions deploy` のバンドル範囲にも依存する。壊れたときの調査コストが高い。
- DB 型（`supabase gen types typescript`）は共有すべきでない。フロントは PostgREST 経由の
  型として、Edge Function は `service_role` としての関心で使うため、共通化すると
  片方の都合がもう片方を壊す。
- 型を 2 箇所に書くリスクは「ズレ」だが、サーバー側の zod 検証により実行時に必ず露見する。
  MVP 段階ではこの検出で十分。

## 検討したが採用しなかった案

| 案 | 却下理由 |
| --- | --- |
| 最初から `packages/shared` を作る | セットアップ・維持コストが、DTO 1 組の重複を避ける利益を上回る（YAGNI） |
| OpenAPI から型を生成する | エンドポイント 1 本のためにスキーマ定義と生成パイプラインを持つのは過剰 |
| Edge Function 側から相対パスで frontend の型を import | デプロイ時のバンドル範囲が不確実で、依存方向も逆転する |

## 結果 / 影響

- `docs/api-spec.md` が API 契約の唯一の正典になる。契約変更時はドキュメントを先に更新する。
- **見直しのトリガー**（どちらか一方でも満たしたら `packages/shared` を導入する）:
  1. Edge Function が 2 本以上になり、同じ DTO を共有し始めたとき
  2. 型の不一致に起因するバグが実際に 1 件でも発生したとき
- 導入時は `packages/shared/src/api/` に**型定義と zod スキーマのみ**（実行時依存ゼロ）を置く。
