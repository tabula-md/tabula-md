import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL(".", import.meta.url));
const webRoot = fileURLToPath(new URL("./apps/web", import.meta.url));

export default defineConfig({
  root: webRoot,
  envDir: workspaceRoot,
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: "../../dist",
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

          if (normalizedId.includes("/@codemirror/") || normalizedId.includes("/@lezer/")) {
            return "editor-vendor";
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
