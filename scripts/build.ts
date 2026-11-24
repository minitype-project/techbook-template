import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import {
  articleDisplayNumber,
  articleOrder,
  sectionLabels,
} from "../template/config.js";
import {
  type ArticleData,
  type ArticleSection,
  buildArticle,
  buildBook,
  buildTobira,
  loadArticle,
  loadArticleMeta,
} from "../template/index.js";
import { prefaceBodyFont } from "../template/styles/fonts.js";
import { assertNoMissingGlyphs } from "./diagnostics.js";

const articlesDir = new URL("../articles/", import.meta.url).pathname;

const name = process.argv[2];
// BUILD_ALL=1 のとき，articles/ 以下の全記事を個別 PDF としてビルド
const buildAll = !!process.env.BUILD_ALL;
// BUILD_TOC=1 のとき，目次のみを dist/toc.pdf としてビルド
const buildTocOnly = !!process.env.BUILD_TOC;
// BUILD_TOBIRA=1 のとき，扉ページのみを dist/tobira.pdf としてビルド
const tobiraBleedMm = process.env.BUILD_TOBIRA_PADDING ? 3 : 0;
const buildTobiraOnly = !!process.env.BUILD_TOBIRA || tobiraBleedMm > 0;

const distDir = new URL("../dist/", import.meta.url).pathname;

/**
 * `articleOrder` の設定に従い，各記事の MDX を読み込んでセクション一覧を返す．
 * @returns セクションごとにグループ化された記事データの配列．
 */
const loadSections = async (): Promise<ArticleSection[]> => {
  const sections: ArticleSection[] = [];
  for (const section of articleOrder) {
    const articles: ArticleData[] = [];
    for (const articleName of section.articles) {
      const mdxPath = `${articlesDir}${articleName}/index.mdx`;
      if (!existsSync(mdxPath)) {
        console.error(`Article not found, skipping: ${articleName}`);
        continue;
      }
      const article = await loadArticle(mdxPath);
      const isPrePostfaceStyle =
        section.type === "preface" || section.type === "postface";
      const isColophon = section.type === "colophon";
      articles.push(
        isColophon
          ? { ...article, numbered: false, colophon: true }
          : isPrePostfaceStyle
            ? { ...article, bodyFont: prefaceBodyFont, numbered: false }
            : article,
      );
    }
    sections.push({
      label: sectionLabels[section.type],
      articles,
      beforeToc: section.type === "preface",
    });
  }
  return sections;
};

/**
 * frontmatter のみを読んでセクション一覧を返す（MDX 評価なし）．
 * 扉ビルド用．
 */
const loadSectionsMeta = (): ArticleSection[] => {
  return articleOrder.map((section) => {
    const articles: ArticleData[] = [];
    for (const articleName of section.articles) {
      const mdxPath = `${articlesDir}${articleName}/index.mdx`;
      if (!existsSync(mdxPath)) {
        console.error(`Article not found, skipping: ${articleName}`);
        continue;
      }
      const meta = loadArticleMeta(mdxPath);
      const isColophon = section.type === "colophon";
      const isPrePostfaceStyle =
        section.type === "preface" || section.type === "postface";
      articles.push({
        ...meta,
        blocks: null as unknown as ReturnType<typeof Object>,
        ...(isColophon ? { numbered: false, colophon: true } : {}),
        ...(isPrePostfaceStyle ? { numbered: false } : {}),
      } as ArticleData);
    }
    return {
      label: sectionLabels[section.type],
      articles,
      beforeToc: section.type === "preface",
    };
  });
};

