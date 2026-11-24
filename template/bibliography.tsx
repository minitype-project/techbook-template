import {
  type InlineOrExtender,
  createBibliography as innerCreateBibliography,
  kern,
  type List,
  noBreak,
  type ReferenceRecord,
  section,
  url,
} from "@minitype/minitype";

// 日本語句読点（．，、。）や開き・閉じカッコも URL の終端として扱う
const URL_REGEX = /https?:\/\/[^\s()（）．，、。]+/g;

// マッチした URL の末尾に付いた ASCII ピリオドを除去する（文末句点が混入するのを防ぐ）
const trimTrailingDots = (s: string): string => s.replace(/\.+$/, "");

// URL を自然な区切り文字（/．-_?=&#）の直後で分割し、改行可能な body 配列にする
const splitUrlBody = (href: string): string[] => {
  const segments: string[] = [];
  let start = 0;
  for (let i = 0; i < href.length; i++) {
    const ch = href[i];
    if (
      (ch === "/" ||
        ch === "." ||
        ch === "-" ||
        ch === "_" ||
        ch === "?" ||
        ch === "=" ||
        ch === "&" ||
        ch === "#") &&
      i + 1 < href.length
    ) {
      segments.push(href.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < href.length) {
    segments.push(href.slice(start));
  }
  return segments.length > 1 ? segments : [href];
};

const linkifyUrls = (lines: InlineOrExtender[][]): InlineOrExtender[][] => {
  return lines.map((line) =>
    line.flatMap<InlineOrExtender>((seg) => {
      if (typeof seg !== "string") return [seg];
      const out: InlineOrExtender[] = [];
      let last = 0;
      for (const m of seg.matchAll(URL_REGEX)) {
        const i = m.index ?? 0;
        const matchedUrl = trimTrailingDots(m[0]);
        if (i > last) {
          out.push(seg.slice(last, i));
        }
        out.push(url(matchedUrl, splitUrlBody(matchedUrl)));
        last = i + matchedUrl.length;
      }
      if (last < seg.length) out.push(seg.slice(last));
      return out.length > 0 ? out : [seg];
    }),
  );
};

/**
 * {@link ReferenceRecord} を受け取り，`Cite` と `Bibliography` を返すファクトリ．
 * 参考文献リストに含まれる生 URL は PDF 上でハイパーリンクとして機能するように後処理する．
 */
export const createBibliography = (references: ReferenceRecord) => {
  const bib = innerCreateBibliography(references);

  const Cite = ({
    keys,
    tie,
  }: {
    keys: string | string[];
    /** true のとき直前に非改行スペース（kern + noBreak）を挿入する．欧文中で `LaTeX<Cite tie keys="…" />` と書く用途． */
    tie?: boolean;
  }) => {
    const cite = bib.cite(...(Array.isArray(keys) ? keys : [keys]));
    if (tie) {
      return [noBreak(), kern(0.33), noBreak(), cite];
    }
    return [noBreak(), cite];
  };

  const Bibliography = () => {
    const lists = bib.bibliography();
    const linked: List[] = lists.map((l) => ({
      ...l,
      lines: linkifyUrls(l.lines),
    }));
    return section(linked, { li1: { align: "left" } });
  };

  return { Cite, Bibliography };
};
