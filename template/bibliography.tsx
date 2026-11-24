import {
  createBibliography as innerCreateBibliography,
  type ReferenceRecord,
  section,
} from "@minitype/minitype";

/**
 * {@link ReferenceRecord} を受け取り，`Cite` と `Bibliography` を返すファクトリ．
 */
export const createBibliography = (references: ReferenceRecord) => {
  const bib = innerCreateBibliography(references);

  const Cite = ({ keys }: { keys: string | string[] }) =>
    bib.cite(...(Array.isArray(keys) ? keys : [keys]));

  const Bibliography = () =>
    section(bib.bibliography(), {
      ol1: { indent: 0, firstIndent: 0 },
    });

  return { Cite, Bibliography };
};
