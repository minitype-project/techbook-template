import {
  type Color,
  em,
  fill,
  fr,
  hbox,
  left,
  pageref,
  physical,
  Q,
  TEXT_SPACE_HEADTAIL_HALF,
} from "@minitype/minitype";
import {
  Box,
  Br,
  Command,
  Flexbox,
  Flow,
  Group,
  H1,
  type JsxElement,
  Move,
  P,
  Rect,
  Vspace,
} from "@minitype/tsx";
import { colors } from "./styles/colors.js";
import {
  articleNumberFont,
  boldFont,
  cuteFont,
  gothicFont,
  tobiraPartFont,
} from "./styles/fonts.js";
import { pageSizeMm } from "./styles/style.js";
import { flattenTitle } from "./utils/title.js";

export interface TobiraArticle {
  displayNum?: string;
  h1Id?: string;
  title: string;
  titleTobira?: string;
  author?: string;
}

export interface TobiraSection {
  sectionH1Id: string;
  label: string;
  articles: TobiraArticle[];
}

interface TobiraProps {
  section: TobiraSection;
  /** 部の番号（PART n）． */
  partNo: number;
  /**
   * 各辺の塗り足し（mm）．
   * @default 0
   */
  bleedMm?: number;
}

// ------
// レイアウト
// ------

/**
 * 版面のマージン（mm）．
 */
const MARGIN = { x: 22, top: 24, bottom: 22 };

/**
 * 白い枠のページ端からの距離（mm）．
 */
const FRAME_INSET = 12;

/**
 * 白い枠の角丸の半径（mm）．
 */
const FRAME_RADIUS = 8;

/**
 * 記事一覧の幅（mm）．
 */
const LIST_WIDTH = 144;

/**
 * 記事名のフォントサイズ（mm）．
 */
const TITLE_MM = Q(20);

/**
 * 記事名の行送り（em）．
 */
const TITLE_LINE_HEIGHT = 1.5;

/**
 * 記事名の行送り（mm）．
 */
const LINE_MM = TITLE_MM * TITLE_LINE_HEIGHT;

/**
 * 著者名のフォントサイズ（mm）．
 */
const AUTHOR_MM = Q(16);

/**
 * 番号のフォントサイズ（mm）．
 * 上端が記事名の 1 行目の字の上端，下端が 2 行目の字の底に揃う大きさ．
 */
const NUM_MM = TITLE_MM * 3.22;

/**
 * 番号の列の幅（mm）．
 */
const NUM_COL_MM = NUM_MM * 1.4;

/**
 * 記事間の間隔（mm）．
 */
const ENTRY_GAP_MM = TITLE_MM;

/**
 * 記事名と著者名の間隔（mm）．
 */
const TITLE_AUTHOR_GAP_MM = 0.5;

/**
 * 1 件の高さ（mm）．記事名が 2 行ある場合に合わせて固定する．
 * 記事名が 1 行の項目も同じ枠に入れるので，どの部の扉でも一覧の上端と各項目の位置が揃う（記事名は 2 行に収まる前提）．
 */
const ENTRY_MM = 2 * LINE_MM + 1.3 + AUTHOR_MM * 1.5 + ENTRY_GAP_MM;

// TODO: ページ番号の有無の比較用．TOBIRA_PAGES=1 で，記事名の最後の行から点線でページ番号へつなぐ
const WITH_PAGES = !!process.env.TOBIRA_PAGES;

// ------
// コンポーネント
// ------

/**
 * 文字列の配列を，間に改行を挟んで連結する．
 */
const joinWithBr = (lines: string[]): (string | JsxElement)[] => {
  return lines.flatMap((line, i) => (i === 0 ? [line] : [<Br />, line]));
};

/**
 * ページ全体を基準に塗りの矩形を配置する．
 */
const PageRect = ({
  offset,
  width,
  height,
  color,
  borderRadius,
  zIndex,
}: {
  offset: number;
  width: number;
  height: number;
  color: Color;
  borderRadius?: number;
  zIndex: number;
}): JsxElement => {
  return (
    <Flow
      position="page"
      inlineOffset={offset}
      blockOffset={offset}
      inlineSize={width}
      zIndex={zIndex}
    >
      <Rect
        width={width}
        height={height}
        style={{ background: [fill(color)], borderRadius }}
      />
    </Flow>
  );
};

