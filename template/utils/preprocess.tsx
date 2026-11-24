/**
 * @t または @b を取得する．
 * #label@t，@t#label 両方のパターンに対応する．
 */
export const extractPosition = (
  s: string,
): { rest: string; position?: "top" | "bottom" } => {
  const m = s.match(/@(t|b)/);
  if (!m || m.index === undefined) {
    return { rest: s };
  }
  const i = m.index;
  return {
    rest: s.slice(0, i) + s.slice(i + 2),
    position: m[1] === "t" ? "top" : "bottom",
  };
};

/**
 * テキストに {@link transform} を適用して結合する．
 * 以下は変換対象外とする：
 * - フェンス付きコードブロック（```...```）．開始と同じ長さ以上のバッククォート列で閉じる．
 * - MDX ESM ブロック：行頭の `import` / `export` から始まり，空行までを 1 ブロックとみなす．
 * - 参照リンク定義（`[ref]: url "title"`）．ただし脚注定義（`[^1]: ...`）は変換対象とする．
 * - YAML フロントマター
 */
const transformOutsideCode = (
  source: string,
  transform: (text: string) => string,
): string => {
  const fmMatch = source.match(/^---\n[\s\S]*?\n---\n?/);
  const fmPart = fmMatch ? fmMatch[0] : "";
  const body = fmMatch ? source.slice(fmPart.length) : source;

  const skipRegex =
    /^[ \t]*(`{3,})[^\n]*\n[\s\S]*?^[ \t]*\1`*[ \t]*$|^(?:import|export)\b[^\n]*(?:\n(?!\n)[^\n]*)*|^[ \t]*\[(?!\^)[^\]\n]+\]:[^\n]*/gm;
  let result = "";
  let lastIndex = 0;
  for (const m of body.matchAll(skipRegex)) {
    const start = m.index ?? 0;
    result += transform(body.slice(lastIndex, start));
    result += m[0];
    lastIndex = start + m[0].length;
  }
  result += transform(body.slice(lastIndex));

  return fmPart + result;
};

const escapeJsxString = (s: string): string => {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
};

/**
 * *caption*\n| table | パターンを FigureTable コンポーネントに変換する．
 * caption に "#label" を含む場合（例：*表タイトル#tab:foo*），label 属性も付与する．
 */
export const preprocessCaption = (source: string): string => {
  const transform = (text: string): string =>
    text.replace(
      /^[ \t]*\*([^*\n]+)\*[ \t]*\n((?:[ \t]*\|[^\n]*\n?)+)/gm,
      (_, rawCaption, table) => {
        const trimmed = rawCaption.trim();
        const { rest: trimmedRest, position } = extractPosition(trimmed);
        const hashIdx = trimmedRest.lastIndexOf("#");
        const caption =
          hashIdx >= 0 ? trimmedRest.slice(0, hashIdx) : trimmedRest;
        const label =
          hashIdx >= 0
            ? trimmedRest.slice(hashIdx + 1) || undefined
            : undefined;
        const labelAttr = label ? ` label={\`${escapeJsxString(label)}\`}` : "";
        const floatAttr = position ? ` float={"${position}"}` : "";
        return `<FigureTable caption={\`${escapeJsxString(caption)}\`}${labelAttr}${floatAttr}>\n\n${table}\n</FigureTable>\n`;
      },
    );

  return transformOutsideCode(source, transform);
};

// インラインコード等を一時的に退避する際のプレースホルダ区切り．
// 通常の Markdown 本文には現れない NUL 文字を用いる．
const SENTINEL = "\u0000";
const PLACEHOLDER_REGEX = new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, "g");

/**
 * 生の URL を `[URL](URL)` 形式の Markdown リンクに変換する．
 * remark-gfm の autolink は空白までを URL として取り込むため，直後に和文やインラインコードが続くと，
 * それらも URL の一部として解釈されてしまう．@minitype/tsx は URL の終端を和文の手前に補正するが，
 * URL に取り込まれた後続のインラインコードは，コードではなく文字列として戻される．
 * これを防ぐため，以下の規則に従って URL を `[URL](URL)` で明示的に囲う．
 * この際，MDX では `<URL>` 形式の autolink は JSX タグとして解釈されるため，使用しない．
 *
 * 変換対象外
 * - YAML フロントマター
 * - フェンス付きコードブロック（```）内
 * - インラインコード（`...`）内
 * - 参照リンク定義（`[ref]: url`）の行全体
 * - 直前が `<`，`[` の場合（既存の autolink / 参照リンク）
 * - 直前が `](` の場合（既存の Markdown リンク）
 * - 直前が `=`，`"`，`'` の場合（JSX / HTML 属性値）
 *
 * URL の終端として扱う文字
 * - 空白
 * - `<`，`>`
 * - 半角/全角閉じ括弧類
 * - CJK 文字（ひらがな，カタカナ，漢字，約物）
 * - 属性値のクォート．
 */

