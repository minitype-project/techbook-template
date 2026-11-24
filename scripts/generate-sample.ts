import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { sectionLabels } from "../template/config.js";
import { extractPages, resolveOutlinePageIndex } from "./pdf.js";

// data/ebook-v<N>.pdf のうち最新版から，
// 表紙・目次・各記事の 1 ページ目・裏表紙を抜粋して data/ebook-v<N>-sample.pdf を出力する．
// ページの位置は PDF のアウトライン（しおり）から求める．

const dataDir = fileURLToPath(new URL("../data/", import.meta.url));

const TOC_TITLE = "目次";
/**
 * 記事として扱わないアウトライン項目．
 */
const excludedTitles = new Set([
  "まえがき",
  "あとがき",
  TOC_TITLE,
  ...Object.values(sectionLabels).filter((label) => label !== ""),
]);

/**
 * data/ 以下で最もバージョン番号の大きい ebook-v*.pdf を返す．
 */
const findLatestEbook = (): { path: string; version: number } => {
  const candidates = readdirSync(dataDir)
    .map((file) => ({ file, match: file.match(/^ebook-v(\d+)\.pdf$/) }))
    .filter(({ match }) => match !== null)
    .map(({ file, match }) => ({
      path: `${dataDir}${file}`,
      version: Number(match?.[1]),
    }))
    .sort((a, b) => b.version - a.version);
  if (candidates.length === 0) {
    throw new Error("data/ebook-v*.pdf が見つかりません");
  }
  return candidates[0];
};

/**
 * アウトラインのトップレベル項目と，その遷移先のページインデックス（0 始まり）を返す．
 */
const loadOutline = async (
  data: Uint8Array,
): Promise<{ title: string; pageIndex: number }[]> => {
  const doc = await getDocument({ data }).promise;
  const outline = (await doc.getOutline()) ?? [];
  const entries: { title: string; pageIndex: number }[] = [];
  for (const item of outline) {
    const pageIndex = await resolveOutlinePageIndex(doc, item);
    if (pageIndex === undefined) {
      continue;
    }
    entries.push({ title: item.title, pageIndex });
  }
  await doc.destroy();
  return entries.sort((a, b) => a.pageIndex - b.pageIndex);
};

const main = async () => {
  const { path, version } = findLatestEbook();
  const bytes = readFileSync(path);
  // pdfjs は渡したバッファを転送して使えなくするため，コピーを渡す
  const outline = await loadOutline(new Uint8Array(bytes));
  const srcDoc = await PDFDocument.load(bytes);
  const pageCount = srcDoc.getPageCount();

  const tocIndex = outline.findIndex((entry) => entry.title === TOC_TITLE);
  if (tocIndex < 0) {
    throw new Error("アウトラインに目次が見つかりません");
  }
  const tocStart = outline[tocIndex].pageIndex;
  const tocEnd = (outline[tocIndex + 1]?.pageIndex ?? pageCount) - 1;
  const tocPages = Array.from(
    { length: tocEnd - tocStart + 1 },
    (_, i) => tocStart + i,
  );

  const articles = outline.filter((entry) => !excludedTitles.has(entry.title));

  const pages: { label: string; pageIndex: number }[] = [
    { label: "表紙", pageIndex: 0 },
    ...tocPages.map((pageIndex) => ({ label: TOC_TITLE, pageIndex })),
    ...articles.map((entry) => ({
      label: entry.title,
      pageIndex: entry.pageIndex,
    })),
    { label: "裏表紙", pageIndex: pageCount - 1 },
  ];

  const outDoc = await extractPages(
    srcDoc,
    pages.map((page) => page.pageIndex),
  );
  outDoc.setTitle(srcDoc.getTitle() ?? "");
  outDoc.setAuthor(srcDoc.getAuthor() ?? "");

  mkdirSync(dataDir, { recursive: true });
  const fileName = `ebook-v${version}-sample.pdf`;
  writeFileSync(`${dataDir}${fileName}`, await outDoc.save());

  for (const { label, pageIndex } of pages) {
    console.log(`p.${String(pageIndex + 1).padStart(3)}  ${label}`);
  }
  console.log(`Built: data/${fileName} (${pages.length} page(s))`);
};

main();
