/// <reference types="vite/client" />

declare module "katex/dist/katex.min.js" {
  import katex from "katex";

  export default katex;
}

declare module "mermaid/dist/mermaid.core.mjs" {
  import mermaid from "mermaid";

  export default mermaid;
}
