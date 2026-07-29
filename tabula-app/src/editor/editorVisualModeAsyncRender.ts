import type { EditorView } from "@codemirror/view";
import { requestEditorVisualGeometryMeasure } from "./editorVisualViewport";

let visualWidgetId = 0;
let mermaidRuntimePromise: Promise<typeof import("mermaid").default> | null = null;
let mermaidRenderQueue: Promise<void> = Promise.resolve();
let initializedMermaidTheme: "dark" | "default" | null = null;

type KatexRuntime = {
  renderToString: (
    expression: string,
    options: {
      displayMode: boolean;
      output: "htmlAndMathml";
      strict: boolean;
      throwOnError: boolean;
      trust: boolean;
    },
  ) => string;
};

let katexRuntimePromise: Promise<KatexRuntime> | null = null;

const getKatexRuntime = () => {
  katexRuntimePromise ??= import("katex/dist/katex.min.js").then((module) => {
    const maybeModule = module as unknown as { default?: KatexRuntime } & KatexRuntime;
    return maybeModule.default ?? maybeModule;
  });
  return katexRuntimePromise;
};

export const getEditorVisualWidgetId = (prefix: string) =>
  `${prefix}-${visualWidgetId += 1}`;

export const renderEditorVisualInlineMath = (
  container: HTMLElement,
  expression: string,
  view: EditorView,
) => {
  void getKatexRuntime()
    .then((katex) => {
      if (!container.isConnected) return;
      container.innerHTML = katex.renderToString(expression, {
        displayMode: false,
        output: "htmlAndMathml",
        strict: false,
        throwOnError: false,
        trust: false,
      });
      requestEditorVisualGeometryMeasure(view);
    })
    .catch(() => undefined);
};

export const renderEditorVisualMathBlock = (
  container: HTMLElement,
  expression: string,
  view: EditorView,
) => {
  void getKatexRuntime()
    .then((katex) => {
      if (!container.isConnected) return;
      container.innerHTML = katex.renderToString(expression, {
        displayMode: true,
        output: "htmlAndMathml",
        strict: false,
        throwOnError: false,
        trust: false,
      });
      requestEditorVisualGeometryMeasure(view);
    })
    .catch(() => {
      if (!container.isConnected) return;
      container.classList.add("error");
      container.textContent = expression;
    });
};

export const highlightEditorVisualCode = (
  container: HTMLElement,
  codeElement: HTMLElement,
  code: string,
  language: string,
) => {
  void import("highlight.js/lib/common")
    .then((module) => {
      if (!container.isConnected) return;
      const highlighter = module.default ?? module;
      const result = highlighter.getLanguage(language)
        ? highlighter.highlight(code, { language })
        : null;
      if (!result) return;
      codeElement.innerHTML = result.value;
      codeElement.classList.add("hljs");
    })
    .catch(() => undefined);
};

export const renderEditorVisualDiagram = (
  container: HTMLElement,
  source: string,
  view: EditorView,
) => {
  const diagramId = getEditorVisualWidgetId("tabula-visual-diagram");
  const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "default";
  const render = mermaidRenderQueue.then(async () => {
    if (!container.isConnected) return null;
    mermaidRuntimePromise ??= import("mermaid").then((module) => module.default ?? module);
    const mermaid = await mermaidRuntimePromise;
    if (!container.isConnected) return null;
    if (initializedMermaidTheme !== theme) {
      mermaid.initialize({
        securityLevel: "strict",
        startOnLoad: false,
        suppressErrorRendering: true,
        theme,
      });
      initializedMermaidTheme = theme;
    }
    return mermaid.render(diagramId, source);
  });
  mermaidRenderQueue = render.then(() => undefined, () => undefined);
  void render
    .then((rendered) => {
      if (!rendered || !container.isConnected) return;
      container.innerHTML = rendered.svg;
      requestEditorVisualGeometryMeasure(view);
    })
    .catch(() => container.classList.add("error"));
};
