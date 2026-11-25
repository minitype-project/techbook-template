import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  all,
  bottom,
  type CompositeFont,
  captionTransformer,
  em,
  fill,
  fn,
  footnoteTransformer,
  fr,
  headingTransformer,
  left,
  physical,
  Q,
  ratio,
  right,
  showOnHeading,
  solid,
  TEXT_SPACE_HEADTAIL_HALF,
} from "@minitype/minitype";
import {
  Box,
  Br,
  Caption,
  Code,
  Command,
  Document,
  evaluateMdxString,
  Figure,
  Flexbox,
  Float,
  Flow,
  filterWhitespace,
  Group,
  H1,
  Image,
  type InlineChildren,
  isMdxCode,
  type JsxElement,
  Kern,
  MathBlock,
  type MdxResult,
  minitypeJSX,
  P,
  ResetLabel,
  Section,
  Url,
  Vspace,
} from "@minitype/tsx";
import type { AuthorProfileProps } from "./components.js";
import * as sharedComponents from "./components.js";
import { bookMetadata, HONTOBIRA_PDF, USES_COLOR } from "./config.js";
import { colors } from "./styles/colors.js";
import {
  articleNumberUltraLightFont,
  boldFont,
  cuteFont,
  gothicFont,
} from "./styles/fonts.js";
import { documentStyle, pageSizeMm, textWidth } from "./styles/style.js";
import { Tobira } from "./tobira.js";
import { Toc } from "./toc.js";
import { formatCode } from "./utils/format-code.js";
import { grayscaleImageTransformer } from "./utils/grayscale.js";
import { Nombre } from "./utils/nombre.js";
import { parseCaption, preprocess } from "./utils/preprocess.js";
import { flattenTitle } from "./utils/title.js";

const fontDir = fileURLToPath(new URL("../fonts", import.meta.url));

/**
 * MDX ファイル 1 記事分の評価済みデータ．
 */
export interface ArticleData {
  /** 記事本文の組版要素． */
  blocks: JsxElement;
  /** 記事タイトル（frontmatter の `title`）． */
  title: string;
  /**
   * 目次用タイトル．
   * @default title を flatten したタイトル
   */
  titleToc?: string;
  /**
   * 扉用タイトル．
   * @default title を flatten したタイトル
   */
  titleTobira?: string;
  /** 著者名（frontmatter の `author`）． */
  author?: string;
  /** 著者補足情報（frontmatter の `author-detail`）． */
  authorDetail?: string;
  /** 目次リンク用の H1 要素 ID．{@link buildBook} が付与する． */
  h1Id?: string;
  /**
   * 本文段落に使用する合成フォント．
   * @default 文書デフォルトのフォント．
   */
  bodyFont?: CompositeFont;
  /**
   * 通し番号の表示の有無（false のとき非表示）．
   * @default true
   */
  numbered?: boolean;
  /**
   * 見出し上部の余白（mm）．
   * @default 4
   */
  topSpace?: number;
  /** 奥付として扱うかどうか（true のとき，タイトルを出力せず，目次にも登録しない）． */
  colophon?: boolean;
  /**
   * buildBook が付与する表示用通し番号（"01", "02", …）．
   * numbered が false のとき undefined．
   */
  displayNum?: string;
}

/**
 * 本文を含まない記事データ．
 * 扉など本文不要な場合に使用する．
 */
export type ArticleMeta = Omit<ArticleData, "blocks">;

/**
 * 複数記事をまとめた部．
 */
export interface ArticlePart<Article extends ArticleMeta = ArticleData> {
  /** 部扉に表示するラベル． */
  label: string;
  /** 部内の記事一覧． */
  articles: Article[];
  /** TOC より前に配置するかどうか（まえがきなど）． */
  beforeToc?: boolean;
}

// ------
// MDX カスタムコンポーネント
// ------

