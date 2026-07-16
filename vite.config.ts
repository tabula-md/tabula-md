import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL(".", import.meta.url));
const tabulaAppRoot = fileURLToPath(new URL("./tabula-app", import.meta.url));
const tabulaCoreEntry = fileURLToPath(new URL("./packages/tabula/src/index.ts", import.meta.url));
const tabulaWorkbenchEntry = fileURLToPath(new URL("./packages/tabula/src/workbench/index.ts", import.meta.url));
const tabulaPrivateWorkbenchEntry = fileURLToPath(new URL("./packages/tabula/src/workbench/internal.ts", import.meta.url));

const includesPackage = (id: string, packageName: string) =>
  id.includes(`/node_modules/${packageName}/`);

export default defineConfig({
  root: tabulaAppRoot,
  envDir: workspaceRoot,
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@tabula-md/tabula-private/workbench", replacement: tabulaPrivateWorkbenchEntry },
      { find: "@tabula-md/tabula/workbench", replacement: tabulaWorkbenchEntry },
      { find: "@tabula-md/tabula", replacement: tabulaCoreEntry },
    ],
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

          if (normalizedId.includes("/node_modules/yaml/")) {
            return "markdown-core";
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
            normalizedId.includes("/web-namespaces/")
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
            includesPackage(normalizedId, "@codemirror/view") ||
            includesPackage(normalizedId, "crelt") ||
            includesPackage(normalizedId, "style-mod") ||
            includesPackage(normalizedId, "w3c-keyname")
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
            includesPackage(normalizedId, "y-protocols") ||
            includesPackage(normalizedId, "y-codemirror.next") ||
            includesPackage(normalizedId, "lib0") ||
            includesPackage(normalizedId, "isomorphic.js")
          ) {
            return "collab-vendor";
          }

          if (
            includesPackage(normalizedId, "socket.io-client") ||
            includesPackage(normalizedId, "socket.io-parser") ||
            includesPackage(normalizedId, "engine.io-client") ||
            includesPackage(normalizedId, "engine.io-parser") ||
            normalizedId.includes("/node_modules/@socket.io/")
          ) {
            return "room-transport-vendor";
          }

          if (includesPackage(normalizedId, "firebase") || normalizedId.includes("/node_modules/@firebase/")) {
            return "firebase-vendor";
          }

          if (
            includesPackage(normalizedId, "posthog-js") ||
            normalizedId.includes("/node_modules/@posthog/")
          ) {
            return "posthog-vendor";
          }

          if (
            normalizedId.includes("/react/") ||
            normalizedId.includes("/react-dom/") ||
            normalizedId.includes("/scheduler/") ||
            normalizedId.includes("/node_modules/@radix-ui/") ||
            normalizedId.includes("/node_modules/@floating-ui/") ||
            includesPackage(normalizedId, "react-remove-scroll") ||
            includesPackage(normalizedId, "react-remove-scroll-bar") ||
            includesPackage(normalizedId, "react-style-singleton") ||
            includesPackage(normalizedId, "use-callback-ref") ||
            includesPackage(normalizedId, "use-sidecar") ||
            includesPackage(normalizedId, "aria-hidden") ||
            includesPackage(normalizedId, "detect-node-es") ||
            includesPackage(normalizedId, "get-nonce") ||
            includesPackage(normalizedId, "tslib")
          ) {
            return "react-vendor";
          }

          return "vendor";
        },
      },
    },
  },
});
