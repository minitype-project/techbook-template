import type { ReferenceRecord } from "@minitype/minitype";
import { createBibliography } from "../../template/bibliography.js";

const references: ReferenceRecord = {
  knuth1986: {
    type: "book",
    authors: ["Donald E. Knuth"],
    title: "The TeXbook",
    year: 1986,
    publisher: "Addison-Wesley",
    address: "Reading, Massachusetts",
  },
  minitype2026: {
    type: "webpage",
    authors: ["いなにわうどん"],
    title:
      "TypeScript ライブラリとして動作する組版エンジン minitype を公開しました",
    year: 2026,
    url: "https://zenn.dev/inaniwaudon/articles/62f1def4bad627",
  },
};

export const { Cite, Bibliography } = createBibliography(references);