const main = async () => {
  mkdirSync(distDir, { recursive: true });
  // 扉ページのみビルド
  // dist/tobira.pdf を出力
  if (buildTobiraOnly) {
    const sections = loadSectionsMeta();
    const fileName = tobiraBleedMm ? "tobira-padding.pdf" : "tobira.pdf";
    const outputPath = new URL(`../dist/${fileName}`, import.meta.url).pathname;
    const doc = buildTobira(sections, tobiraBleedMm);
    await assertNoMissingGlyphs(doc);
    await doc.save(outputPath);
    console.log(`Built: dist/${fileName}`);
    return;
  }

  // 単一記事ビルド
  // dist/<name>.pdf を出力
  if (name) {
    const mdxPath = `${articlesDir}${name}/index.mdx`;
    let article = {
      ...(await loadArticle(mdxPath)),
      displayNum: articleDisplayNumber(name),
    };
    const section = articleOrder.find((entry) => entry.articles.includes(name));
    const isPrePostfaceStyle =
      section?.type === "preface" || section?.type === "postface";
    const isColophon = section?.type === "colophon";
    if (isColophon) {
      article = { ...article, numbered: false, colophon: true };
    } else if (isPrePostfaceStyle) {
      article = { ...article, bodyFont: prefaceBodyFont, numbered: false };
    }
    const outputPath = new URL(`../dist/${name}.pdf`, import.meta.url).pathname;
    const doc = buildArticle(article);
    await assertNoMissingGlyphs(doc);
    await doc.save(outputPath);
    console.log(
      `Built: dist/${name}.pdf (${article.title} / ${article.author})`,
    );
    return;
  }

  // 目次のみのビルド
  // フル PDF をビルドして最初の記事が始まるページまでを切り出し dist/toc.pdf を出力
  if (buildTocOnly) {
    const sections = await loadSections();
    const totalArticles = sections.reduce(
      (count, section) => count + section.articles.length,
      0,
    );
    const book = buildBook(sections);
    await assertNoMissingGlyphs(book);
    const layout = await book.getLayout();

    // 最初の記事 H1 のページ番号を探す（目次はそのページより前）
    const firstArticleHeading = layout.find(
      (item) => item.id === "article-h1-0",
    );
    const tocPageCount = firstArticleHeading?.pageIndex ?? 1;

    const pdfBytes = await book.toPdf();
    const srcDoc = await PDFDocument.load(pdfBytes);
    const tocDoc = await PDFDocument.create();
    const pageIndices = Array.from({ length: tocPageCount }, (_, i) => i);
    const copiedPages = await tocDoc.copyPages(srcDoc, pageIndices);
    for (const page of copiedPages) {
      tocDoc.addPage(page);
    }

    const outputPath = new URL("../dist/toc.pdf", import.meta.url).pathname;
    writeFileSync(outputPath, await tocDoc.save());
    console.log(
      `Built: dist/toc.pdf (${tocPageCount} page(s), ${totalArticles} article(s))`,
    );
    return;
  }

  // 全記事を個別 PDF としてビルド
  // articles/ 直下のディレクトリを走査して，dist/<name>.pdf を出力
  if (buildAll) {
    const names = readdirSync(articlesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const name of names) {
      const mdxPath = `${articlesDir}${name}/index.mdx`;
      let article = {
        ...(await loadArticle(mdxPath)),
        displayNum: articleDisplayNumber(name),
      };
      const section = articleOrder.find((entry) =>
        entry.articles.includes(name),
      );
      const isPrePostfaceStyle =
        section?.type === "preface" || section?.type === "postface";
      const isColophon = section?.type === "colophon";
      if (isColophon) {
        article = { ...article, numbered: false, colophon: true };
      } else if (isPrePostfaceStyle) {
        article = { ...article, bodyFont: prefaceBodyFont, numbered: false };
      }
      const outputPath = new URL(`../dist/${name}.pdf`, import.meta.url)
        .pathname;
      const doc = buildArticle(article);
      await assertNoMissingGlyphs(doc);
      await doc.save(outputPath);
      console.log(
        `Built: dist/${name}.pdf (${article.title} / ${article.author})`,
      );
    }
    return;
  }

  // 目次 + 全記事のビルド
  // config.ts の articleOrder に従って記事を結合して dist/<timestamp>.pdf を出力
  const sections = await loadSections();
  const totalArticles = sections.reduce(
    (count, section) => count + section.articles.length,
    0,
  );

  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const timestamp = jst.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const fileName = `book-${timestamp.slice(0, 8)}-${timestamp.slice(8, 14)}.pdf`;
  const outputPath = new URL(`../dist/${fileName}`, import.meta.url).pathname;

  const book = buildBook(sections);
  await assertNoMissingGlyphs(book);
  await book.save(outputPath);
  console.log(`Built: dist/${fileName} (${totalArticles} article(s))`);
};

main();
