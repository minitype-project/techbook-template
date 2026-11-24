import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const article = process.argv[2];
if (!article) {
  console.error("Usage: npm run dev <article>");
  process.exit(1);
}

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const viteEntry = path.join(rootDir, "node_modules/vite/bin/vite.js");

// MDX ランタイムは `await import("./x.js")` を Node 本体の ESM loader に流すため，
// 記事ディレクトリの TSX ファイルを import するには Vite プロセスにも tsx の loader を注入する必要がある．
// TSX_TSCONFIG_PATH で tsconfig を固定し，JSX ランタイム設定が意図せずズレることを防ぐ．
const child = spawn(process.execPath, ["--import", "tsx", viteEntry], {
  stdio: "inherit",
  env: {
    ...process.env,
    ARTICLE: article,
    TSX_TSCONFIG_PATH: path.join(rootDir, "tsconfig.json"),
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
