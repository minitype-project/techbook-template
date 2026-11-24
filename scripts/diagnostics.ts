import type { Diagnostic } from "@minitype/minitype";

type Document = { getDiagnostics: () => Promise<Diagnostic[]> };

/**
 * 組版結果に豆腐（グリフの存在しない文字）が含まれる場合，例外を投げる．
 * dev サーバではプレビューにエラーとして表示される．
 * @param doc minitype の組版結果．
 */
export const assertNoMissingGlyphs = async (doc: Document) => {
  const missingGlyphs = (await doc.getDiagnostics()).filter(
    (diagnostic) => diagnostic.type === "missing-glyph",
  );
  if (missingGlyphs.length === 0) {
    return;
  }
  const messages = missingGlyphs.map(
    (diagnostic) => `[missing-glyph] ${diagnostic.message}`,
  );
  throw new Error(
    `Build failed: ${missingGlyphs.length} missing glyph(s) found.\n${messages.join("\n")}`,
  );
};
