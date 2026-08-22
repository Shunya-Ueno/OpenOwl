# デプロイ構成

デプロイ先は 2 つあり、**互いに独立してデプロイできる**。

| 対象 | デプロイ先 | トリガー（フェーズ 6 で自動化） |
| --- | --- | --- |
| `frontend/`（Web/PWA） | Vercel | GitHub push（`main` → 本番 / PR → プレビュー） |
| `frontend/`（iOS） | App Store（EAS Build / Submit） | 手動 or タグ |
| `backend/`（マイグレーション + Edge Functions） | Supabase | `main` への push（当面は手動） |

## 1. Vercel（Web / PWA）

### 1.1 プロジェクト設定

Vercel ダッシュボードで以下を設定する（**人手が必要な作業**）。

| 項目 | 値 | 補足 |
| --- | --- | --- |
| Root Directory | `frontend` | これにより `backend/` と `docs/` はビルドコンテキストから外れる |
| Framework Preset | Other | Expo 用プリセットに頼らず明示指定する |
| Install Command | `npm ci` | ロックファイル固定 |
| Build Command | `npx expo export --platform web` | 静的エクスポート |
| Output Directory | `dist` | `expo export` の既定出力先 |
| Node.js Version | 22.x | |

**Vercel 上に Serverless / Edge Function は作らない。** `api/` ディレクトリを置かない。

### 1.2 Expo の Web 出力モード

`app.json` で `web.output` を **`"single"`（SPA）** とする。

```jsonc
// frontend/app.json（抜粋・フェーズ 5 で作成）
{
  "expo": {
    "web": {
      "bundler": "metro",
      "output": "single"
    }
  }
}
```

理由:

- 本アプリは全画面が認証後の動的コンテンツで、SSG によるプリレンダリングの利益がない
- PWA として「アプリシェルを 1 度読み込んで以降クライアント側で遷移する」モデルが自然
- `"static"`（ルートごとに HTML 生成）は Vercel 側のルーティング設定が複雑になるだけで、
  SEO 要件のない本アプリでは得るものがない

SPA のため、すべてのパスを `index.html` にフォールバックさせる必要がある。

### 1.3 `vercel.json`

`frontend/vercel.json` に配置する（フェーズ 5 で作成）。設計内容:

```jsonc
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    // SPA フォールバック。静的ファイルに一致しないパスはすべてアプリシェルへ
    { "source": "/((?!_expo/|assets/|favicon.ico|manifest.webmanifest|sw.js).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      // Service Worker は必ず最新を取りに行かせる（古い SW が居座るのを防ぐ）
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" },
        { "key": "Service-Worker-Allowed", "value": "/" }
      ]
    },
    {
      // ハッシュ付きバンドルは長期キャッシュ
      "source": "/_expo/static/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}
```

CSP は `connect-src` に Supabase のドメインを含める必要があるため、
フェーズ 5 で実際のバンドル構成を見てから確定する（インラインスクリプトの有無に依存する）。

### 1.4 PWA 化

Expo は Service Worker と manifest を自動生成しない（`expo-pwa` は廃止済み）。
`frontend/public/` に手で置き、`expo export` が `dist/` へコピーする経路に乗せる。

| ファイル | 内容 |
| --- | --- |
| `public/manifest.webmanifest` | `name` / `short_name` / `start_url: "/"` / `display: "standalone"` / `theme_color` / `background_color` / アイコン（192・512・maskable） |
| `public/sw.js` | アプリシェルのみをプリキャッシュ。ナビゲーションリクエストは network-first、静的アセットは cache-first |

**Service Worker のキャッシュ方針で守ること**:

- **Supabase へのリクエスト（`/auth/v1`, `/rest/v1`, `/functions/v1`）を一切キャッシュしない。**
  認証トークンやユーザー固有データが Cache Storage に残るのを防ぐため。
- オフライン時の機能は「アプリシェルの表示」までとする。
  履歴のオフライン閲覧は MVP スコープ外（フェーズ 4 で必要性を再評価する）。

### 1.5 プレビュー / 本番の分岐

| 環境 | ブランチ | 向き先 Supabase | 用途 |
| --- | --- | --- | --- |
| Production | `main` | 本番プロジェクト | 実ユーザー |
| Preview | PR ブランチ | **テスト用プロジェクト** | レビュー / E2E |
| Development（ローカル） | — | テスト用プロジェクト | 開発 |

Vercel の環境変数は Production / Preview で別々の値を設定できるため、
同じコードのままプレビューだけテスト用 Supabase を向かせる。

**注意**: Vercel のプレビュー URL はデプロイごとに変わる
（`openowl-<hash>-<scope>.vercel.app`）。Supabase Auth の Redirect URLs に
ワイルドカード（例: `https://openowl-*-<scope>.vercel.app/**`）を登録しないと、
プレビュー環境で OAuth ログインが失敗する。これはテスト用 Supabase プロジェクト側にのみ
登録し、本番プロジェクトには固定ドメインのみを登録する。

## 2. Supabase（バックエンド）

### 2.1 プロジェクト構成

| プロジェクト | 用途 |
| --- | --- |
| `openowl-prod` | 本番 |
| `openowl-test` | ローカル開発・プレビュー・CI の E2E |

