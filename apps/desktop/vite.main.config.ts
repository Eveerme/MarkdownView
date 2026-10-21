import path from "node:path";

import { defineConfig } from "vite-plus";

export default defineConfig({
  build: {
    lib: {
      entry: path.join(import.meta.dirname, "src/main/index.ts"),
      fileName: () => "index.js",
      formats: ["es"],
    },
    outDir: "dist/main",
    rolldownOptions: { external: ["electron"] },
    ssr: true,
    target: "node22",
  },
  publicDir: false,
  // The main process ships inside app.asar with no node_modules, so its code must be self-contained.
  ssr: { noExternal: true },
});
