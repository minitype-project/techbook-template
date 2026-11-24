import { fileURLToPath } from "node:url";

export const articlesDir = fileURLToPath(
  new URL("../articles/", import.meta.url),
);
export const distDir = fileURLToPath(new URL("../dist/", import.meta.url));

/**
 * 記事の MDX ファイルのパスを返す．
 * @param name 記事のディレクトリ名．
 */
export const articlePath = (name: string): string => {
  return `${articlesDir}${name}/index.mdx`;
};