export const preprocessAutoUrls = (source: string): string => {
  const URL_REGEX =
    /(?<![<=[["'])(?<!\]\()https?:\/\/[^\s<>)）．，、。」』"'぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿]+/g;

  const transform = (text: string): string => {
    // CommonMark に従い，開始と同じ長さの backtick 列で閉じる区間を 1 つの
    // コードスパンとみなす．内部に異なる長さの backtick を含むケースにも
    // 対応するため，プレースホルダに退避してから URL 変換を行う．
    const spans: string[] = [];
    const protectedText = text.replace(/(`+)[^\n]*?\1/g, (match) => {
      spans.push(match);
      return `${SENTINEL}${spans.length - 1}${SENTINEL}`;
    });
    const transformed = protectedText.replace(URL_REGEX, (m) => `[${m}](${m})`);
    return transformed.replace(PLACEHOLDER_REGEX, (_, i) => spans[Number(i)]);
  };

  return transformOutsideCode(source, transform);
};

/**
 * 対になったストレートクォート（"..."）をスマートクォート（“...”）に置換する．
 * 対にならない孤立した `"` はそのまま残す．
 *
 * 変換対象外
 * - YAML フロントマター
 * - フェンス付きコードブロック（```）内
 * - インラインコード（`...`）内
 * - JSX / HTML タグ，autolink（`<...>`）
 * - Markdown リンクの URL 部分（`[text](url)`）
 * - 参照リンク定義（`[ref]: url`）の行全体
 */
export const preprocessQuotes = (source: string): string => {
  const transform = (text: string): string => {
    const segments = text.split(
      /(`+[^`\n]*`+|<[^>]+>|\[[^\]\n]*\]\([^)\n]*\))/g,
    );
    return segments
      .map((seg, i) => {
        if (i % 2 === 1) {
          return seg;
        }
        // `=` 直後の `"..."` は JSX / HTML の属性値とみなして変換対象外．
        return seg.replace(
          /(^|[^=])"([^"\n]*)"/g,
          (_, prefix, inner) => `${prefix}“${inner}”`,
        );
      })
      .join("");
  };

  return transformOutsideCode(source, transform);
};

/**
 * 英単語内のストレートアポストロフィ（U+0027）を右シングルクォート（U+2019）に変換する．
 * 「英単語内」とは，前後が ASCII 英字・数字・アンダースコアである場合を指す．
 *
 * 変換対象外
 * - YAML フロントマター
 * - フェンス付きコードブロック（```）内
 * - インラインコード（`...`）内
 * - JSX / HTML タグ，autolink（`<...>`）
 * - Markdown リンクの URL 部分（`[text](url)` の `(url)`．リンクテキストは変換する）
 * - 参照リンク定義（`[ref]: url`）
 * - 生の URL
 */
export const preprocessApostrophes = (source: string): string => {
  const transform = (text: string): string => {
    // 生の URL の終端は preprocessAutoUrls に揃えるが，`'` は URL の一部として扱う．
    const segments = text.split(
      /(`+[^`\n]*`+|<[^>]+>|\]\([^)\n]*\)|https?:\/\/[^\s<>)）．，、。」』"぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿]+)/g,
    );
    return segments
      .map((seg, i) => {
        if (i % 2 === 1) {
          return seg;
        }
        return seg.replace(/([A-Za-z0-9_])'([A-Za-z0-9_])/g, "$1’$2");
      })
      .join("");
  };

  return transformOutsideCode(source, transform);
};

/**
 * 半角丸括弧を全角丸括弧に統一する．
 *
 * - 置換時には，`(` の直前・`)` の直後にある半角スペースを 1 文字取り除く
 * - 括弧内に JSX/HTML タグが挟まる場合にも対応する．
 *   - 例：`しています(<Autoref />)` → `しています（<Autoref />）`
 *
 * @example
 * `foo (bar) baz` → `foo（bar）baz`
 * `ICAO(国際民間航空機関)` → `ICAO（国際民間航空機関）`
 * `foo(bar)` → `foo(bar)`（変換しない）
 *
 * 変換対象外
 * - YAML フロントマター
 * - フェンス付きコードブロック（```）内
 * - インラインコード（`...`）内
 * - autolink / HTML / JSX タグ（`<...>`）の内部
 * - Markdown リンクの URL 部分（`[text](url)`）
 * - 参照リンク定義（`[ref]: url`）の行全体
 * - `(` 直前が英数字・アンダースコア，かつ括弧内に CJK 文字を含まない場合（`foo()` のような関数呼び出しを想定）
 */
export const preprocessParentheses = (source: string): string => {
  const PRESERVE_RE = /(`+[^`\n]*`+|<[^>]+>|\[[^\]\n]*\]\([^)\n]*\))/g;
  const transform = (text: string): string => {
    // インラインコード，JSX/HTML タグ，autolink，Markdown リンクをプレースホルダーに
    // 置換してから変換することで，括弧がタグをまたぐ場合にも対応する．
    const preserved: string[] = [];
    const withPlaceholders = text.replace(PRESERVE_RE, (match) => {
      preserved.push(match);
      return `${SENTINEL}${preserved.length - 1}${SENTINEL}`;
    });

    const transformed = withPlaceholders.replace(
      / ?\(([^()\n]*)\) ?/g,
      (match, inner, offset: number) => {
        // `(` の直前の文字を関数呼び出し判定に用いる．
        // 先頭の半角スペースを吸い取っているため，その分だけオフセットを進めて見る．
        const openIdx = offset + (match.startsWith(" ") ? 1 : 0);
        const prev = openIdx > 0 ? (withPlaceholders[openIdx - 1] ?? "") : "";
        // 括弧内に CJK 文字が含まれる場合は関数呼び出しではないと判断して変換する
        if (/[A-Za-z0-9_]/.test(prev) && !/[　-鿿豈-﫿＀-￯]/.test(inner)) {
          return match;
        }
        return `（${inner}）`;
      },
    );

    return transformed.replace(
      PLACEHOLDER_REGEX,
      (_, i) => preserved[Number(i)],
    );
  };

  return transformOutsideCode(source, transform);
};