/**
 * 脚注番号の書式（本文中の参照・脚注欄の両方）．数字だけだと見づらいため「*1」の形にする．
 * 全角の「＊」は上付きにすると数字との間が空きすぎるため半角を用いる．
 */
const FOOTNOTE_MARK_OPTIONS = { before: "*" };

/**
 * minitype に渡すオプション．脚注側の番号も本文側の参照と同じ書式にする．
 */
const minitypeOptions = {
  fontDir,
  metadata: bookMetadata,
  disableDefaultTransformers: true,
  blockTransformers: [
    headingTransformer(),
    captionTransformer,
    footnoteTransformer(FOOTNOTE_MARK_OPTIONS),
    // モノクロ出力時は画像もグレースケールに変換
    ...(USES_COLOR ? [] : [grayscaleImageTransformer]),
  ],
};

/**
 * MDX コンポーネントを作成する．
 */
const createMdxComponents = (autoFormat: boolean) => {
  return {
    // リンク：脚注参照の番号を FOOTNOTE_MARK_OPTIONS の書式にする
    a: ({
      href,
      id,
      children,
      "data-footnote-ref": dataFootnoteRef,
      "data-footnote-backref": dataFootnoteBackref,
    }: Record<string, unknown>): JsxElement => {
      if (dataFootnoteBackref !== undefined) {
        return null as unknown as JsxElement;
      }
      if (
        dataFootnoteRef &&
        typeof id === "string" &&
        id.startsWith("user-content-fnref-")
      ) {
        return fn(
          id.slice("user-content-fnref-".length),
          FOOTNOTE_MARK_OPTIONS,
        ) as unknown as JsxElement;
      }
      return Url({
        href: typeof href === "string" ? href : "",
        children: children as InlineChildren,
      });
    },

    // blockquote：左罫線付きの引用ブロック
    blockquote: ({ children }: Record<string, unknown>): JsxElement => {
      return Box({
        children: filterWhitespace(children),
        style: {
          border: left(solid(0.5, colors.gray40)),
          padding: physical(2, 5),
          splitable: true,
          gapRole: "blockquote",
        },
      });
    },

    // コードブロックに背景を適用するために，Box でラップしたブロックを返す．
    // lang に ":" を含む場合（例：ts:ファイル名.ts），コロン以降をキャプションとして扱う．
    // キャプションに "#label" を含む場合（例：ts:ファイル名.ts#code:hello），label として登録する．
    // label に "@t" / "@b" を付与すると float top / bottom になる（例：#lst:hello@t）
    pre: ({ children }: Record<string, unknown>): JsxElement => {
      // remark-math の数式ブロック（$$...$$）は MathBlock として出力する
      if (isMdxCode(children) && children.lang?.includes("math-display")) {
        return MathBlock({ children: children.content });
      }
      const rawContent = isMdxCode(children)
        ? children.content
        : String(children ?? "");
      const lang = isMdxCode(children) ? (children.lang ?? "") : "";
      // @minitype/tsx が `ts:キャプション` の `:` 以降を meta に移す
      const meta = isMdxCode(children) ? (children.meta ?? "") : "";
      const { caption, label: codeLabel, position } = parseCaption(meta);
      const content =
        autoFormat && lang ? formatCode(rawContent, lang) : rawContent;
      const code = Code({
        children: content,
        lang: lang || undefined,
        label: codeLabel,
      });
      const codeBox = Box({
        children: code,
        style: {
          splitable: true,
          border: all(solid(0.2, colors.gray40)),
          padding: physical(4, 5),
          borderRadius: 1,
          background: [fill(colors.gray5)],
          gapRole: "code",
          paddingOnBreak: false,
        },
      });
      const result = caption
        ? Box({
            children: [codeBox, Caption({ children: caption })],
            style: { gapRole: "code", splitable: true },
          })
        : codeBox;
      return position ? Float({ children: result, position }) : result;
    },

    // 図（Markdown の ![]() 記法）
    // alt に "#label" を含む場合（例：![キャプション#fig:cherry](url)），label として登録する．
    // src に "?ratio=0.5" を含む場合，ratio として使用する．
    // label に "@t" / "@b" を付与すると float top / bottom になる（例：#fig:cherry@t）．
    img: ({ src, alt }: Record<string, unknown>): JsxElement => {
      const srcStr = typeof src === "string" ? src : "";
      const qIdx = srcStr.indexOf("?");
      const cleanSrc = qIdx >= 0 ? srcStr.slice(0, qIdx) : srcStr;
      const query = qIdx >= 0 ? srcStr.slice(qIdx + 1) : "";
      const params = new URLSearchParams(query);
      const rawRatio = params.get("ratio");
      const ratioValue = rawRatio ? parseFloat(rawRatio) : 1.0;
      const altStr = typeof alt === "string" ? alt : "";
      const { caption, label: figLabel, position } = parseCaption(altStr);
      const fig =
        caption.length > 0
          ? Figure({
              src: cleanSrc,
              style: { width: ratio(ratioValue), captionWidth: ratio(1.0) },
              label: figLabel,
              children: caption,
            })
          : Image({
              src: cleanSrc,
              style: { width: ratio(ratioValue), align: "center" },
            });
      return position ? Float({ children: fig, position }) : fig;
    },
  };
};

