import { articleDisplayNumber, articleOrder } from "../template/config.js";
import { buildArticle, loadArticle } from "../template/index.js";
import { prefaceBodyFont } from "../template/styles/fonts.js";
import { assertNoMissingGlyphs } from "./diagnostics.js";

const name = process.env.ARTICLE;
if (!name) {
  throw new Error("ARTICLE environment variable is not set");
}

const articlesDir = new URL("../articles/", import.meta.url).pathname;
const mdxPath = `${articlesDir}${name}/index.mdx`;
const outputPath = new URL(`../dist/${name}.pdf`, import.meta.url).pathname;

let article = {
  ...(await loadArticle(mdxPath)),
  displayNum: articleDisplayNumber(name),
};
const section = articleOrder.find((entry) => entry.articles.includes(name));
const isPreface = section?.type === "preface" || section?.type === "postface";
if (isPreface) {
  article = { ...article, bodyFont: prefaceBodyFont, numbered: false };
}
const doc = buildArticle(article);
await assertNoMissingGlyphs(doc);
await doc.save(outputPath);
