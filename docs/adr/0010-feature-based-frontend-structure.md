# ADR-0010: フロントエンドは feature-based のディレクトリ構成にする

- **状態**: Accepted
- **日付**: 2026-08-22
- **フェーズ**: 4

## 背景

フロントエンドのディレクトリ構成を層優先（`src/{domain,application,infrastructure,ui}`）に
するか、機能優先（`src/features/<feature>/`）にするかを決める必要がある。

フェーズ 1 の [`repository-structure.md`](../repository-structure.md) は層優先の案を
素描していたが、これは backend の構成に揃えただけの暫定案であり、
フロントエンド固有の事情を検討したものではなかった。

CLAUDE.md は「レイヤーは Domain → Application → Infrastructure → Interface の 4 層」
「依存は内向き」を求めている。この制約は構成の選択に関わらず守る必要がある。

## 決定

**feature-based を主軸とし、feature 内部を必要な層だけに分ける。**

- `src/features/<feature>/{domain,application,infrastructure,ui}/`
- 横断的な関心事は `src/shared/`
- ルート定義は `app/`（Expo Router）に薄く置く
- **空の層ディレクトリは作らない**（層が要らない feature には切らない）
- 依存方向は ESLint の `import/no-restricted-paths` で機械的に強制する

## 理由

1. **将来機能が「機能」単位で増えることが確定している。**
   [`roadmap.md`](../roadmap.md) に単語帳・例文生成・ロールプレイ会話が並んでいる。
   層優先では 1 機能の追加が 4 つの既存ディレクトリすべてに手を入れることになり、
   PR の差分が横に広がってレビューしにくい。feature 優先なら 1 ディレクトリで完結する。
2. **削除しやすさ。** 機能を落とすときにディレクトリごと消せる。
   層優先では関連ファイルを 4 箇所から探し出す必要があり、消し残しが出る。
3. **ツリーがアプリの内容を説明する。** 層優先のツリーからは「このアプリが何をするか」が読めない。
4. **層は feature 内で保てる。** 機能優先にしても依存方向の制御は失われない。
   守るべきは「内向きの依存」であって「トップレベルが層であること」ではない。

## 検討したが採用しなかった案

| 案 | 却下理由 |
| --- | --- |
| 層優先（フェーズ 1 の素描案） | 機能追加のたびに 4 箇所を触る。将来 3 機能の追加が確定しているため、このコストが繰り返し発生する |
| feature 優先だが層を切らない（各 feature をフラットに） | 依存方向を機械的に検査する足がかりが無くなる。CLAUDE.md の要求を満たせない |
| 最初から全 feature に 4 層すべてを切る | MVP の規模（2 機能・十数ファイル）に対して空ディレクトリが並ぶ。儀式になる |

## 結果 / 影響

- フェーズ 1 の `repository-structure.md` の `frontend/src/` 素描は本 ADR で置き換わる。
  正典は [`frontend-design.md`](../frontend-design.md) §4。
- feature 間の相互 import を禁止する。共有が必要になったら `src/shared/` へ引き上げる。
- 見直しのトリガー: `src/shared/` が肥大化し、実質的に層優先の構成に戻っているとき。