/**
 * 一覧の 1 件（番号，記事名，著者名）を組版する．
 */
const TobiraEntry = ({ article }: { article: TobiraArticle }): JsxElement => {
  const title = article.titleTobira ?? flattenTitle(article.title);

  return (
    <Box style={{ splitable: false, blockSize: ENTRY_MM }}>
      <Flexbox style={{ gap: 0, alignItems: "start" }}>
        <Box style={{ splitable: false, inlineSize: NUM_COL_MM }}>
          {/* 番号の上端を記事名の 1 行目の字の上端に合わせる */}
          <Move blockOffset={-TITLE_MM * 0.6}>
            <P
              style={{
                size: NUM_MM,
                lineHeight: em(1),
                font: articleNumberFont,
                firstIndent: 0,
              }}
            >
              <Command style={{ effects: [fill(colors.gray40)] }}>
                {article.displayNum ?? ""}
              </Command>
            </P>
          </Move>
        </Box>
        <Box style={{ splitable: false, inlineSize: fr(1) }}>
          <P
            style={{
              size: TITLE_MM,
              lineHeight: em(TITLE_LINE_HEIGHT),
              font: boldFont,
              firstIndent: 0,
              space: TEXT_SPACE_HEADTAIL_HALF,
            }}
          >
            <Command
              link={
                article.h1Id
                  ? { type: "destination", destination: article.h1Id }
                  : undefined
              }
            >
              {joinWithBr(title.split("\\n"))}
            </Command>
            {WITH_PAGES && hbox(fr(1), "…")}
            {WITH_PAGES && article.h1Id ? pageref(article.h1Id) : ""}
          </P>
          <Vspace space={TITLE_AUTHOR_GAP_MM} />
          <P style={{ size: AUTHOR_MM, font: gothicFont, firstIndent: 0 }}>
            {article.author ?? ""}
          </P>
        </Box>
      </Flexbox>
    </Box>
  );
};

/**
 * 部扉ページを組版する．
 */
export const Tobira = ({
  section,
  partNo,
  bleedMm = 0,
}: TobiraProps): JsxElement => {
  // 一覧は下端を版面の下マージンに揃える
  const listTop =
    pageSizeMm.height -
    MARGIN.bottom -
    section.articles.length * ENTRY_MM +
    ENTRY_GAP_MM;

  return (
    <Group style={{ padding: physical(0) }}>
      {/* 背景（塗り足しまで）と白い枠 */}
      <PageRect
        offset={0}
        width={pageSizeMm.width + 2 * bleedMm}
        height={pageSizeMm.height + 2 * bleedMm}
        color={colors.gray15}
        zIndex={-3}
      />
      <PageRect
        offset={FRAME_INSET + bleedMm}
        width={pageSizeMm.width - 2 * FRAME_INSET}
        height={pageSizeMm.height - 2 * FRAME_INSET}
        color={colors.white}
        borderRadius={FRAME_RADIUS}
        zIndex={-2}
      />

      {/* H1 は通常の版面に残して toc() の収集対象とする */}
      <Move
        inlineOffset={MARGIN.x + 1 + bleedMm}
        blockOffset={MARGIN.top + bleedMm}
      >
        <Box style={{ inlineSize: pageSizeMm.width - MARGIN.x * 2 }}>
          <Box style={{ margin: left(0.5) }}>
            <P style={{ firstIndent: 0, font: tobiraPartFont, size: Q(18) }}>
              <Command style={{ effects: [fill(colors.gray65)] }}>
                PART {partNo}
              </Command>
            </P>
          </Box>
          <Vspace space={4} />
          <H1
            id={section.sectionH1Id}
            style={{
              font: cuteFont,
              size: Q(56),
              lineHeight: em(1.3),
              indent: 0,
            }}
          >
            {/* 長い名前は「・」の後で改行する（「フリースタイル・パソコンの部」） */}
            {joinWithBr(section.label.split(/(?<=・)/))}
          </H1>
        </Box>
      </Move>

      <Flow
        position="page"
        inlineOffset={MARGIN.x + bleedMm}
        blockOffset={listTop + bleedMm}
        inlineSize={LIST_WIDTH}
      >
        {section.articles.map((article) => (
          <TobiraEntry article={article} />
        ))}
      </Flow>
    </Group>
  );
};
