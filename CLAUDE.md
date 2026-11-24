# コーディングエージェント向けドキュメント

## 作業内容別に読むドキュメント

| 作業内容 | 読むもの |
| --- | --- |
| 全般（セットアップ，コマンド，設定項目，フロントマター） | [README.md](./README.md) |
| 記事の執筆・修正（記法，JSX コンポーネント，参考文献，図表の参照） | [articles/sample/index.mdx](./articles/sample/index.mdx) |
| 記事のレビュー・校正 | [docs/checklist.md](./docs/checklist.md) |
| 電子版・入稿用データの作成 | [docs/data.md](./docs/data.md) |

## minitype の API

テンプレートに改修を加える場合，minitype の API に関しては以下を参照してください．

- 既存の実装
  - `template/components.tsx`（記事で使える JSX コンポーネント）
  - `template/styles/`（スタイル）
- `node_modules/@minitype/minitype/dist/llms.txt`：LLM 向けの概要
- `node_modules/@minitype/{minitype,tsx,vite-plugin}/README.md`
- `node_modules/@minitype/*/dist/*.d.ts`：型定義（最も正確な情報源）
- <https://typeset.jp/>：公式ドキュメント

## 作業上の注意

- 変更の確認には `npm run build <dirname>` を使ってください．`npm run dev` は開発サーバであるため，エージェントからの確認には向きません．
  - ビルドは豆腐（グリフの欠落）を検出すると失敗します（`scripts/diagnostics.ts`）．
  - 生成された `dist/<dirname>.pdf` を開いて，組版結果を目視で確認してください．
- 有償フォントがない環境では，`template/config.ts` の `USES_OSS_FONTS` を一時的に `true` にしてビルドしてください．確認用に変更した `config.ts` のフラグはコミットしないでください．
- `articles/` 以下には複数の著者の記事が置かれています．指示された記事以外は変更しないでください．
- テンプレート本体を変更した場合は，コミット前に `npm run format` と `npm run test` を実行してください．
