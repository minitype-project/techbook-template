import type { PdfMetadata } from "@minitype/minitype";

/**
 * 部のタイプ．
 */
export type PartType = "preface" | "sample" | "postface" | "colophon";

/**
 * 部のラベル．
 */
export const partLabels: Record<PartType, string> = {
  preface: "",
  sample: "サンプルの部",
  postface: "",
  colophon: "",
};

/**
 * 書籍に含める記事のディレクトリ名（掲載順）．
 * 部 → 記事の順に記載する．
 */
export const articleOrder: { type: PartType; articles: string[] }[] = [
  {
    type: "preface",
    articles: ["maegaki"],
  },
  {
    type: "sample",
    articles: ["sample"],
  },
  {
    type: "postface",
    articles: ["atogaki"],
  },
  {
    type: "colophon",
    articles: ["okuzuke"],
  },
];

/**
 * 「〜の部」によって記事をグループ化するかどうか．
 * false にすると部扉を生成せず，目次にも部の見出しを表示しない．
 */
export const USES_PARTS = false;

/**
 * オープンソースフォントを使用するかどうか．
 */
export const USES_OSS_FONTS = false;

/**
 * カラーで出力するかどうか．
 * false にするとグレースケール（K 5% 刻み）に変換される．
 */
export const USES_COLOR = true;

/**
 * ノド（内側）と小口（外側）の余白を区別するかどうか．
 * true のとき，ノドの余白が小口の余白より広くなる．
 * false のとき，ノドと小口の余白が均等になる．
 */
export const USES_ASYMMETRIC_MARGINS = false;

/**
 * 本扉の PDF のパス（プロジェクトルートからの相対パス）．
 * 指定すると，書籍全体のビルドで 1 ページ目に全面配置して，目次を 2 ページ目から開始する．
 * null のとき，本扉を設けずに 1 ページ目から目次を開始する．
 */
export const HONTOBIRA_PDF: string | null = "cover/hontobira.pdf";

/**
 * PDF メタデータに設定する書籍情報．
 */
export const bookMetadata: PdfMetadata = {
  title: "書籍名",
  author: "発行者名",
};
