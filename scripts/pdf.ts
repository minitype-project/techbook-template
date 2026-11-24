import { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

type OutlineItem = NonNullable<
  Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>
>[number];

/**
 * アウトライン項目の遷移先のページインデックス（0 始まり）を返す．
 * @param doc pdfjs で読み込んだ PDF．
 * @param item アウトライン項目．
 * @returns 遷移先が存在しない場合は undefined．
 */
export const resolveOutlinePageIndex = async (
  doc: PDFDocumentProxy,
  item: OutlineItem,
): Promise<number | undefined> => {
  const dest =
    typeof item.dest === "string"
      ? await doc.getDestination(item.dest)
      : item.dest;
  if (!dest) {
    return undefined;
  }
  return await doc.getPageIndex(dest[0]);
};

/**
 * 指定したページを抜き出した新しい PDF を返す．
 * @param srcDoc 抜き出し元の PDF．
 * @param pageIndices 抜き出すページのインデックス（0 始まり）．
 */
export const extractPages = async (
  srcDoc: PDFDocument,
  pageIndices: number[],
): Promise<PDFDocument> => {
  const outDoc = await PDFDocument.create();
  const copiedPages = await outDoc.copyPages(srcDoc, pageIndices);
  for (const page of copiedPages) {
    outDoc.addPage(page);
  }
  return outDoc;
};
