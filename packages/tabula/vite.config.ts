import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const tabulaCoreEntry = fileURLToPath(new URL("./src/index.ts", import.meta.url));

export default defineConfig({
  resolve: {
    // The workbench bundles a preview worker from the app source. Resolve that
    // worker's core import to source while this package's dist output is being
    // created; a clean release runner has no dist/index.js to resolve yet.
    alias: [{ find: "@tabula-md/tabula", replacement: tabulaCoreEntry }],
  },
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
        roomClient: "src/roomClient.ts",
        workbench: "src/workbench/index.ts",
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