/**
 * 記事を評価して MDX ブロックを返す．
 */
export const evaluateArticle = async (mdxPath: string): Promise<MdxResult> => {
  const content = readFileSync(mdxPath, "utf-8");
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = fmMatch?.[1] ?? "";
  const autoFormat = !/^\s*auto-format\s*:\s*false\s*$/m.test(fm);

  // 本文評価前に，同じ MDX パーサを用いて YAML の引用符や複数行文字列を解釈
  const { frontmatter } = await evaluateMdxString(fmMatch?.[0] ?? "");
  const author =
    typeof frontmatter.author === "string" ? frontmatter.author : "";
  const authorDetail = frontmatter["author-detail"];
  const authorName =
    author && typeof authorDetail === "string" && authorDetail
      ? `${author}（${authorDetail}）`
      : author;
  // 記事中の画像パスは記事ディレクトリからの相対パスとして解決する．
  // 記事ディレクトリに該当ファイルがなければプロジェクトルートから解決する．
  const articleDir = path.dirname(path.resolve(mdxPath));
  const resolveArticleAsset = (src: string): string => {
    const fromArticle = path.resolve(articleDir, src);
    return existsSync(fromArticle) ? fromArticle : path.resolve(src);
  };
  const authorImage =
    typeof frontmatter["author-image"] === "string"
      ? resolveArticleAsset(frontmatter["author-image"])
      : undefined;

  // 記事ディレクトリの components.tsx / .ts を自動ロードしてコンポーネント登録する．
  // この import() は ssrLoadModule 経由で実行されるため Vite のトランスフォームが適用される．
  let articleComponents: Record<string, unknown> = {};
  for (const ext of ["tsx", "ts"]) {
    const compPath = path.join(articleDir, `components.${ext}`);
    if (existsSync(compPath)) {
      try {
        articleComponents = await import(/* @vite-ignore */ compPath);
      } catch (error) {
        console.error(`Failed to load ${compPath}:`, error);
      }
      break;
    }
  }

  // frontmatter の著者情報を AuthorProfile のデフォルト値として注入
  const AuthorProfileWithDefaults = (props: AuthorProfileProps) =>
    sharedComponents.AuthorProfile({
      ...props,
      name: props.name ?? authorName,
      image:
        props.image !== undefined
          ? resolveArticleAsset(props.image)
          : authorImage,
    });

  return evaluateMdxString(preprocess(content), {
    baseUrl: new URL(`file://${path.resolve(mdxPath)}`),
    resolveAsset: resolveArticleAsset,
    components: {
      ...createMdxComponents(autoFormat),
      ...sharedComponents,
      AuthorProfile: AuthorProfileWithDefaults,
      ...articleComponents,
    },
  });
};

