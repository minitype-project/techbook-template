import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import { distDir } from "./paths.js";
import { resolveOutlinePageIndex } from "./pdf.js";

/*
 * 2 つの PDF の差分を検査する．
 *   npm run diff [old.pdf] [new.pdf]
 *
 * 引数を省略した場合は dist/book-*.pdf のうち新しい 2 つを比較する．
 * - ページ数・アウトライン（しおり）の差分
 * - ページごとのテキストの差分（行単位）
 * - ページごとの見た目の差分（pdftoppm でラスタライズし，ImageMagick で比較）
 *
 * 見た目の差分がある場合は dist/diff-<old>-<new>/ に差分画像と，それらを一覧できる index.html を出力する．
 * 既定では 25% 以内の色の違い（色空間の変更による黒の微小な差など）を無視して比較する．
 * 環境変数 DIFF_FUZZ で許容範囲を変更できる（DIFF_FUZZ=0 で厳密に比較）．
 */

/**
 * ラスタライズの解像度．
 */
const DPI = 100;
/**
 * 色の違いを無視する許容範囲（magick compare の -fuzz）．
 */
const FUZZ = process.env.DIFF_FUZZ ?? "25%";
const fuzzArgs = ["-fuzz", FUZZ];

/**
 * dist/ 以下の book-*.pdf のうち，ファイル名順で新しい 2 つを返す．
 */
const findLatestBooks = (): [string, string] => {
  const books = readdirSync(distDir)
    .filter((file) => /^book-\d{8}-\d{6}\.pdf$/.test(file))
    .sort();
  if (books.length < 2) {
    throw new Error("dist/book-*.pdf が 2 つ以上見つかりません");
  }
  return [join(distDir, books.at(-2) ?? ""), join(distDir, books.at(-1) ?? "")];
};

type PdfInfo = {
  pageCount: number;
  outline: string[];
  /** ページごとのテキスト（行の配列）． */
  pages: string[][];
};

/**
 * アウトラインを「インデント + タイトル -> ページ番号」の文字列として平坦化する．
 */
const flattenOutline = async (doc: PDFDocumentProxy): Promise<string[]> => {
  const lines: string[] = [];
  type Item = NonNullable<Awaited<ReturnType<typeof doc.getOutline>>>[number];
  const visit = async (items: Item[], depth: number) => {
    for (const item of items) {
      const pageIndex = await resolveOutlinePageIndex(doc, item);
      const page = pageIndex === undefined ? "?" : pageIndex + 1;
      lines.push(`${"  ".repeat(depth)}${item.title} -> p.${page}`);
      await visit(item.items, depth + 1);
    }
  };
  await visit((await doc.getOutline()) ?? [], 0);
  return lines;
};

const loadPdf = async (path: string): Promise<PdfInfo> => {
  const doc = await getDocument({
    data: new Uint8Array(readFileSync(path)),
    cMapUrl: fileURLToPath(
      new URL("../node_modules/pdfjs-dist/cmaps/", import.meta.url),
    ),
    cMapPacked: true,
    verbosity: 0,
  }).promise;
  const pages: string[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if ("str" in item) {
        text += item.str + (item.hasEOL ? "\n" : "");
      }
    }
    pages.push(
      text
        .split("\n")
        .map((line) => line.trimEnd())
        .filter((line) => line !== ""),
    );
    page.cleanup();
  }
  const outline = await flattenOutline(doc);
  const pageCount = doc.numPages;
  await doc.destroy();
  return { pageCount, outline, pages };
};

/**
 * LCS に基づく行単位の差分を返す．
 */
