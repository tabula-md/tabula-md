import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL(".", import.meta.url));
const tabulaAppRoot = fileURLToPath(new URL("./tabula-app", import.meta.url));
const tabulaCoreEntry = fileURLToPath(new URL("./packages/tabula/src/index.ts", import.meta.url));

const includesPackage = (id: string, packageName: string) =>
  id.includes(`/node_modules/${packageName}/`);

export default defineConfig({
  root: tabulaAppRoot,
  envDir: workspaceRoot,
  plugins: [react()],
  resolve: {
    alias: {
      "@tabula-md/tabula": tabulaCoreEntry,
    },
  },
  server: {
    port: 5173,
  },
  test: {
    root: workspaceRoot,
    include: [
      "tabula-app/src/**/*.{test,spec}.?(c|m)[jt]s?(x)",
      "packages/tabula/src/**/*.{test,spec}.?(c|m)[jt]s?(x)",
    ],
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");
          if (!normalizedId.includes("node_modules")) {
            return;
          }

          if (
            normalizedId.includes("/react-markdown/") ||
            normalizedId.includes("/remark-") ||
            normalizedId.includes("/rehype-") ||
            normalizedId.includes("/mdast-") ||
            normalizedId.includes("/micromark") ||
            normalizedId.includes("/unified/") ||
            normalizedId.includes("/yaml/")
          ) {
            return "markdown-vendor";
          }

          if (
            includesPackage(normalizedId, "@codemirror/state") ||
            includesPackage(normalizedId, "@codemirror/view")
          ) {
            return "codemirror-core";
          }

          if (
            includesPackage(normalizedId, "@codemirror/commands") ||
            includesPackage(normalizedId, "@codemirror/search") ||
            includesPackage(normalizedId, "@codemirror/autocomplete") ||
            includesPackage(normalizedId, "@codemirror/lint") ||
            includesPackage(normalizedId, "@codemirror/lang-markdown") ||
            includesPackage(normalizedId, "@codemirror/lang-css") ||
            includesPackage(normalizedId, "@codemirror/lang-html") ||
            includesPackage(normalizedId, "@codemirror/lang-javascript") ||
            includesPackage(normalizedId, "@codemirror/language")
          ) {
            return "codemirror-extensions";
          }

          if (normalizedId.includes("/node_modules/@lezer/")) {
            return "lezer-vendor";
          }

          if (
            includesPackage(normalizedId, "yjs") ||
            includesPackage(normalizedId, "lib0") ||
            includesPackage(normalizedId, "socket.io-client") ||
            includesPackage(normalizedId, "socket.io-parser") ||
            includesPackage(normalizedId, "engine.io-client") ||
            includesPackage(normalizedId, "engine.io-parser")
          ) {
            return "collab-vendor";
          }

          if (
            normalizedId.includes("/react/") ||
            normalizedId.includes("/react-dom/") ||
            normalizedId.includes("/scheduler/")
          ) {
            return "react-vendor";
          }

          return "vendor";
        },
      },
    },
  },
});
