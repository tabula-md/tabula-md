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
            normalizedId.includes("/hast-util-") ||
            normalizedId.includes("/hastscript/") ||
            normalizedId.includes("/html-void-elements/") ||
            normalizedId.includes("/mdast-") ||
            normalizedId.includes("/micromark") ||
            normalizedId.includes("/parse5/") ||
            normalizedId.includes("/property-information/") ||
            normalizedId.includes("/space-separated-tokens/") ||
            normalizedId.includes("/comma-separated-tokens/") ||
            normalizedId.includes("/trim-lines/") ||
            normalizedId.includes("/unified/") ||
            normalizedId.includes("/unist-util-") ||
            normalizedId.includes("/vfile/") ||
            normalizedId.includes("/vfile-message/") ||
            normalizedId.includes("/web-namespaces/") ||
            normalizedId.includes("/yaml/")
          ) {
            return "markdown-vendor";
          }

          if (includesPackage(normalizedId, "highlight.js") || includesPackage(normalizedId, "lowlight")) {
            return "syntax-vendor";
          }

          if (includesPackage(normalizedId, "katex") && !normalizedId.includes("/dist/fonts/")) {
            return "math-vendor";
          }

          if (
            includesPackage(normalizedId, "mermaid") ||
            normalizedId.includes("/node_modules/@mermaid-js/") ||
            includesPackage(normalizedId, "d3") ||
            normalizedId.includes("/node_modules/d3-") ||
            includesPackage(normalizedId, "dagre-d3-es") ||
            includesPackage(normalizedId, "elkjs") ||
            includesPackage(normalizedId, "cytoscape") ||
            includesPackage(normalizedId, "cytoscape-cose-bilkent") ||
            includesPackage(normalizedId, "cytoscape-fcose") ||
            includesPackage(normalizedId, "layout-base") ||
            includesPackage(normalizedId, "roughjs") ||
            includesPackage(normalizedId, "dompurify") ||
            includesPackage(normalizedId, "khroma") ||
            includesPackage(normalizedId, "lodash-es") ||
            includesPackage(normalizedId, "lodash.camelcase") ||
            includesPackage(normalizedId, "marked") ||
            includesPackage(normalizedId, "stylis") ||
            includesPackage(normalizedId, "ts-dedent") ||
            includesPackage(normalizedId, "dayjs")
          ) {
            return;
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

          if (includesPackage(normalizedId, "firebase") || normalizedId.includes("/node_modules/@firebase/")) {
            return "firebase-vendor";
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
