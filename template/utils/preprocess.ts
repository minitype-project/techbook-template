/**
 * キャプション文字列を本文・ラベル・配置に分解する．
 * - `#label` を含む場合，最後の `#` 以降をラベルとする（空の場合はラベルなし）．
 * - `@t` / `@b` を含む場合，float の配置（top / bottom）とする．`#label@t`，`@t#label` の両方に対応する．
 *   直後に英数字や `.` が続く場合（例：`foo@bar.com`）は配置指定とみなさない．
 *
 * @example
 * `表タイトル#tab:foo@t` → `{ caption: "表タイトル", label: "tab:foo", position: "top" }`
 */
export const parseCaption = (
  text: string,
): { caption: string; label?: string; position?: "top" | "bottom" } => {
  const positionRegex = /@([tb])(?![\w.])/;
  const flag = text.match(positionRegex)?.[1];
  const position = flag ? (flag === "t" ? "top" : "bottom") : undefined;
  const rest = text.replace(positionRegex, "");
  const hashIdx = rest.lastIndexOf("#");
  if (hashIdx < 0) {
    return { caption: rest.trim(), position };
  }
  return {
    caption: rest.slice(0, hashIdx).trim(),
    label: rest.slice(hashIdx + 1) || undefined,
    position,
  };
};

/**
 * テキストに {@link transform} を適用して結合する．
 * 以下は変換対象外とする：
 * - YAML フロントマター
 * - フェンス付きコードブロック（```...```）．開始と同じ長さ以上のバッククォート列で閉じる．
 * - MDX ESM ブロック：行頭の `import` / `export` から始まり，空行までを 1 ブロックとみなす．
 * - 参照リンク定義（`[ref]: url "title"`）．ただし脚注定義（`[^1]: ...`）は変換対象とする．
 */
const transformOutsideCode = (
  source: string,
  transform: (text: string) => string,
): string => {
  const frontmatter = source.match(/^---\n[\s\S]*?\n---\n?/)?.[0] ?? "";
  const body = source.slice(frontmatter.length);

  const skipRegex =
    /^[ \t]*(`{3,})[^\n]*\n[\s\S]*?^[ \t]*\1`*[ \t]*$|^(?:import|export)\b[^\n]*(?:\n(?!\n)[^\n]*)*|^[ \t]*\[(?!\^)[^\]\n]+\]:[^\n]*/gm;
  let result = "";
  let lastIndex = 0;
  for (const match of body.matchAll(skipRegex)) {
    result += transform(body.slice(lastIndex, match.index)) + match[0];
    lastIndex = match.index + match[0].length;
  }
  result += transform(body.slice(lastIndex));

  return frontmatter + result;
};

// 各変換で保護する（変換対象外とする）構文の正規表現．
// インラインコードは CommonMark に従い，開始と同じ長さのバッククォート列で閉じる区間とする．
const INLINE_CODE = /(?<!`)(?<ticks>`+)(?!`)[^\n]*?(?<!`)\k<ticks>(?!`)/.source;
const TAG = /<[^>]+>/.source;
const LINK = /\[[^\]\n]*\]\([^)\n]*\)/.source;
const LINK_DESTINATION = /\]\([^)\n]*\)/.source;
// 生の URL の終端とみなす文字：空白，`<`，`>`，閉じ括弧類，句読点，属性値のクォート，CJK 文字．
const URL_TERMINATORS = `\\s<>)）．，、。」』"぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿`;

// 保護した部分を一時的に退避する際のプレースホルダ区切り．
// 通常の Markdown 本文には現れない NUL 文字を用いる．
const SENTINEL = "\u0000";
const PLACEHOLDER_REGEX = new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, "g");

/**
 * {@link patterns} のいずれかに一致する部分をプレースホルダに退避した状態で {@link transform} を適用し，元に戻す．
 * 退避した部分をまたぐ置換（例：括弧の内側にタグを含む場合）にも対応できる．
 */
const transformUnprotected = (
  text: string,
  patterns: string[],
  transform: (text: string) => string,
): string => {
  const preserved: string[] = [];
  const replaced = text.replace(
    new RegExp(patterns.join("|"), "g"),
    (match) => {
      preserved.push(match);
      return `${SENTINEL}${preserved.length - 1}${SENTINEL}`;
    },
  );
  return transform(replaced).replace(
    PLACEHOLDER_REGEX,
    (_, i) => preserved[Number(i)],
  );
};

const escapeTemplateLiteral = (text: string): string => {
  return text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
};

const transformCaption = (text: string): string =>
  text.replace(
    /^[ \t]*\*([^*\n]+)\*[ \t]*\n((?:[ \t]*\|[^\n]*\n?)+)/gm,
    (_, rawCaption: string, table: string) => {
      const { caption, label, position } = parseCaption(rawCaption);
      const labelAttr = label
        ? ` label={\`${escapeTemplateLiteral(label)}\`}`
        : "";
      const floatAttr = position ? ` float={"${position}"}` : "";
      return `<FigureTable caption={\`${escapeTemplateLiteral(caption)}\`}${labelAttr}${floatAttr}>\n\n${table}\n</FigureTable>\n`;
    },
  );

const URL_REGEX = new RegExp(
  `(?<![<=["'])(?<!\\]\\()https?://[^${URL_TERMINATORS}']+`,
  "g",
);

const transformAutoUrls = (text: string): string =>
  transformUnprotected(text, [INLINE_CODE], (t) =>
    t.replace(URL_REGEX, (url) => `[${url}](${url})`),
  );