// ------
// 組版処理
// ------

/**
 * frontmatter から必須フィールドを取り出し，未定義なら例外を投げる．
 */
export const extractFrontmatter = (
  frontmatter: MdxResult["frontmatter"],
  mdxPath: string,
): {
  title: string;
  titleToc?: string;
  titleTobira?: string;
  author?: string;
  authorDetail: string | undefined;
  topSpace: number | undefined;
} => {
  const title = frontmatter.title;
  if (typeof title !== "string" || !title) {
    throw new Error(`Missing or invalid "title" in frontmatter: ${mdxPath}`);
  }
  const author = frontmatter.author;
  const authorDetail = frontmatter["author-detail"];
  const rawTopSpace = frontmatter["heading-top-space"];
  return {
    title,
    ...Object.fromEntries(
      ["toc", "tobira"].map((kind) => {
        const value = frontmatter[`title-${kind}`];
        if (value !== undefined && (typeof value !== "string" || !value)) {
          throw new Error(`Invalid "title-${kind}" in frontmatter: ${mdxPath}`);
        }
        return [`title${kind[0].toUpperCase()}${kind.slice(1)}`, value];
      }),
    ),
    author: typeof author === "string" && author ? author : undefined,
    authorDetail: typeof authorDetail === "string" ? authorDetail : undefined,
    topSpace: typeof rawTopSpace === "number" ? rawTopSpace : undefined,
  };
};

// ------
// 書籍（複数記事）の組版
// ------

/**
 * MDX ファイルを評価して {@link ArticleData} を返す．
 */
export const loadArticle = async (mdxPath: string): Promise<ArticleData> => {
  const { blocks, frontmatter } = await evaluateArticle(mdxPath);
  return { blocks, ...extractFrontmatter(frontmatter, mdxPath) };
};

/**
 * frontmatter のみを読み込む（MDX 評価なし）．
 * 扉など本文不要な場合に使用する．
 */
export const loadArticleMeta = (
  mdxPath: string,
): Pick<
  ArticleData,
  "title" | "titleToc" | "titleTobira" | "author" | "authorDetail"
> => {
  const content = readFileSync(mdxPath, "utf-8");
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const fm = fmMatch?.[1] ?? "";
  const titleMatch = fm.match(/^\s*title\s*:\s*(.+)\s*$/m);
  const authorMatch = fm.match(/^\s*author\s*:\s*(.+)\s*$/m);
  const authorDetailMatch = fm.match(/^\s*author-detail\s*:\s*(.+)\s*$/m);
  const title = titleMatch?.[1]?.trim() ?? "";
  if (!title) {
    throw new Error(`Missing "title" in frontmatter: ${mdxPath}`);
  }
  return {
    title,
    ...Object.fromEntries(
      ["toc", "tobira"].map((kind) => [
        `title${kind[0].toUpperCase()}${kind.slice(1)}`,
        fm
          .match(new RegExp(`^[ \t]*title-${kind}[ \t]*:[ \t]*(.+)$`, "m"))?.[1]
          ?.trim() || undefined,
      ]),
    ),
    author: authorMatch?.[1]?.trim() || undefined,
    authorDetail: authorDetailMatch?.[1]?.trim() || undefined,
  };
};

/**
 * 記事のコンポーネントを返す．
 */
