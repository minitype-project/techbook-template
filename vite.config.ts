import minitype from "@minitype/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    minitype({
      entry: "scripts/build-article.ts",
      watchExtensions: ["mdx", "ts", "tsx"],
    }),
  ],
});
