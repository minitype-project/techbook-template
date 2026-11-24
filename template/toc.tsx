import {
  addvspace,
  box,
  em,
  fill,
  flexbox,
  fr,
  type Gap,
  type HeadingLevel,
  hbox,
  type InlineOrExtender,
  left,
  move,
  p,
  pageref,
  Q,
  right,
  TEXT_SPACE_HEADTAIL_HALF,
  type TocEntryMapper,
  toc,
  vspace,
} from "@minitype/minitype";
import {
  Box,
  Br,
  Command,
  Group,
  H1,
  type JsxElement,
  P,
  Section,
  Vspace,
} from "@minitype/tsx";
import { colors } from "./styles/colors.js";
import { articleNumberFont, boldFont, cuteFont } from "./styles/fonts.js";
import { documentStyle, tocPadding } from "./styles/style.js";
import { Nombre } from "./utils/nombre.js";
import { flattenTitle } from "./utils/title.js";

interface TocArticle {
  h1Id?: string;
  displayNum?: string;
  title: string;
  titleToc?: string;
  author?: string;
  authorDetail?: string;
}

interface TocProps {
  parts: { articles: TocArticle[] }[];
}

/**
 * 目次の項目間のギャップ．
 */
const GAPS: Gap[] = [
  ["fallback", "toc-part", 14],
  ["fallback", "toc-article", 10],
  ...(documentStyle.gaps ?? []),
];

// - U+3000–U+9FFF: CJK・仮名等
// - U+F900–U+FAFF: CJK互換漢字
// - U+FF00–U+FFEF: 全角英数・記号
const cjkRe = /[　-鿿豈-﫿＀-￯]/;

/**
 * 目次で行間に挿入された半角スペースのうち，両側が和文の場合は除去する．
 */
const removeCjkLineBreakSpaces = (
  inlines: InlineOrExtender[],
): InlineOrExtender[] => {
  const result: InlineOrExtender[] = [];
  for (let i = 0; i < inlines.length; i++) {
    const item = inlines[i];
    if (item === " " && result.length > 0 && i + 1 < inlines.length) {
      const prev = result[result.length - 1];
      const next = inlines[i + 1];
      if (
        typeof prev === "string" &&
        typeof next === "string" &&
        cjkRe.test(prev[prev.length - 1]) &&
        cjkRe.test(next[0])
      ) {
        continue;
      }
    }
    result.push(item);
  }
  return result;
};

const createTocEntryMapper = (
  authorMap: Map<string, string>,
  numberMap: Map<string, string>,
  titleMap: Map<string, string>,
): TocEntryMapper => {
  let articleIndent = 0;

  return (
    level: HeadingLevel,
    headingId: string,
    headingInlines: InlineOrExtender[],
  ) => {
    const articleTitle = titleMap.get(headingId);
    const titleCommand: InlineOrExtender = {
      type: "command",
      body: removeCjkLineBreakSpaces(headingInlines),
      link: { type: "destination", destination: headingId },
    };
    const fillHbox = hbox(fr(1), "…");
    const pageNum = pageref(headingId);

    if (level === 1) {
      articleIndent = numberMap.has(headingId) ? 11 : 0;

      // 部見出し
      if (headingId.startsWith("part-h1-")) {
        return box([
          p([[titleCommand]], {
            size: Q(22),
            font: cuteFont,
            align: "left",
            firstIndent: 0,
          }),
          addvspace(-8),
        ]);
      }

      // 記事見出し
      const authorText = authorMap.get(headingId);
      const titleChildren =
        articleTitle !== undefined
          ? articleTitle
              .split("\\n")
              .flatMap((line, i) => (i === 0 ? [line] : [Br(), line]))
          : removeCjkLineBreakSpaces(headingInlines);

      const titleBlock = P({
        style: { size: Q(16), font: boldFont, firstIndent: 0, align: "left" },
        children: [
          Command({
            link: { type: "destination", destination: headingId },
            children: titleChildren,
          }),
          fillHbox,
          pageNum,
        ],
      });

      const articleBlocks = authorText
        ? [titleBlock, p([[authorText]], { firstIndent: 0 }), vspace(0)]
        : [titleBlock];

      // 記事番号
      const articleNum = numberMap.get(headingId);
      if (articleNum) {
        return flexbox(
          [
            box(
              [
                move(
                  [
                    p([[articleNum]], {
                      size: Q(28),
                      font: articleNumberFont,
                      firstIndent: 0,
                      effects: [fill(colors.gray65)],
                    }),
                  ],
                  { blockOffset: -1.4 },
                ),
              ],
              {
                splitable: false,
                inlineSize: 10,
                padding: right(2),
              },
            ),
            box(articleBlocks, { splitable: false, inlineSize: fr(1) }),
          ],
          { gap: 1, alignItems: "start" },
        );
      }
      return box(articleBlocks);
    }

    const indentLevel = level - 2;
    return box(
      [
        p([[titleCommand, fillHbox, pageNum]], {
          align: "left",
          firstIndent: 0,
          ...(indentLevel > 0 ? { indent: em(2 * indentLevel) } : {}),
        }),
      ],
      { margin: left(articleIndent) },
    );
  };
};

/**
 * 目次ページを組版する．
 */
export const Toc = ({ parts }: TocProps): JsxElement => {
  const authorMap = new Map<string, string>();
  const numberMap = new Map<string, string>();
  const titleMap = new Map<string, string>();
  for (const part of parts) {
    for (const article of part.articles) {
      if (article.h1Id) {
        titleMap.set(
          article.h1Id,
          article.titleToc ?? flattenTitle(article.title),
        );
      }
      if (article.h1Id && article.displayNum) {
        numberMap.set(article.h1Id, article.displayNum);
      }
      if (article.h1Id && article.author) {
        authorMap.set(
          article.h1Id,
          article.authorDetail
            ? `${article.author}（${article.authorDetail}）`
            : article.author,
        );
      }
    }
  }

  const mapTocEntry = createTocEntryMapper(authorMap, numberMap, titleMap);

  return (
    <Group style={{ padding: tocPadding }}>
      <Nombre />
      <Vspace space={4} />
      <H1
        id="toc-heading"
        unnumbered
        style={{
          size: Q(24),
          font: boldFont,
          firstIndent: 0,
        }}
      >
        目次
      </H1>
      <Vspace space={6} />

      {/* 項目間の空きを gap にて表現 */}
      <Box
        style={{
          splitable: true,
          gaps: GAPS,
        }}
      >
        <Section
          block={{
            paragraph: {
              hyphenation: false,
              space: TEXT_SPACE_HEADTAIL_HALF,
            },
          }}
        >
          {toc({
            // PDF のしおりには残しつつ，紙面の目次からは除外
            filter: (_level, text) => text !== "目次",
            entry: (level, headingId, inlines) => {
              const entry = mapTocEntry(level, headingId, inlines);
              return level === 1
                ? box([entry], {
                    gapRole: headingId.startsWith("part-h1-")
                      ? "toc-part"
                      : "toc-article",
                  })
                : entry;
            },
          })}
        </Section>
      </Box>
    </Group>
  );
};
