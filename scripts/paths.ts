export const articlesDir = new URL("../articles/", import.meta.url).pathname;
export const distDir = new URL("../dist/", import.meta.url).pathname;

/**
 * 記事の MDX ファイルのパスを返す．
 * @param name 記事のディレクトリ名．
 */
export const articlePath = (name: string): string => {
  return `${articlesDir}${name}/index.mdx`;
};
