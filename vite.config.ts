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
  },
});
