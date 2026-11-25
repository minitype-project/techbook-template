import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import {
  articleOrder,
  type PartType,
  partLabels,
  USES_PARTS,
} from "../template/config.js";
import {
  type ArticleMeta,
  type ArticlePart,
  assignIds,
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

// Windows の cmd.exe でも動くように，環境変数ではなくフラグでモードを切り替える
const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
// npm run dev のときは scripts/dev.ts が環境変数 ARTICLE に記事名を設定する
const name = args.find((arg) => !arg.startsWith("--")) ?? process.env.ARTICLE;
// --all のとき，articles/ 以下の全記事を個別 PDF としてビルド
const buildAll = flags.has("--all");
// --toc のとき，目次のみを dist/toc.pdf としてビルド
const buildTocOnly = flags.has("--toc");
// --tobira のとき，扉ページのみを dist/tobira.pdf としてビルド
// --tobira-padding のとき，各辺 3 mm の塗り足し付きの扉をビルド
const tobiraBleedMm = flags.has("--tobira-padding") ? 3 : 0;
const buildTobiraOnly = flags.has("--tobira") || tobiraBleedMm > 0;

/**
 * 部の一覧に含まれる記事の総数を返す．
 * @param parts 部の一覧．
 */
const countArticles = (parts: ArticlePart[]): number => {
  return parts.reduce((count, part) => count + part.articles.length, 0);
};

/**
 * 記事が属する部の種類を返す．
 * @param name 記事のディレクトリ名．
 * @returns `articleOrder` に含まれない場合は undefined．
 */
const findPartType = (name: string): PartType | undefined => {
  return articleOrder.find((part) => part.articles.includes(name))?.type;
};

/**
 * 部の種類に応じて，記事にスタイルを適用する．
 * @param article 記事データ．
 * @param type 部の種類．
 */
const applyPartStyle = <Article extends ArticleMeta>(
  article: Article,
  type: PartType | undefined,
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
 * `articleOrder` の設定に従って各記事を読み込み，部の一覧を返す．
 * 存在しない記事は警告を表示して読み飛ばす．
 * @param load MDX ファイルのパスから記事データを読み込む関数．
 * @returns 部ごとにグループ化された記事データの配列．
 */
const loadParts = async <Article extends ArticleMeta>(
  load: (mdxPath: string) => Article | Promise<Article>,
): Promise<ArticlePart<Article>[]> => {
  const parts: ArticlePart<Article>[] = [];
  for (const part of articleOrder) {
    const articles: Article[] = [];
    for (const name of part.articles) {
      const mdxPath = articlePath(name);
      if (!existsSync(mdxPath)) {
        console.error(`Article not found, skipping: ${name}`);
        continue;
      }
      articles.push(applyPartStyle(await load(mdxPath), part.type));
    }
    parts.push({
      // 部を使用しない場合は空のラベルとし，部扉と目次の部見出しを省く
      label: USES_PARTS ? partLabels[part.type] : "",
      articles,
      beforeToc: part.type === "preface",
    });
  }
  return parts;
};

/**
 * 書籍での掲載順に基づく記事の表示用番号を返す．
 * 個別ビルドでも書籍と同じ番号を使うため，書籍ビルドと同じ {@link assignIds} で採番する．
 * @param name 記事のディレクトリ名．
 * @returns `articleOrder` に含まれない，または番号を表示しない記事の場合は undefined．
 */
const findDisplayNumber = async (name: string): Promise<string | undefined> => {
  const parts = assignIds(
    await loadParts((mdxPath) => ({ ...loadArticleMeta(mdxPath), mdxPath })),
  );
  return parts
    .flatMap((part) => part.articles)
    .find((article) => article.mdxPath === articlePath(name))?.displayNum;
};

/**
 * 記事を単独でビルドし，dist/<name>.pdf に出力する．
 * @param name 記事のディレクトリ名．
 */
const buildArticlePdf = async (name: string) => {
  const article = applyPartStyle(
    {
      ...(await loadArticle(articlePath(name))),
      displayNum: await findDisplayNumber(name),
    },
    findPartType(name),
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
  const parts = await loadParts(loadArticleMeta);
  const fileName = tobiraBleedMm ? "tobira-padding.pdf" : "tobira.pdf";
  const doc = buildTobira(parts, tobiraBleedMm);
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
  const parts = await loadParts(loadArticle);
  const book = buildBook(parts);
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
    `Built: dist/toc.pdf (${tocPageCount} page(s), ${countArticles(parts)} article(s))`,
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
  const parts = await loadParts(loadArticle);
  const fileName = `book-${formatTimestamp()}.pdf`;
  const book = buildBook(parts);
  await assertNoMissingGlyphs(book);
  await book.save(`${distDir}${fileName}`);
  console.log(`Built: dist/${fileName} (${countArticles(parts)} article(s))`);
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