const diffLines = (oldLines: string[], newLines: string[]): string[] => {
  const oldCount = oldLines.length;
  const newCount = newLines.length;
  const dp = Array.from({ length: oldCount + 1 }, () =>
    new Array<number>(newCount + 1).fill(0),
  );
  for (let i = oldCount - 1; i >= 0; i--) {
    for (let j = newCount - 1; j >= 0; j--) {
      dp[i][j] =
        oldLines[i] === newLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < oldCount && j < newCount) {
    if (oldLines[i] === newLines[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push(`- ${oldLines[i++]}`);
    } else {
      out.push(`+ ${newLines[j++]}`);
    }
  }
  while (i < oldCount) {
    out.push(`- ${oldLines[i++]}`);
  }
  while (j < newCount) {
    out.push(`+ ${newLines[j++]}`);
  }
  return out;
};

/**
 * PDF を PNG にラスタライズし，ページ番号順のファイルパスを返す．
 */
const rasterize = (pdf: string, dir: string): string[] => {
  mkdirSync(dir, { recursive: true });
  execFileSync("pdftoppm", ["-r", String(DPI), "-png", pdf, join(dir, "p")]);
  return readdirSync(dir)
    .filter((file) => file.endsWith(".png"))
    .sort()
    .map((file) => join(dir, file));
};

/**
 * 2 枚の画像の差分ピクセル数を返し，差分があれば diffPath に差分画像を書き出す．
 */
const comparePage = (
  oldImage: string,
  newImage: string,
  diffPath: string,
): number => {
  const highlighted = `${diffPath}.tmp.png`;
  try {
    // magick compare は差分があると終了コード 1 を返し，計測値を stderr に出す
    execFileSync(
      "magick",
      [
        "compare",
        ...fuzzArgs,
        "-metric",
        "AE",
        oldImage,
        newImage,
        highlighted,
      ],
      { stdio: "pipe" },
    );
    rmSync(highlighted);
    return 0;
  } catch (error) {
    const result = error as { status: number; stderr: Buffer };
    if (result.status !== 1) {
      rmSync(highlighted, { force: true });
      throw error;
    }
    const pixels = Number.parseFloat(result.stderr.toString());
    // 前後比較しやすいよう，旧・差分・新を横に並べた画像を出力する
    execFileSync("magick", [
      oldImage,
      highlighted,
      newImage,
      "+append",
      diffPath,
    ]);
    rmSync(highlighted);
    return pixels;
  }
};

/**
 * ページ番号の一覧を「p.1, p.3」の形式に整形する．
 * @param pages ページ番号の一覧．
 */
const formatPages = (pages: Iterable<number>): string => {
  const labels = [...pages].map((page) => `p.${page}`);
  return labels.length > 0 ? labels.join(", ") : "なし";
};

const escapeHtml = (text: string): string => {
  return text.replace(
    /[&<>"]/g,
    (char) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[char]};`,
  );
};

/**
 * 見た目の差分があるページを一覧できる HTML を生成する．
 */
const renderReport = ({
  oldPath,
  newPath,
  summary,
  visualDiffs,
}: {
  oldPath: string;
  newPath: string;
  /** ページ数・アウトラインの差分など，ページに属さない差分． */
  summary: string[];
  visualDiffs: Map<number, number>;
}): string => {
  const pages = [...visualDiffs.keys()].sort((a, b) => a - b);
  const nav = pages
    .map(
      (page) =>
        `<a href="#p${page}" data-page="${page}"><b>p.${page}</b> <span>${visualDiffs.get(page)} px</span></a>`,
    )
    .join("\n");
  // 差分ピクセル数をキーに含め，差分が変わったページは未確認に戻す
  const sections = pages
    .map(
      (page) =>
        `<section id="p${page}" data-page="${page}" data-key="${page}:${visualDiffs.get(page)}"><h2>p.${page}<label><input type="checkbox"> 確認済み</label></h2><img loading="lazy" src="p${String(page).padStart(3, "0")}.png" alt="p.${page}"></section>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>PDF diff</title>
<style>
body { margin: 0; font-family: sans-serif; display: flex; }
nav { position: sticky; top: 0; height: 100vh; overflow-y: auto; min-width: 11em; border-right: 1px solid #ccc; font-size: 13px; }
nav a { display: block; padding: 2px 8px; color: inherit; text-decoration: none; }
nav a:hover { background: #eee; }
nav span { color: #888; }
nav a.viewed { color: #aaa; }
nav a.viewed b { font-weight: normal; }
h2 { display: flex; align-items: center; gap: 1em; font-size: 18px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
h2 label { font-size: 13px; font-weight: normal; cursor: pointer; }
section.viewed img { display: none; }
section.viewed h2 { color: #aaa; }
main { padding: 0 16px; min-width: 0; }
img { width: 100%; border: 1px solid #ccc; }
pre { white-space: pre-wrap; font-size: 13px; }
</style>
</head>
<body>
<nav>${nav}</nav>
<main>
<h1>PDF diff</h1>
<p>old: ${escapeHtml(oldPath)}<br>new: ${escapeHtml(newPath)}<br>fuzz: ${escapeHtml(FUZZ)}</p>
<p>画像は左から 旧 | 差分 | 新（確認済み：<span id="progress"></span>）</p>
${summary.length > 0 ? `<pre>${escapeHtml(summary.join("\n"))}</pre>` : ""}
${sections}
</main>
<script>
// 確認済みのページを localStorage に保存する（キーはレポートのパスごと）
const storageKey = \`diff-pdf-viewed:\${location.pathname}\`;
const load = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
  } catch {
    return new Set();
  }
};
const viewed = load();
const sections = [...document.querySelectorAll("section[data-key]")];
const update = () => {
  for (const section of sections) {
    const isViewed = viewed.has(section.dataset.key);
    section.classList.toggle("viewed", isViewed);
    section.querySelector("input").checked = isViewed;
    document
      .querySelector(\`nav a[data-page="\${section.dataset.page}"]\`)
      .classList.toggle("viewed", isViewed);
  }
  const count = sections.filter((target) => viewed.has(target.dataset.key)).length;
  document.getElementById("progress").textContent = \`\${count} / \${sections.length}\`;
  try {
    localStorage.setItem(storageKey, JSON.stringify([...viewed]));
  } catch {}
};
for (const section of sections) {
  section.querySelector("input").addEventListener("change", (event) => {
    if (event.target.checked) {
      viewed.add(section.dataset.key);
    } else {
      viewed.delete(section.dataset.key);
    }
    update();
  });
}
update();
</script>
</body>
</html>
`;
};

const main = async () => {
  const [oldPath, newPath] =
    process.argv.length >= 4
      ? [process.argv[2], process.argv[3]]
      : findLatestBooks();
  for (const path of [oldPath, newPath]) {
    if (!existsSync(path)) {
      throw new Error(`${path} が見つかりません`);
    }
  }
  console.log(`old: ${oldPath}`);
  console.log(`new: ${newPath}`);

  const [oldPdf, newPdf] = await Promise.all([
    loadPdf(oldPath),
    loadPdf(newPath),
  ]);
  let hasDiff = false;
  const summary: string[] = [];

  // ページ数
  console.log("\n## ページ数");
  if (oldPdf.pageCount === newPdf.pageCount) {
    console.log(`差分なし（${oldPdf.pageCount} ページ）`);
  } else {
    hasDiff = true;
    console.log(`${oldPdf.pageCount} -> ${newPdf.pageCount} ページ`);
    summary.push(`ページ数: ${oldPdf.pageCount} -> ${newPdf.pageCount}`);
  }

  // アウトライン
  console.log("\n## アウトライン");
  const outlineDiff = diffLines(oldPdf.outline, newPdf.outline);
  if (outlineDiff.length === 0) {
    console.log("差分なし");
  } else {
    hasDiff = true;
    console.log(outlineDiff.join("\n"));
    summary.push("アウトライン:", ...outlineDiff);
  }

  // テキスト
  console.log("\n## テキスト");
  const pageCount = Math.max(oldPdf.pageCount, newPdf.pageCount);
  const textDiffs = new Map<number, string[]>();
  for (let i = 0; i < pageCount; i++) {
    const diff = diffLines(oldPdf.pages[i] ?? [], newPdf.pages[i] ?? []);
    if (diff.length > 0) {
      textDiffs.set(i + 1, diff);
      console.log(`### p.${i + 1}`);
      console.log(diff.join("\n"));
    }
  }
  if (textDiffs.size === 0) {
    console.log("差分なし");
  } else {
    hasDiff = true;
  }

  // 見た目
  console.log("\n## 見た目");
  const workDir = mkdtempSync(join(tmpdir(), "diff-pdf-"));
  const outDir = join(
    distDir,
    `diff-${basename(oldPath, ".pdf")}-${basename(newPath, ".pdf")}`,
  );
  const visualDiffs = new Map<number, number>();
  try {
    const oldImages = rasterize(oldPath, join(workDir, "old"));
    const newImages = rasterize(newPath, join(workDir, "new"));
    const common = Math.min(oldImages.length, newImages.length);
    mkdirSync(outDir, { recursive: true });
    for (let i = 0; i < common; i++) {
      const page = String(i + 1).padStart(3, "0");
      const pixels = comparePage(
        oldImages[i],
        newImages[i],
        join(outDir, `p${page}.png`),
      );
      if (pixels > 0) {
        visualDiffs.set(i + 1, pixels);
        console.log(`p.${i + 1}: ${pixels} px`);
      }
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
  if (visualDiffs.size === 0) {
    console.log("差分なし");
  } else {
    hasDiff = true;
    console.log(`差分画像（旧 | 差分 | 新）: ${outDir}`);
  }

  if (visualDiffs.size > 0 || summary.length > 0) {
    const reportPath = join(outDir, "index.html");
    writeFileSync(
      reportPath,
      renderReport({ oldPath, newPath, summary, visualDiffs }),
    );
    console.log(`\nレポート: ${reportPath}`);
  } else {
    rmSync(outDir, { recursive: true, force: true });
  }

  console.log("\n## まとめ");
  console.log(`テキストの差分: ${formatPages(textDiffs.keys())}`);
  console.log(`見た目の差分: ${formatPages(visualDiffs.keys())}`);
  process.exitCode = hasDiff ? 1 : 0;
};

main();
