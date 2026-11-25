# データの作り方

電子版／入稿用データの作り方に関するメモ書きです．
Adobe Acrobat Pro + InDesign との併用を想定しています．

## 電子版（PDF 版）データ

データの準備：

1. 以下の設定で `npm run build` を実行して，`dist/book-*.pdf` を生成
   ```ts
   const USES_ASYMMETRIC_MARGINS = false;
   const USES_COLOR = true;
   ```

Adobe Acrobat Pro での作業：

2. `dist/book-*.pdf` を Adobe Acrobat Pro で開く
3. 巻頭に `cover/ecover-front.pdf` を，巻末に `cover/ecover-back.pdf` を結合
4. 「その他の形式で保存」→「最適化された PDF」から保存
   - 「フォント」にのみチェックを入れる

## 入稿用データ

プリントパックの[小ロットオンデマンド無線綴じ冊子](https://www.printpac.co.jp/contents/lineup/ondemand_musen/)への入稿を想定しています．

データの準備：

1. 以下の設定で `npm run build` を実行して，`dist/book-*.pdf` を生成
   - `npm run build:tobira-padding` は `USES_PARTS = true` のときのみ部扉を生成する．`USES_PARTS = false` の場合は不要
   ```ts
   const USES_ASYMMETRIC_MARGINS = true;
   const USES_COLOR = false;
   ```
2. 同様に　`npm run build:tobira-padding` を実行して，`dist/tobira-padding.pdf` を生成（「〜の部」でグループ分けしない場合は不要）

Adobe Acrobat Pro での作業：

3. 2 にてコピーした `book-*.pdf` を開く
4. 「印刷工程を使用」→「色を置換」で，以下の設定に基づいてグレースケール化
   - 「変換コマンド」：「プロファイル変換」
   - 「変換のプロファイル」：「Dot Gain 25%」
   - 「レンダリングインテント」：「相対的な色域を維持」
   - 「黒を維持」にチェック
5. 「印刷工程を使用」→「出力プレビュー」から以下を確認
   - K 版以外が残っていないか？
   - 本文が K100 で出ているか？
6. 「その他の形式で保存」→「最適化された PDF」から上書き保存
   - 「フォント」にのみチェックを入れる

Adobe InDesign での作業：

7. B5 判，「マージン・段組」でドキュメントを作成．ページ数を本文ページ数（表1–4 を除く）に揃える
8. `scripts/idjs/place.idjs` を実行して，`book-*.pdf` をすべて配置
   - ファイル選択画面で `book-*.pdf` を選択し，InDesign 側・PDF 側の開始ページ番号（既定値：いずれも `1`）を入力
9. `scripts/idjs/place-tobira.idjs` を実行する
   - ダイアログに以下を入力
     - 本扉を配置する場合：
       「本扉を配置」にチェックを入れて，本扉の配置先ページ番号（例：`1`）
     - 部扉を配置する場合：
       「部扉を配置」にチェックを入れて，部扉の配置先ページ番号（カンマ区切り，例：`10, 62, 131`）
     - 塗り足し（既定値：3 mm）
   - ファイル選択画面で，本扉の PDF（塗り足しに注意！），部扉の PDF（`tobira-padding.pdf`）の順に選択
   - 以下の処理が行われる
     - 対象ページ上の既存 PDF フレームを削除
     - 本扉・部扉の PDF をページ左上基準の `(-塗り足し, -塗り足し)` に等倍配置
     - 部扉はノド側の塗り足しを隠す
10. プリントパックの推奨設定を確認
11. プリントパックの推奨設定に従って PDF を出力