const compositeArticle = ({
  blocks,
  title,
  author,
  authorDetail,
  h1Id,
  bodyFont,
  displayNum,
  topSpace,
}: ArticleData): JsxElement => {
  // 著者名（詳細があれば括弧内に追加）
  const formattedAuthor = authorDetail
    ? `${author}（${authorDetail}）`
    : author;

  // 柱では改行指定を取り除く．
  const pillarTitle = flattenTitle(title);

  const formattedTitle = title
    .split("\\n")
    .flatMap((line, i) => (i === 0 ? [line] : [Br(), line]));

  const articleNum = displayNum;

  return (
    <Group>
      <ResetLabel />

      {/* 柱（左ページ：タイトル／右ページ：著者名）：通し番号のない記事では非表示 */}
      {articleNum && (
        <>
          <Flow
            position="pillar"
            blockOffset={-14}
            page={(pageIndex) => pageIndex % 2 === 1}
          >
            <Flexbox style={{ gap: 4, alignItems: "start" }}>
              <Box
                style={{
                  splitable: false,
                  inlineSize: 10,
                  padding: right(10),
                  border: right(solid(0.4, colors.gray40)),
                }}
              >
                <P
                  style={{
                    size: Q(20),
                    font: gothicFont,
                    firstIndent: 0,
                  }}
                >
                  {articleNum}
                </P>
              </Box>
              <Box
                style={{
                  splitable: false,
                  inlineSize: fr(1),
                }}
              >
                <P
                  style={{
                    size: Q(11),
                    font: gothicFont,
                    firstIndent: 0,
                    blockOffset: -1.4,
                    space: TEXT_SPACE_HEADTAIL_HALF,
                  }}
                >
                  {pillarTitle}
                </P>
              </Box>
            </Flexbox>
          </Flow>

          {author && (
            <Flow
              position="pillar"
              blockOffset={-14 + Q(20) - Q(14)}
              inlineOffset={textWidth - 20}
              inlineSize={20}
              page={(pageIndex) => pageIndex % 2 === 0}
            >
              <Box
                style={{
                  padding: bottom(2),
                  border: bottom(solid(0.2, colors.gray40)),
                }}
              >
                <P
                  style={{
                    size: Q(11),
                    font: gothicFont,
                    firstIndent: 0,
                    align: "right",
                  }}
                >
                  <Command
                    style={{
                      padding: right(0),
                    }}
                  >
                    {author}
                  </Command>
                </P>
              </Box>
            </Flow>
          )}
        </>
      )}

      <Nombre />

      {/* 記事番号 */}
      {displayNum && (
        <Flow
          position="pillar"
          page={showOnHeading()}
          inlineOffset={-16}
          blockOffset={(topSpace ?? 4) - 8}
          inlineSize={22}
          zIndex={-1}
        >
          <P
            style={{
              size: Q(124),
              lineHeight: em(1),
              font: articleNumberUltraLightFont,
              firstIndent: 0,
            }}
          >
            <Command style={{ effects: [fill(colors.gray15)] }}>
              {displayNum.startsWith("1") && displayNum.length > 1 ? (
                <>
                  {displayNum[0]}
                  <Kern em={-0.1} />
                  {displayNum.slice(1)}
                </>
              ) : (
                displayNum
              )}
            </Command>
          </P>
        </Flow>
      )}

      {/* タイトル，著者名 */}
      <Vspace space={topSpace ?? 4} />
      <H1 id={h1Id} style={{ ...(author ? {} : { font: cuteFont }) }}>
        {formattedTitle}
      </H1>

      {author && (
        <P
          style={{
            size: Q(16),
            font: boldFont,
            firstIndent: 0,
          }}
        >
          {formattedAuthor}
        </P>
      )}
      <Vspace space={8} />

      {/* 本文 */}
      {bodyFont ? (
        <Section block={{ paragraph: { font: bodyFont } }}>{blocks}</Section>
      ) : (
        blocks
      )}
    </Group>
  );
};

/**
 * 奥付ページを組版する（H1 なし，目次登録なし）．
 */
const compositeColophon = ({ blocks }: ArticleData): JsxElement => {
  return <Group>{blocks}</Group>;
};

/**
 * 部と記事に，リンク用の ID，表示用通し番号，部扉の番号を付与する．
 */
