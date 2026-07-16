import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: {
        index: "src/index.ts",
        collaboration: "src/collaboration.ts",
        "data/encryption": "src/data/encryption.ts",
        "data/encode": "src/data/encode.ts",
        "data/json": "src/data/json.ts",
        "data/restore": "src/data/restore.ts",
        "room/envelope": "src/room/envelope.ts",
        workbench: "src/workbench/index.ts",
        "workbench/internal": "src/workbench/internal.ts",
      },
      formats: ["es"],
      cssFileName: "workbench",
    },
    rollupOptions: {
      external: [
        "@tabula-md/tabula",
        "lib0/decoding",
        "lib0/encoding",
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-dev-runtime",
        "react/jsx-runtime",
        "y-protocols/awareness",
        "y-protocols/sync",
        "yaml",
        "yjs",
      ],
      output: {
        entryFileNames: "[name].js",
      },
    },
    sourcemap: true,
  },
});
