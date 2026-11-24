import {
  type BlockStyleRecord,
  type CommandStyleRecord,
  calculatePhysicalPadding,
  type DocumentStyle,
  em,
  type Gap,
  type PhysicalPadding,
  pageSizeToSize,
  physical,
  Q,
  TEXT_SPACE_HEADTAIL_HALF,
} from "@minitype/minitype";
import { USES_ASYMMETRIC_MARGINS, USES_COLOR } from "../config.js";
import { colors } from "./colors.js";
import { boldFont, codeFont, serifFont } from "./fonts.js";

// ------
// 版面定義
// ------

/**
 * 水平方向の合計余白に対するノドの割合（USES_ASYMMETRIC_MARGINS が true のときのみ有効）．
 */
const NODO_RATIO = 0.6;

/**
 * ページサイズ．
 */
export const PAGE_SIZE = "B5" as const;
export const pageSizeMm = pageSizeToSize(PAGE_SIZE);

/**
 * 本文フォントサイズ．
 */
export const BODY_FONT_SIZE = Q(13);

/**
 * 1行あたりの文字数．
 */
const CHARS_PER_LINE = 40;

/**
 * 余白および本文の幅．
 */
export const [padding, tocPadding, textWidth] = (() => {
  const horizontalPadding = calculatePhysicalPadding(
    PAGE_SIZE,
    CHARS_PER_LINE,
    999, // 使用しないため適当な値を設定
    BODY_FONT_SIZE,
    999,
    "horizontal",
  );

  const totalHorizontal =
    (horizontalPadding.left ?? 0) + (horizontalPadding.right ?? 0);
  const nodoPadding = USES_ASYMMETRIC_MARGINS
    ? totalHorizontal * NODO_RATIO
    : totalHorizontal / 2;
  const koguchiPadding = totalHorizontal - nodoPadding;

  // 偶数インデックス（奇数ページ = 右ページ）はノドが左，奇数インデックス（偶数ページ = 左ページ）はノドが右
  const padding = (pageIndex: number): PhysicalPadding => ({
    type: "physical",
    top: 30,
    bottom: 20,
    left:
      USES_ASYMMETRIC_MARGINS && pageIndex % 2 === 0
        ? nodoPadding
        : koguchiPadding,
    right:
      USES_ASYMMETRIC_MARGINS && pageIndex % 2 === 0
        ? koguchiPadding
        : nodoPadding,
  });

  // 目次の上下の余白は別途設定
  const tocPadding = (pageIndex: number): PhysicalPadding => ({
    type: "physical",
    top: 20,
    bottom: 16,
    left:
      USES_ASYMMETRIC_MARGINS && pageIndex % 2 === 0
        ? nodoPadding
        : koguchiPadding,
    right:
      USES_ASYMMETRIC_MARGINS && pageIndex % 2 === 0
        ? koguchiPadding
        : nodoPadding,
  });

  const textWidth = pageSizeToSize(PAGE_SIZE).width - totalHorizontal;

  return [padding, tocPadding, textWidth];
})();

// ------
// スタイル定義
// ------

/**
 * ブロックのスタイル．
 */