const transformQuotes = (text: string): string =>
  transformUnprotected(text, [INLINE_CODE, TAG, LINK], (t) =>
    // `=` 直後の `"..."` は，タグとして保護しきれなかった属性値（例：`x="y"`）とみなして変換しない．
    t.replace(
      /(^|[^=])"([^"\n]*)"/g,
      (_, prefix, inner) => `${prefix}“${inner}”`,
    ),
  );

const transformApostrophes = (text: string): string =>
  transformUnprotected(
    text,
    // 生の URL では `'` を URL の一部として扱う．
    [INLINE_CODE, TAG, LINK_DESTINATION, `https?://[^${URL_TERMINATORS}]+`],
    (t) => t.replace(/([A-Za-z0-9_])'([A-Za-z0-9_])/g, "$1’$2"),
  );

const transformParentheses = (text: string): string =>
  transformUnprotected(text, [INLINE_CODE, TAG, LINK], (t) =>
    t.replace(/ ?\(([^()\n]*)\) ?/g, (match, inner: string, offset: number) => {
      // 先頭の半角スペースを吸い取っている場合は，その分だけ進めた位置を `(` とする．
      const openIdx = offset + (match.startsWith(" ") ? 1 : 0);
      const prev = t[openIdx - 1] ?? "";
      // 関数呼び出しとみなせる場合は変換しない．
      if (/[A-Za-z0-9_]/.test(prev) && !/[　-鿿豈-﫿＀-￯]/.test(inner)) {
        return match;
      }
      return `（${inner}）`;
    }),
  );

/**
 * `*caption*\n| table |` パターンを FigureTable コンポーネントに変換する．
 * caption は {@link parseCaption} で解釈し，ラベル・配置を属性として付与する．
 */
export const preprocessCaption = (source: string): string =>
  transformOutsideCode(source, transformCaption);

/**
 * 生の URL を `[URL](URL)` 形式の Markdown リンクに変換する．
 * remark-gfm の autolink は空白までを URL として取り込むため，直後に和文やインラインコードが続くと，
 * それらも URL の一部として解釈されてしまう．@minitype/tsx は URL の終端を和文の手前に補正するが，
 * URL に取り込まれた後続のインラインコードは，コードではなく文字列として戻される．
 * これを防ぐため，URL を `[URL](URL)` で明示的に囲う．
 * MDX では `<URL>` 形式の autolink は JSX タグとして解釈されるため，使用しない．
 *
 * {@link transformOutsideCode} の対象外に加えて，以下は変換しない．
 * - インラインコード内
 * - 直前が `<`，`[` の場合（既存の autolink / 参照リンク）
 * - 直前が `](` の場合（既存の Markdown リンク）
 * - 直前が `=`，`"`，`'` の場合（JSX / HTML 属性値）
 */
export const preprocessAutoUrls = (source: string): string =>
  transformOutsideCode(source, transformAutoUrls);

/**
 * 対になったストレートクォート（"..."）をスマートクォート（“...”）に置換する．
 * 対にならない孤立した `"` はそのまま残す．
 *
 * {@link transformOutsideCode} の対象外に加えて，以下は変換しない．
 * - インラインコード内
 * - JSX / HTML タグ，autolink（`<...>`）
 * - Markdown リンク（`[text](url)`）
 * - `=` 直後の属性値
 */
export const preprocessQuotes = (source: string): string =>
  transformOutsideCode(source, transformQuotes);

/**
 * 英単語内のストレートアポストロフィ（U+0027）を右シングルクォート（U+2019）に変換する．
 * 「英単語内」とは，前後が ASCII 英字・数字・アンダースコアである場合を指す．
 *
 * {@link transformOutsideCode} の対象外に加えて，以下は変換しない．
 * - インラインコード内
 * - JSX / HTML タグ，autolink（`<...>`）
 * - Markdown リンクの URL 部分（`[text](url)` の `(url)`．リンクテキストは変換する）
 * - 生の URL
 */
export const preprocessApostrophes = (source: string): string =>
  transformOutsideCode(source, transformApostrophes);

/**
 * 半角丸括弧を全角丸括弧に統一する．
 * 置換時には，`(` の直前・`)` の直後にある半角スペースを 1 文字取り除く．
 *
 * @example
 * `foo (bar) baz` → `foo（bar）baz`
 * `ICAO(国際民間航空機関)` → `ICAO（国際民間航空機関）`
 * `しています(<Autoref />)` → `しています（<Autoref />）`
 * `foo(bar)` → `foo(bar)`（変換しない）
 *
 * {@link transformOutsideCode} の対象外に加えて，以下は変換しない．
 * - インラインコード内
 * - JSX / HTML タグ，autolink（`<...>`）の内部
 * - Markdown リンク（`[text](url)`）
 * - `(` 直前が英数字・アンダースコア，かつ括弧内に CJK 文字・全角文字を含まない場合（`foo()` のような関数呼び出しを想定）
 */
export const preprocessParentheses = (source: string): string =>
  transformOutsideCode(source, transformParentheses);

/**
 * MDX の評価前に，すべての前処理を順に適用する．
 * 変換対象外の範囲の切り出しは 1 回で済ませる．
 */
export const preprocess = (source: string): string =>
  transformOutsideCode(source, (text) =>
    [
      transformCaption,
      transformAutoUrls,
      transformParentheses,
      transformQuotes,
      transformApostrophes,
    ].reduce((t, transform) => transform(t), text),
  );
