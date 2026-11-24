# データの作り方

電子版／入稿用データの作り方に関するメモ書きです．

## 電子版（PDF 版）データ

データの準備：

1. 以下の設定で `yarn build` を実行

   ```ts
   const USES_ASYMMETRIC_MARGINS = false;
   const USES_COLOR = true;
   ```

Adobe Acrobat Pro での作業：

2. `dist/book-*.pdf` を Adobe Acrobat Pro で開く
3. 巻頭に `cover/ecover-front.pdf` を，巻末に `cover/ecover-back.pdf` を結合
4. 「その他保存」→「最適化された PDF」から保存
   - 「フォント」にのみチェックを入れる
   -  保存先：`data/ebook-v*.pdf`

## サンプルデータ

1. 電子版データを作成した後に，`yarn sample` を実行
2. `data/ebook-v*-sample.pdf` が生成される

## 入稿用データ

事故防止のために Adobe Acrobat Pro + Adobe InDesign を使用します．
プリントパックの[小ロットオンデマンド無線綴じ冊子](https://www.printpac.co.jp/contents/lineup/ondemand_musen/)への入稿を想定しています．

データの準備：

1. 以下の設定で `yarn build`，`yarn build:tobira-padding` を実行

   ```ts
   const USES_ASYMMETRIC_MARGINS = true;
   const USES_COLOR = false;
   ```
2. `data/indd` 配下にコピー

Adobe Acrobat Pro での作業：

3. 2 にてコピーしたファイルを開く
4. 「印刷工程を使用」→「色を置換」で，以下の設定に基づいてグレースケール化
   - 「変換コマンド」：「プロファイル変換」
   - 「変換のプロファイル」：「Dot Gain 25%」
   - 「レンダリングインテント」：「相対的な色域を維持」
   - 「黒を維持」にチェック
5. 「印刷工程を使用」→「出力プレビュー」から以下を確認
   - K 版以外が残っていないか？
   - 本文が K100 で出ているか？
6. 「その他保存」→「最適化された PDF」から保存
   - 「フォント」のみにチェックを入れる

Adobe InDesign での作業：

5. B5 判，「レイアウトグリッド」でドキュメントを作成．ページ数を本文ページ数（表1–4 を除く）に揃える
6. `scripts/place.idjs` を実行して，`data/indd/body.pdf` をすべて配置
7. `scripts/place-tobira.idjs` を実行する．以下の処理が行われる
   - 各ページ上の既存 PDF フレームを削除
   - 以下をページ左上基準の `(-3 mm, -3 mm)` に等倍配置
     - 本扉（p.1）：`cover/cover-front-gray-print.pdf` の1ページ目
     - 部扉（p.10，p.62，p.131）：`data/indd/tobira-padding.pdf` の1–3ページ目
8. プリントパックの推奨設定を確認
9. プリントパックの推奨設定に従って PDF を出力
   - 保存先：`data/print-v*/`
