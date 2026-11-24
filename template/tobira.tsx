import {
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

/**
 * マージン．
 */
const MARGIN = { x: 22, top: 24, bottom: 22 };

const LIST_WIDTH = 144;

/**
 * 記事名のフォントサイズ．
 */
const TITLE_MM = Q(20);

/**
 * 記事名の 1 行の高さ．
 */
const LINE_MM = TITLE_MM * 1.5;

/**
 * 著者名のフォントサイズ．
 */
const AUTHOR_MM = Q(16);

// 番号の大きさ = 記事名 2 行分（上端は 1 行目の字の上端，下端は 2 行目の文字の底）
const NUM_MM = TITLE_MM * 3.22;
// 番号の列の幅
const NUM_COL_MM = NUM_MM * 1.4;
const ENTRY_GAP_MM = TITLE_MM * 1.0;

// TODO: ページ番号の有無の比較用．TOBIRA_PAGES=1 で，記事名の最後の行から点線でページ番号へつなぐ
const WITH_PAGES = !!process.env.TOBIRA_PAGES;

// 1 件の高さは，記事名が 2 行ある場合に合わせて固定する．記事名が 1 行の項目も同じ枠に入れるので，
// どの部の扉でも，一覧の上端と各項目の位置が同じになる（記事名は 2 行に収まる前提）
const ENTRY_MM = 2 * LINE_MM + 1.3 + AUTHOR_MM * 1.5 + ENTRY_GAP_MM;

/**
 * セクション扉ページを組版する関数を返す．
 * PART 番号は返り値の関数が呼ばれるたびにインクリメントされる．
 */
export const createTobiraRenderer = (
  bleedMm = 0,
): ((section: TobiraSection) => JsxElement) => {
  let partNo = 0;

  return (section: TobiraSection): JsxElement => (
    <Group style={{ padding: physical(0) }}>
      <Flow
        position="page"
        inlineSize={pageSizeMm.width + 2 * bleedMm}
        zIndex={-3}
      >
        <Rect
          width={pageSizeMm.width + 2 * bleedMm}
          height={pageSizeMm.height + 2 * bleedMm}
          style={{ background: [fill(colors.gray15)] }}
        />
      </Flow>

      <Flow
        position="page"
        inlineOffset={12 + bleedMm}
        blockOffset={12 + bleedMm}
        inlineSize={pageSizeMm.width - 24}
        zIndex={-2}
      >
        <Rect
          width={pageSizeMm.width - 24}
          height={pageSizeMm.height - 24}
          style={{
            background: [fill(colors.white)],
            borderRadius: 8,
          }}
        />
      </Flow>

      {/* H1 は通常の版面に残して toc() の収集対象とする */}
      <Move
        inlineOffset={MARGIN.x + 1 + bleedMm}
        blockOffset={MARGIN.top + bleedMm}
      >
        <Box style={{ inlineSize: pageSizeMm.width - MARGIN.x * 2 }}>
          <Box style={{ margin: left(0.5) }}>
            <P
              style={{
                firstIndent: 0,
                font: tobiraPartFont,
                size: Q(18),
              }}
            >
              <Command style={{ effects: [fill(colors.gray65)] }}>
                PART {++partNo}
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
            {section.label
              .split(/(?<=・)/)
              .flatMap((part, i) => (i === 0 ? [part] : [<Br />, part]))}
          </H1>
        </Box>
      </Move>

      <Flow
        position="page"
        inlineOffset={MARGIN.x + bleedMm}
        blockOffset={
          pageSizeMm.height +
          bleedMm -
          MARGIN.bottom -
          section.articles.length * ENTRY_MM +
          ENTRY_GAP_MM
        }
        inlineSize={LIST_WIDTH}
      >
        {section.articles.map((article) => (
          <Box style={{ splitable: false, blockSize: ENTRY_MM }}>
            <Flexbox style={{ gap: 0, alignItems: "start" }}>
              <Box style={{ splitable: false, inlineSize: NUM_COL_MM }}>
                {/* 番号の上端を記事名の 1 行目の字の上端に合わせる */}
                <Move blockOffset={-TITLE_MM * 0.6}>
                  <P
                    style={{
                      size: Q(NUM_MM * 4),
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
                    size: Q(TITLE_MM * 4),
                    lineHeight: em(1.5),
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
                    {(article.titleTobira ?? flattenTitle(article.title))
                      .split("\\n")
                      .flatMap((line, i) =>
                        i === 0 ? [line] : [<Br />, line],
                      )}
                  </Command>
                  {WITH_PAGES && hbox(fr(1), "…")}
                  {WITH_PAGES && article.h1Id ? pageref(article.h1Id) : ""}
                </P>
                <Vspace space={0.5} />
                <P
                  style={{
                    size: Q(AUTHOR_MM * 4),
                    font: gothicFont,
                    firstIndent: 0,
                  }}
                >
                  {article.author ?? ""}
                </P>
              </Box>
            </Flexbox>
          </Box>
        ))}
      </Flow>
    </Group>
  );
};
