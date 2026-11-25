import type { ReferenceRecord } from "@minitype/minitype";
import { createBibliography } from "../../template/bibliography.js";

const references: ReferenceRecord = {
  lamport1994: {
    type: "book",
    authors: ["Leslie Lamport"],
    title: "LaTeX: A Document Preparation System",
    year: 1994,
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
