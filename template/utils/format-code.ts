import path from "node:path";
import { fileURLToPath } from "node:url";
import { Biome, Distribution } from "@biomejs/js-api";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const biome = await Biome.create({ distribution: Distribution.NODE });
const { projectKey } = biome.openProject(projectRoot);
biome.applyConfiguration(projectKey, {
  formatter: { lineWidth: 56, indentStyle: "space" },
});

const LANG_TO_EXT: Record<string, string> = {
  js: "js",
  javascript: "js",
  mjs: "mjs",
  cjs: "cjs",
  ts: "ts",
  typescript: "ts",
  mts: "mts",
  cts: "cts",
  jsx: "jsx",
  tsx: "tsx",
  json: "json",
  jsonc: "jsonc",
  css: "css",
  graphql: "graphql",
  gql: "graphql",
};

const hasParseError = (diagnostics: { category: string }[]) =>
  diagnostics.some((d) => d.category === "parse");

// パースエラー時に <> </> でラップして再フォーマットし，ラッパーを剥がす．
// Biome は JSX フラグメント内の空行を削除するため，空行をマーカーコメントで保持する．
const BLANK_MARKER = "{/* __blank__ */}";
const formatAsFragment = (code: string): string => {
  const markedCode = code.replace(/\n\n+/g, `\n${BLANK_MARKER}\n`);
  const result = biome.formatContent(projectKey, `<>\n${markedCode}\n</>`, {
    filePath: "file.tsx",
  });
  if (hasParseError(result.diagnostics)) {
    return code;
  }
  const lines = result.content.trimEnd().split("\n");
  if (lines[0] !== "<>" || !lines[lines.length - 1].startsWith("</>")) {
    return code;
  }
  return lines
    .slice(1, -1)
    .map((l) => l.replace(/^ {2}/, ""))
    .join("\n")
    .replace(/\n*\s*\{\/\* __blank__ \*\/\}\s*\n*/g, "\n\n");
};

/**
 * Biome を用いてコードをフォーマットする．
 */
export const formatCode = (code: string, lang: string): string => {
  const ext = LANG_TO_EXT[lang.toLowerCase()];
  if (!ext) {
    return code;
  }
  try {
    const result = biome.formatContent(projectKey, code, {
      filePath: `file.${ext}`,
    });
    if (hasParseError(result.diagnostics)) {
      if (ext === "tsx" || ext === "jsx") return formatAsFragment(code);
      return code;
    }
    return result.content.trimEnd();
  } catch {
    return code;
  }
};