**モックを使わない方針**のため、テストも実 Supabase・実 DeepSeek に接続する。
本番データを汚さないために環境を分ける、というのが 2 プロジェクト構成の唯一の理由。
DeepSeek のキーも本番用 / テスト用で分ける（利用量の切り分けと、漏洩時の影響範囲限定のため）。

### 2.2 デプロイ手順（当面は手動）

```bash
cd backend

# 1) 対象プロジェクトへ紐付け
supabase link --project-ref <project-ref>

# 2) マイグレーション適用（未適用のものだけが流れる）
supabase db push

# 3) シークレット設定（初回 / 変更時のみ）
supabase secrets set DEEPSEEK_API_KEY=sk-xxxx
supabase secrets set DEEPSEEK_MODEL=deepseek-chat
supabase secrets set ALLOWED_ORIGINS=https://<vercel-domain>,http://localhost:8081

# 4) Edge Function デプロイ
supabase functions deploy synonyms

# 5) 確認
supabase functions logs synonyms --tail
```

**マイグレーションは追記のみ**。適用済みのファイルを書き換えない
（チェックサム不一致で `db push` が失敗する、あるいは環境ごとにスキーマがずれる）。

### 2.3 Auth プロバイダ設定（人手が必要な作業）

Supabase ダッシュボード → Authentication で設定する。

| プロバイダ | 必要な外部作業 |
| --- | --- |
| Email | 追加作業なし。メール確認の要否を決める |
| Google | Google Cloud Console で OAuth クライアント ID を **Web 用 / iOS 用**に発行し、Client ID / Secret を Supabase に登録 |
| Apple | Apple Developer Program で App ID / Service ID / Sign in with Apple キー（`.p8`）を発行し、Supabase に登録 |

Redirect URLs（Authentication → URL Configuration）:

| 環境 | Site URL | Additional Redirect URLs |
| --- | --- | --- |
| 本番 | `https://<本番ドメイン>` | `openowl://auth/callback`, `https://<本番ドメイン>/auth/callback` |
| テスト | `http://localhost:8081` | `openowl://auth/callback`, `https://openowl-*-<scope>.vercel.app/**`, `http://localhost:8081/**` |

## 3. 環境変数マトリクス

**どこに置くかで公開範囲が決まる。** この表が正典。

| 変数 | Supabase Secrets<br/>(Edge Functions) | Vercel<br/>(Production/Preview) | ローカル `.env.local` | GitHub Actions Secrets | 公開されるか |
| --- | :---: | :---: | :---: | :---: | --- |
| `DEEPSEEK_API_KEY` | ✅ | ❌ **禁止** | ❌ **禁止** | ✅（テスト用キー） | 非公開 |
| `DEEPSEEK_BASE_URL` | ✅ | ❌ | ❌ | — | 非公開 |
| `DEEPSEEK_MODEL` | ✅ | ❌ | ❌ | — | 非公開 |
| `DEEPSEEK_TIMEOUT_MS` | ✅ | ❌ | ❌ | — | 非公開 |
| `SYNONYM_CACHE_TTL_DAYS` | ✅ | ❌ | ❌ | — | 非公開 |
| `RATE_LIMIT_PER_HOUR` | ✅ | ❌ | ❌ | — | 非公開 |
| `ALLOWED_ORIGINS` | ✅ | ❌ | ❌ | — | 非公開 |
| `SUPABASE_URL` | 自動注入 | — | — | — | — |
| `SUPABASE_SERVICE_ROLE_KEY` | 自動注入 | ❌ **禁止** | ❌ **禁止** | ❌ **禁止** | 非公開 |
| `EXPO_PUBLIC_SUPABASE_URL` | — | ✅ | ✅ | ✅ | **公開**（バンドルに埋め込まれる） |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | — | ✅ | ✅ | ✅ | **公開**（保護は RLS が担う） |
| `SUPABASE_ACCESS_TOKEN` | — | ❌ | — | ✅（CI からのデプロイ用） | 非公開 |

「自動注入」は Edge Functions 実行環境が既定で提供するもので、手動設定しない。

## 4. デプロイ順序の制約

スキーマ変更を含むリリースでは、以下の順序を守る。

1. **Supabase のマイグレーションを先に適用する**（後方互換な変更に限る）
2. Edge Function をデプロイする
3. フロントエンドをデプロイする

理由: 静的配信されたフロントエンドは CDN キャッシュと PWA の Service Worker により
**古いバージョンがしばらく生き残る**。バックエンドを先に新しくしておかないと、
新フロント + 旧バックエンドの組み合わせが発生する。
破壊的なスキーマ変更（列削除など）は、フロントの旧版が消えるまで 1 リリース遅らせる。

## 5. 将来（フェーズ 6）の自動化方針

ここでは方針のみ記録し、実装はフェーズ 6 で行う。

- **Vercel**: GitHub 連携による自動デプロイ（追加の workflow 不要）。
- **Supabase**: GitHub Actions で `main` への push 時に `supabase db push` と
  `supabase functions deploy` を実行。認証は `SUPABASE_ACCESS_TOKEN`。
- **PR チェック**: lint → typecheck → E2E（テスト用 Supabase に対して実行）。
- **iOS**: EAS Build / Submit。手動トリガーから始める。
