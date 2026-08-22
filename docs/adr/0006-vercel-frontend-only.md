# ADR-0006: Vercel はフロント配信専用とし、バックエンドを置かない

- **状態**: Accepted
- **日付**: 2026-08-22
- **フェーズ**: 1

## 背景

Vercel は API Routes / Serverless Functions / Edge Functions を提供しており、
バックエンド処理を置くことができる。Supabase Edge Functions と併用するか、
どちらか一方に寄せるかを決める必要がある。

## 決定

**Vercel は `frontend/` の静的ビルド成果物の配信のみに使う。**
バックエンドは Supabase Edge Functions に一本化し、Vercel 上に関数を作らない。
（これは本プロジェクトの前提条件としても指定されている。）

## 理由

- バックエンドが 2 箇所に分かれると、JWT の検証・認可（RLS との関係）・
  シークレット管理・CORS 設定・ログの見る場所がすべて二重化する。
  そのうえ「新しい API をどちらに書くか」の判断が毎回発生する。
- Supabase Edge Functions は Postgres と同一プロジェクト内にあり、
  `service_role` による特権アクセスと RLS の境界が 1 箇所に閉じる。
  Vercel から Supabase を叩く構成にすると、この境界がネットワークをまたいで分散する。
- DeepSeek API キーの保管場所を 1 つに限定できる。置き場所が増えるほど漏洩面が広がる。
- 静的配信に限定すれば、Vercel 側の設定は Root Directory / Build Command /
  Output Directory と `vercel.json` だけで完結し、運用対象が最小になる。

## 検討したが採用しなかった案

| 案 | 却下理由 |
| --- | --- |
| Vercel に API Routes を置き、Supabase は DB/Auth のみ | Edge Functions と RLS の境界が分散する。前提条件にも反する |
| 両方に API を置いて用途で使い分け | 判断コストと二重管理。MVP に持ち込む理由がない |
| Supabase Storage 等で静的配信し Vercel を使わない | プレビューデプロイ・CDN・ヘッダ制御を自前で用意することになる |

## 結果 / 影響

- `frontend/` に `api/` ディレクトリを作らない。
- Vercel に置く環境変数は `EXPO_PUBLIC_*` の 2 つのみ。
  `DEEPSEEK_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` を置くことを**禁止**する。
- SSR を使わないため、Expo の `web.output` は `"single"`（SPA）とする。