const blockStyle: BlockStyleRecord = {
  paragraph: {
    size: BODY_FONT_SIZE,
    lineHeight: em(1.8),
    font: serifFont,
    firstIndent: em(1),
  },
  h1: {
    size: Q(30),
    lineHeight: em(1.4),
    font: boldFont,
    align: "left",
    kerning: true,
    headingNumberFormat: () => "",
    needspace: 8,
    space: TEXT_SPACE_HEADTAIL_HALF,
  },
  h2: {
    align: "left",
    size: Q(20),
    lineHeight: em(1.4),
    font: boldFont,
    headingNumberFormat: () => "",
    needspace: 8,
  },
  h3: {
    align: "left",
    size: Q(18),
    lineHeight: em(1.4),
    font: boldFont,
    headingNumberFormat: () => "",
    needspace: 8,
  },
  h4: {
    align: "left",
    size: Q(15),
    font: boldFont,
    headingNumberFormat: () => "",
    needspace: 8,
  },
  li1: {
    indent: em(2),
    firstIndent: em(-1),
  },
  li2: {
    indent: em(4),
    firstIndent: em(-1),
  },
  li3: {
    indent: em(6),
    firstIndent: em(-1),
  },
  ol1: {
    indent: em(1.5),
    firstIndent: em(-1.5),
  },
  ol2: {
    indent: em(3),
  },
  ol3: {
    indent: em(4.5),
  },
  table: {
    cellPadding: physical(2, 3),
    background: (rowIndex, _columnIndex) =>
      rowIndex === 0 ? colors.gray5 : undefined,
    textStyle: {
      lineHeight: em(1.4),
      align: "left",
    },
  },
  code: {
    size: Q(12),
    lineHeight: em(1.4),
    font: codeFont,
    align: "left",
    highlight: USES_COLOR ? "github" : undefined,
  },
  caption: {
    size: Q(12),
    font: serifFont,
    align: "center",
  },
  footnote: {
    size: Q(11),
    // 上付きの「*12」と本文の間に適度な空きを確保する
    indent: em(1.5),
    firstIndent: em(-1.5),
    lineHeight: em(1.4),
    hyphenation: false,
    separatorLineWidth: 0.2,
    separatorLineColor: colors.gray40,
  },
};

/**
 * コマンドのスタイル．
 */
const commandStyle: CommandStyleRecord = {
  b: {
    font: boldFont,
  },
  c: {
    font: codeFont,
  },
};

// box の後の lineHeight は 1.0 になるため，それを考慮して gap を設定
const boxGap = BODY_FONT_SIZE * 0.8;

/**
 * ブロックの間隔．
 */
const gaps: Gap[] = [
  // 見出し
  ["h2", "fallback", 2],
  ["h3", "fallback", 2],
  ["h4", "fallback", 1],
  ["h5", "fallback", 1 + boxGap],
  ["fallback", "h2", 8],
  ["fallback", "h3", 6],

  // 図版
  ["image", "caption", 4],
  ["fallback", "figure", 4],
  ["fallback", "image", 4],
  ["image", "fallback", 4 + boxGap],
  ["figure", "fallback", 4 + boxGap],

  // 表
  ["caption", "table", 4],
  ["caption", "easytable", 4],
  ["fallback", "table", 4],
  ["fallback", "easytable", 4],
  ["table", "fallback", 4 + boxGap],
  ["easytable", "fallback", 4 + boxGap],

  // コードブロック
  ["code", "caption", 4],
  ["fallback", "code", 4],
  ["code", "fallback", 4 + boxGap],

  // ブロック系
  ["fallback", "blockquote", 4],
  ["fallback", "notation", 4],
  ["fallback", "column", 6],
  ["column-title", "column-body", 0],
  ["blockquote", "fallback", 4 + boxGap],
  ["notation", "fallback", 4 + boxGap],
  ["column", "fallback", 6 + boxGap],

  // リスト
  ["li1", "li1", 0],
  ["li1", "li2", 0],
  ["li1", "li3", 0],
  ["li2", "li2", 0],
  ["li2", "li3", 0],
  ["li3", "li3", 0],
  ["li2", "li1", 0],
  ["li3", "li1", 0],
  ["fallback", "list", 4],
  ["list", "fallback", 4 + boxGap],
  ["list", "list", 4 + boxGap],

  // 見出し2
  ["fallback", "h4", 4],
  ["fallback", "h5", 4],

  // その他
  ["paragraph", "paragraph", 0],
  ["footnote", "footnote", 2],
  ["fallback", "fallback", 2],
];

/**
 * 文書のスタイル．
 */
export const documentStyle: DocumentStyle = {
  size: PAGE_SIZE,
  writingMode: "horizontal",
  padding,
  block: blockStyle,
  command: commandStyle,
  gaps: gaps,
};
