# techbook-template

TypeScript ライブラリとして提供される組版エンジン [minitype](https://typeset.jp/) を用いて，Markdown + TSX（MDX）を用いて技術同人誌を執筆するためのテンプレートです．

本テンプレートは，以下の特徴を有します．

- **Markdown + JSX による執筆**<br />
  本文を Markdown で手軽に記述しつつ．注記，コラム，複雑な表など，Markdown のみでは記述しにくい表現には JSX コンポーネントを利用できます．
- **高品質な日本語組版**<br />
  日本語組版エンジン minitype を使用して，高品質に組版された PDF を生成できます．
- **複数著者による制作に対応**<br />
  記事ごとにディレクトリを分けて執筆できます．誌面のスタイルは一元管理されるため，各著者がレイアウトを調整する必要はありません．目次や扉も自動で生成されます．
- **快適な執筆環境**<br />
  執筆中の誌面のリアルタイムプレビュー，コードブロックの自動フォーマット，豆腐文字の検出，オープンソースフォントを用いたコンパイル等にも対応しています．
- **印刷・入稿に便利な機能**<br />
  印刷用のグレースケール変換，ノド・小口の余白調整，塗り足し付きの扉の生成，PDF の差分検査などが行えます．
- **すぐに利用可能**<br />
  Node.js の環境があればすぐに執筆を開始できます．

＜図＞

記法やテンプレートの仕組みについては，サンプル記事（[articles/sample/index.mdx](./articles/sample/index.mdx)，コンパイルされた PDF：[dist/sample.pdf](./dist/sample.pdf)）で解説しています．

## セットアップ

Node.js がインストールされている環境にて，依存パッケージをインストールしてください．

```bash
# 依存関係のインストール
npm i
```

加えて，モノクロ出力時の画像のグレースケール変換（`USES_COLOR = false`）および PDF の差分検査（`npm run diff`）には，外部ツールのインストールが必要です．

```bash
# 外部ツールのインストール
## macOS
brew install imagemagick ghostscript poppler
## Linux
sudo apt install imagemagick ghostscript poppler-utils
## Windows
winget install ImageMagick.Q16-HDRI
winget install ArtifexSoftware.GhostScript
winget install oschwartz10612.Poppler
```

- ImageMagick は 7 系（`magick` コマンド）が必要です．Linux のパッケージマネージャで 6 系しか提供されていない場合は，[公式サイト](https://imagemagick.org/script/download.php)の AppImage 等を用いてください．
- Windows では，各外部ツールの実行ファイルが配置されたディレクトリが環境変数 `PATH` に含まれていない場合は，追加してください．

## 文書のコンパイル

```bash
# 記事のリアルタイムプレビューを行う
npm run dev <dirname>
# 目次 + 全記事をコンパイルして dist/book-<YYYYMMDD>-<HHMMSS>.pdf を生成
npm run build
# 単体記事をコンパイルして dist/<dirname>.pdf を生成
npm run build <dirname>
# 全記事を個別にコンパイルして dist/<dirname>.pdf を生成
npm run build:all
# 目次のみをコンパイルして dist/toc.pdf を生成
npm run build:toc
# 扉のみをコンパイルして dist/tobira.pdf を生成
npm run build:tobira
# 各辺 3 mm の塗り足し付きの扉を dist/tobira-padding.pdf に生成
npm run build:tobira-padding
```

`npm run build`（目次 + 全記事）に記事を含めるには，`template/config.ts` の `articleOrder` に記事のディレクトリ名を追加してください．

## 設定

`template/config.ts` で以下の項目を設定できます．

| 項目 | 説明 |
| --- | --- |
| `articleOrder` | 書籍に含める記事のディレクトリ名と掲載順 |
| `USES_OSS_FONTS` | 有償フォントの代わりにオープンソースフォントを使用するか |
| `USES_COLOR` | 文書をカラーで出力するか（false のとき，印刷用にグレースケール（K5% 刻み）で出力 + 画像をグレースケールに変換） |
| `USES_ASYMMETRIC_MARGINS` | ノドの余白を広く，小口の余白を狭くするかどうか |
| `bookMetadata` | PDF メタデータに設定する書籍名，発行者名 |

### フォント

本番用データのコンパイルには，以下のフォントが PC にインストールされている必要があります．

- A P-SK 本蘭明朝 StdN R（写研）
- A-SK ゴナ Min2 DB/M（写研）
- A P-SK 石井ゴシック StdN R（写研）
- A P-OTF 新ゴ Pr6N M/R（モリサワ）
- A P-OTF はるひ学園 StdN L（モリサワ）
- Neue Helvetica（Monotype）

これらのフォントを用意できない場合，`USES_OSS_FONTS` を `true` にすることで，オープンソースフォントを利用して記事をコンパイルできます．
オープンソースフォントはリポジトリに同梱されているため，追加でのインストールは不要です．

## 記事の執筆

- `articles/` 以下にディレクトリを作成して，その中の `index.mdx` に記事を執筆してください．
  - ブランチを切って，PR として提出されることを推奨します．
- サンプル記事（`articles/sample`）を書き方の参考にしてください．
- mdx の先頭に YAML フロントマターとして以下の内容を記述してください．各項目の詳細はサンプル記事を参照してください．

  ```yaml
  ---
  title: 本文の\n記事タイトル（必須）
  title-toc: 目次の\n記事タイトル（任意）
  title-tobira: 扉の\n記事タイトル（任意）
  author: 著者名（必須）
  author-detail: 著者詳細．メールアドレス，所属，SNS アカウント等（任意）
  author-image: articles/<dirname>/profile.jpg # 著者紹介欄の画像．JPEG または PNG（任意）
  auto-format: true # コードブロックの自動フォーマットを有効化するかどうか（任意，既定値 true）
  ---
  ```

- 記事末尾には著者紹介として，著者近影 + 自己紹介を含めることができます．
- チェックリストとして [checklist.md](./checklist.md) を添付しています．よろしければ参考にしてください．

## 入稿用データ作成，データチェック

電子版・入稿用データの作り方は [data.md](./data.md) を参照してください．

また，以下のコマンドにより，コンパイルされた PDF の差分（ページ数，しおり，抽出されたテキスト，見た目）を検出することができます．
本コマンドの実行には poppler（`pdftoppm`）と ImageMagick（`magick`）が必要です．

```bash
# 2 つの PDF の差分（ページ数，しおり，テキスト，見た目）を検査
# 引数を省略した場合は dist/book-*.pdf のうち新しい 2 つを比較し，差分画像を dist/diff-<old>-<new>/ に出力
npm run diff [old.pdf] [new.pdf]
```

## ライセンス

Copyright (c) 2026 Yuto Wada. This software is released under the MIT License, see [LICENSE](./license).

`fonts/` 配下のフォントに関しては，[SIL Open Font License 1.1](https://openfontlicense.org/) の下で再配布しています．
詳細なライセンスに関しては，`fonts/LICENSE-*.txt` を参照してください．

本テンプレートは [驚額の殿堂 技術同人誌『フランクフルト』Vol. 2](https://kyogaku-dendo.booth.pm/items/9039924) の発行に向けて整備されました．
テンプレートの整備に際してご協力いただいたみなさまに感謝いたします．
