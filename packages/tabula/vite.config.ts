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
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: ["lib0/decoding", "lib0/encoding", "y-protocols/awareness", "y-protocols/sync", "yaml", "yjs"],
      output: {
        entryFileNames: "[name].js",
      },
    },
    sourcemap: true,
  },
});
