import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL(".", import.meta.url));
const webRoot = fileURLToPath(new URL("./apps/web", import.meta.url));
const collabProtocol = fileURLToPath(new URL("./packages/collab-protocol/index.mjs", import.meta.url));

export default defineConfig({
  root: webRoot,
  envDir: workspaceRoot,
  plugins: [react()],
  resolve: {
    alias: {
      "@tabula-md/collab-protocol": collabProtocol,
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
});
