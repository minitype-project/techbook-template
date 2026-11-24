import type { Diagnostic } from "@minitype/minitype";

type Document = { getDiagnostics: () => Promise<Diagnostic[]> };

/**
 * 組版結果に豆腐（グリフの存在しない文字）が含まれる場合，エラーを表示してビルドを終了する．
 * @param doc minitype の組版結果．
 */
export const assertNoMissingGlyphs = async (doc: Document) => {
  const missingGlyphs = (await doc.getDiagnostics()).filter(
    (diagnostic) => diagnostic.type === "missing-glyph",
  );
  if (missingGlyphs.length === 0) {
    return;
  }
  for (const diagnostic of missingGlyphs) {
    console.error(`[missing-glyph] ${diagnostic.message}`);
  }
  console.error(
    `\nBuild failed: ${missingGlyphs.length} missing glyph(s) found.`,
  );
  process.exit(1);
};
