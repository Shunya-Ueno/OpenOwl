# ADR-0015: 本番のフロントエンドデプロイを Vercel の Git 連携から外し、バックエンドデプロイの後段に置く

- **状態**: Accepted
- **日付**: 2026-08-23
- **フェーズ**: 6

## 背景

[deployment.md](../deployment.md) §4 に、リリース順序の制約を明文化してある。

> 1. Supabase のマイグレーションを先に適用する
> 2. Edge Function をデプロイする
> 3. フロントエンドをデプロイする

理由も同じ節に書いてある。静的配信されたフロントエンドは CDN キャッシュと
Service Worker により**旧版がしばらく生き残る**ため、バックエンドを先に新しくしておかないと
「新フロント + 旧バックエンド」の組み合わせが発生する。

フェーズ 6 でこれを自動化するにあたり、問題が生じる。
Vercel の GitHub 連携は `main` への push で**即座に**本番ビルドを始める。
一方 Supabase 側は GitHub Actions で走る。両者は互いを知らないので、
**フロントエンドが先に出る**。自動化した結果として、自分で書いた制約を自分で破ることになる。

## 決定

1. `frontend/vercel.json` で **`main` に対する Vercel の自動デプロイを無効化する**。

   ```jsonc
   "git": { "deploymentEnabled": { "main": false } }
   ```

2. `deploy.yml` が `main` への push を受け、**Supabase → フロントエンド**の順に進める。
   フロントエンドの起動は **Vercel Deploy Hook への POST** で行う。
3. **プレビューは従来どおり Vercel の Git 連携に任せる。** PR ブランチの
   自動デプロイは無効化しない。

## 理由

- 順序制約はドキュメント上の努力目標ではなく、**壊れると実害（新フロント + 旧バックエンド）が出る**
  性質のものである。人間の運用規律ではなくパイプラインの構造で守るべき。
- `needs:` によるジョブ依存は、順序を宣言するもっとも単純な手段。
  「Supabase が成功しなければフロントエンドは出ない」が 1 行で表現できる。
- **プレビューを Git 連携のままにする**のは、プレビューにこの制約が存在しないため。
  プレビューはテスト用 Supabase を向いており、そこに旧版の PWA 利用者はいない。
  無効化すると PR ごとにフックを叩く仕組みが必要になり、得るものがない。

### なぜ Vercel CLI ではなく Deploy Hook か

必要なのは「本番ビルドを開始させる」ことだけで、それには署名付き URL への POST で足りる。

`vercel deploy --prod` を CLI で実行すると:

- `VERCEL_TOKEN`（アカウント全体に効く強い資格情報）を CI に置くことになる
- **ビルドが CI 側で走る**ため、Vercel 側のビルドキャッシュが効かず、
  環境変数の解決経路もダッシュボードの設定とは別物になる

Deploy Hook なら CI が持つ権限は「このプロジェクトのこのブランチのビルドを開始できる」に限定され、
ビルド自体は普段どおり Vercel 上で走る。

### なぜ `db push` / `functions deploy` を無条件に実行するか

「backend に変更があったか」を CI で判定する仕組み（パスフィルタ、`git diff`）は、
force push や squash merge で `github.event.before` が期待どおりにならない場合に静かに誤る。

両コマンドとも冪等である:

- `supabase db push` は未適用のマイグレーションが無ければ何もしない
- `supabase functions deploy` は同じコードの再デプロイであり無害

判定を持たない方が壊れにくい。代償は main への push ごとに Function のバージョンが
1 つ増えることだが、実害がない。

## 検討したが採用しなかった案

| 案 | 却下理由 |
| --- | --- |
| Vercel の Git 連携を本番でも維持し、順序は運用で守る | 自動化の意味がない。push した瞬間に順序が破れるため、人間が介入する余地がない |
| Supabase 側も Vercel の Build Command 内で実行する | Vercel のビルドコンテナから `supabase db push` を叩くことになり、`SUPABASE_ACCESS_TOKEN` を Vercel に置く必要が出る。[security.md](../security.md) の「置き場所で公開範囲が決まる」方針に反し、Vercel はフロント配信のみという [ADR-0006](./0006-vercel-frontend-only.md) にも反する |
| `vercel deploy --prod` を CLI で実行する | 上記のとおり、権限が過大でビルド経路も変わる |
| 後方互換なマイグレーションだけを許し、順序を気にしない | 後方互換性の判断を毎回人間に委ねることになる。列削除のような破壊的変更が混ざったときに落ちる |

## 結果 / 影響

- **人手が必要な設定が 2 つ増える**（どちらもダッシュボード操作）:
  1. Vercel で本番ブランチ向けの Deploy Hook を作成し、URL を GitHub Secrets の
     `VERCEL_DEPLOY_HOOK_URL` に登録する
  2. `deploy.yml` が使う GitHub Environment `production` を作成する（承認レビューを
     required にするかは任意）
- **`VERCEL_DEPLOY_HOOK_URL` が未設定だと本番デプロイが一切走らなくなる。**
  `vercel.json` 側で自動デプロイを切っているため、フックが無ければ誰も本番を出せない。
  この依存関係は [deployment.md](../deployment.md) §5 に明記する。
- ロールバックは Vercel ダッシュボードの Promote で行う（フックとは独立）。
- 見直しのトリガー: Supabase 側のデプロイが十分に速く・確実になり、
  順序制約が実質的に問題にならなくなったとき。あるいは Vercel が
  「外部チェックの成功を待ってデプロイする」機能を提供したとき。
