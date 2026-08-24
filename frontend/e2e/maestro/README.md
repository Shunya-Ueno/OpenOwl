# Maestro（iOS ネイティブ E2E）

設計と選定理由は [`docs/testing-ci.md`](../../../docs/testing-ci.md) §3 と
[ADR-0014](../../../docs/adr/0014-playwright-and-maestro-over-detox.md) を参照。

## 何をここで守るか

Web と iOS は同じコードベースで動くため、**iOS 固有として守る必要があるのは
`.native.ts` に分岐している箇所だけ**である。

| フロー | 何を守るか | Web の E2E で代替できるか |
| --- | --- | --- |
| `01-sign-in.yaml` | ネイティブでサインインが通ること | 部分的（経路は同じだがセッションの保管先が違う） |
| `02-session-persistence.yaml` | **分割 SecureStore からのセッション復元**（ADR-0013） | **できない** |
| `03-generate-synonyms.yaml` | ネイティブの fetch / AbortController で Edge Function を呼べること | **できない**（ポリフィルが別物） |
| `04-apple-sign-in.yaml` | Apple のシステムシートが立ち上がること | **できない** |

`02` がこのディレクトリの主目的。分割保存（SecureStore の ~2048 バイト上限対策）が
壊れると「アプリを閉じるたびにログアウトされる」という致命的な UX になるが、
Web の E2E では原理的に検出できない。

## 前提

1. Maestro がインストールされていること
2. iOS シミュレータが起動していること
3. アプリがシミュレータにインストール済みであること

```bash
cd frontend
npx expo prebuild --platform ios     # ios/ は .gitignore 済みなので毎回生成する
npx expo run:ios                     # ビルドしてシミュレータへインストール
```

## 実行

E2E 用アカウントの資格情報を環境変数で渡す（[`docs/testing-ci.md`](../../../docs/testing-ci.md) §6.3）。

```bash
# 04（Apple サインイン）を除いた通常のフロー
maestro test e2e/maestro/01-sign-in.yaml \
  -e E2E_USER_EMAIL="$E2E_USER_EMAIL" \
  -e E2E_USER_PASSWORD="$E2E_USER_PASSWORD"

# ディレクトリ指定でまとめて実行する場合、04 は手動前提なので除外する
maestro test e2e/maestro/01-sign-in.yaml e2e/maestro/02-session-persistence.yaml \
           e2e/maestro/03-generate-synonyms.yaml \
  -e E2E_USER_EMAIL="$E2E_USER_EMAIL" \
  -e E2E_USER_PASSWORD="$E2E_USER_PASSWORD"
```

## いつ回すか

- **PR ごとには回さない。** macOS ランナーの単価と所要時間に見合わないため
  （[`docs/testing-ci.md`](../../../docs/testing-ci.md) §5.4）。
- `.github/workflows/e2e-ios.yml` が週次と手動実行で回す。
- **`frontend/src/**/*.native.ts` を変更した PR では手動で回すこと。**
  CI では強制しない（fork の PR では Secrets が渡らず必ず落ちるため）。

## `id:` の値について

`id:` に書く文字列の正典は [`frontend/src/shared/testIds.ts`](../../src/shared/testIds.ts)。
React Native の `testID` が iOS の accessibility identifier になるため、
Playwright と同じ識別子をそのまま使える。

**YAML からは TypeScript を import できないため、ここでは文字列で持っている。**
`testIds.ts` を変更したら、このディレクトリも併せて更新すること。
