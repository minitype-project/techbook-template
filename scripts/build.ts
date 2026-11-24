import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import {
  type ArticleType,
  articleDisplayNumber,
  articleOrder,
  sectionLabels,
  USES_PARTS,
} from "../template/config.js";
import {
  type ArticleMeta,
  type ArticleSection,
  buildArticle,
  buildBook,
  buildTobira,
  loadArticle,
  loadArticleMeta,
} from "../template/index.js";
import { prefaceBodyFont } from "../template/styles/fonts.js";
import { assertNoMissingGlyphs } from "./diagnostics.js";
import { articlePath, articlesDir, distDir } from "./paths.js";
import { extractPages } from "./pdf.js";

// npm run dev のときは scripts/dev.ts が環境変数 ARTICLE に記事名を設定する
const name = process.argv[2] ?? process.env.ARTICLE;
// BUILD_ALL=1 のとき，articles/ 以下の全記事を個別 PDF としてビルド
const buildAll = !!process.env.BUILD_ALL;
// BUILD_TOC=1 のとき，目次のみを dist/toc.pdf としてビルド
const buildTocOnly = !!process.env.BUILD_TOC;
// BUILD_TOBIRA=1 のとき，扉ページのみを dist/tobira.pdf としてビルド
const tobiraBleedMm = process.env.BUILD_TOBIRA_PADDING ? 3 : 0;
const buildTobiraOnly = !!process.env.BUILD_TOBIRA || tobiraBleedMm > 0;

/**
 * セクション一覧に含まれる記事の総数を返す．
 * @param sections セクション一覧．
 */
const countArticles = (sections: ArticleSection[]): number => {
  return sections.reduce(
    (count, section) => count + section.articles.length,
    0,
  );
};

/**
 * 記事が属するセクションの種別を返す．
 * @param name 記事のディレクトリ名．
 * @returns `articleOrder` に含まれない場合は undefined．
 */
const findSectionType = (name: string): ArticleType | undefined => {
  return articleOrder.find((section) => section.articles.includes(name))?.type;
};

/**
 * セクションの種別に応じて，記事にスタイルを適用する．
 * @param article 記事データ．
 * @param type セクションの種別．
 */
const applySectionStyle = <Article extends ArticleMeta>(
  article: Article,
  type: ArticleType | undefined,
): Article => {
  if (type === "colophon") {
    return { ...article, numbered: false, colophon: true };
  }
  if (type === "preface" || type === "postface") {
    return { ...article, bodyFont: prefaceBodyFont, numbered: false };
  }
  return article;
};

/**
 * `articleOrder` の設定に従って各記事を読み込み，セクション一覧を返す．
 * 存在しない記事は警告を表示して読み飛ばす．
 * @param load MDX ファイルのパスから記事データを読み込む関数．
 * @returns セクションごとにグループ化された記事データの配列．
 */
const loadSections = async <Article extends ArticleMeta>(
  load: (mdxPath: string) => Article | Promise<Article>,
): Promise<ArticleSection<Article>[]> => {
  const sections: ArticleSection<Article>[] = [];
  for (const section of articleOrder) {
    const articles: Article[] = [];
    for (const name of section.articles) {
      const mdxPath = articlePath(name);
      if (!existsSync(mdxPath)) {
        console.error(`Article not found, skipping: ${name}`);
        continue;
      }
      articles.push(applySectionStyle(await load(mdxPath), section.type));
    }
    sections.push({
      // 部を使用しない場合は空のラベルとし，部扉と目次の部見出しを省く
      label: USES_PARTS ? sectionLabels[section.type] : "",
      articles,
      beforeToc: section.type === "preface",
    });
  }
  return sections;
};

/**
 * 記事を単独でビルドし，dist/<name>.pdf に出力する．
 * @param name 記事のディレクトリ名．
 */
const buildArticlePdf = async (name: string) => {
  const article = applySectionStyle(
    {
      ...(await loadArticle(articlePath(name))),
      displayNum: articleDisplayNumber(name),
    },
    findSectionType(name),
  );
  const doc = buildArticle(article);
  await assertNoMissingGlyphs(doc);
  await doc.save(`${distDir}${name}.pdf`);
  console.log(`Built: dist/${name}.pdf (${article.title} / ${article.author})`);
};

/**
 * 扉ページのみをビルドし，dist/tobira.pdf（塗り足しありの場合は dist/tobira-padding.pdf）に出力する．
 */
const buildTobiraPdf = async () => {
  if (!USES_PARTS) {
    console.error("USES_PARTS is false, skipping tobira build");
    return;
  }
  const sections = await loadSections(loadArticleMeta);
  const fileName = tobiraBleedMm ? "tobira-padding.pdf" : "tobira.pdf";
  const doc = buildTobira(sections, tobiraBleedMm);
  await assertNoMissingGlyphs(doc);
  await doc.save(`${distDir}${fileName}`);
  console.log(`Built: dist/${fileName}`);
};

/**
 * articles/ 直下の全記事を個別にビルドし，dist/<name>.pdf に出力する．
 */
const buildAllArticlePdfs = async () => {
  const names = readdirSync(articlesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const name of names) {
    await buildArticlePdf(name);
  }
};

/**
 * 書籍全体をビルドし，最初の記事が始まるページまでを dist/toc.pdf に出力する．
 */
const buildTocPdf = async () => {
  const sections = await loadSections(loadArticle);
  const book = buildBook(sections);
  await assertNoMissingGlyphs(book);
  const layout = await book.getLayout();

  // 最初の記事 H1 のページ番号を探す（目次はそのページより前）
  const firstArticleHeading = layout.find((item) => item.id === "article-h1-0");
  const tocPageCount = firstArticleHeading?.pageIndex ?? 1;

  const srcDoc = await PDFDocument.load(await book.toPdf());
  const tocDoc = await extractPages(
    srcDoc,
    Array.from({ length: tocPageCount }, (_, i) => i),
  );
  writeFileSync(`${distDir}toc.pdf`, await tocDoc.save());
  console.log(
    `Built: dist/toc.pdf (${tocPageCount} page(s), ${countArticles(sections)} article(s))`,
  );
};

/**
 * 現在時刻（JST）を「YYYYMMDD-hhmmss」の形式で返す．
 */
const formatTimestamp = (): string => {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const timestamp = jst.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 14)}`;
};

/**
 * config.ts の articleOrder に従って目次と全記事を結合し，dist/book-<timestamp>.pdf に出力する．
 */
const buildBookPdf = async () => {
  const sections = await loadSections(loadArticle);
  const fileName = `book-${formatTimestamp()}.pdf`;
  const book = buildBook(sections);
  await assertNoMissingGlyphs(book);
  await book.save(`${distDir}${fileName}`);
  console.log(
    `Built: dist/${fileName} (${countArticles(sections)} article(s))`,
  );
};

const main = async () => {
  mkdirSync(distDir, { recursive: true });
  if (buildTobiraOnly) {
    await buildTobiraPdf();
  } else if (name) {
    await buildArticlePdf(name);
  } else if (buildTocOnly) {
    await buildTocPdf();
  } else if (buildAll) {
    await buildAllArticlePdfs();
  } else {
    await buildBookPdf();
  }
};

await main();