export const assignIds = <Article extends ArticleMeta>(
  parts: ArticlePart<Article>[],
) => {
  let articleIndex = 0;
  let displayIndex = 0;
  let partNo = 0;
  return parts.map((part, partIndex) => ({
    ...part,
    partH1Id: `part-h1-${partIndex}`,
    // 部扉は目次より後にあり，ラベルを持つ部にのみ置く
    partNo: !part.beforeToc && part.label ? ++partNo : undefined,
    articles: part.articles.map((article) => ({
      ...article,
      h1Id: article.colophon ? undefined : `article-h1-${articleIndex++}`,
      displayNum:
        !article.colophon && article.numbered !== false
          ? String(++displayIndex).padStart(2, "0")
          : undefined,
    })),
  }));
};

/**
 * 目次 + 複数記事をビルドする．
 */
export const buildBook = (
  parts: ArticlePart[],
): ReturnType<typeof minitypeJSX> => {
  const partsWithIds = assignIds(parts);

  // Document の直下にフラットに展開（Group のネストを避ける）
  const prefaceGroups: JsxElement[] = partsWithIds
    .filter((part) => part.beforeToc)
    .flatMap((part) =>
      part.articles.map((article) => compositeArticle(article)),
    );

  const bodyGroups: JsxElement[] = partsWithIds
    .filter((part) => !part.beforeToc)
    .flatMap((part) => [
      ...(part.partNo !== undefined
        ? [<Tobira part={part} partNo={part.partNo} />]
        : []),
      ...part.articles.map((article) =>
        article.colophon
          ? compositeColophon(article)
          : compositeArticle(article),
      ),
    ]);

  const doc = (
    <Document style={documentStyle}>
      {/* 本扉をページ全面に配置．本文は2ページ目から開始． */}
      {HONTOBIRA_PDF !== null && (
        <Group style={{ padding: physical(0) }}>
          <Flow position="page" inlineSize={pageSizeMm.width}>
            <Image
              src={HONTOBIRA_PDF}
              style={{ width: pageSizeMm.width, height: pageSizeMm.height }}
            />
          </Flow>
        </Group>
      )}
      {prefaceGroups}
      <Toc parts={partsWithIds} />
      {bodyGroups}
    </Document>
  );
  return minitypeJSX(doc, minitypeOptions);
};

/**
 * 扉ページのみをビルドする（MDX 評価なし）．
 */
export const buildTobira = (
  parts: ArticlePart<ArticleMeta>[],
  bleedMm = 0,
): ReturnType<typeof minitypeJSX> => {
  const partsWithIds = assignIds(parts);

  const tobiraGroups = partsWithIds.flatMap((part) =>
    part.partNo !== undefined
      ? [<Tobira part={part} partNo={part.partNo} bleedMm={bleedMm} />]
      : [],
  );

  const doc = (
    <Document
      style={{
        ...documentStyle,
        size: {
          width: pageSizeMm.width + bleedMm * 2,
          height: pageSizeMm.height + bleedMm * 2,
        },
      }}
    >
      {tobiraGroups}
    </Document>
  );
  return minitypeJSX(doc, minitypeOptions);
};

/**
 * 記事をビルドする．
 */
export const buildArticle = ({
  blocks,
  title,
  author,
  authorDetail,
  bodyFont,
  topSpace,
  colophon,
  displayNum,
}: ArticleData): ReturnType<typeof minitypeJSX> => {
  const group = colophon
    ? compositeColophon({
        blocks,
        title,
        author,
        authorDetail,
        bodyFont,
        topSpace,
        colophon,
        displayNum,
      })
    : compositeArticle({
        blocks,
        title,
        author,
        authorDetail,
        bodyFont,
        topSpace,
        displayNum,
      });
  const doc = <Document style={documentStyle}>{group}</Document>;
  return minitypeJSX(doc, minitypeOptions);
};
