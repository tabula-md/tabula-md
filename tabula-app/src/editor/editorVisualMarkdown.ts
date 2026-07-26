import type { CSSProperties, ReactNode } from "react";
import type { Root } from "react-dom/client";

type VisualMarkdownMount = {
  cancelled: boolean;
  host: HTMLElement;
  root: Root | null;
};

type VisualMarkdownRuntime = {
  React: typeof import("react");
  ReactMarkdown: typeof import("react-markdown").default;
  createRoot: typeof import("react-dom/client").createRoot;
  remarkPlugins: typeof import("../preview/markdownRemarkPlugins").MARKDOWN_REMARK_PLUGINS;
  urlTransform: typeof import("../preview/markdownPreviewUrl").transformMarkdownPreviewUrl;
};

const mountsByTarget = new WeakMap<HTMLElement, VisualMarkdownMount>();
const targetsByOwner = new WeakMap<HTMLElement, Set<HTMLElement>>();
let runtimePromise: Promise<VisualMarkdownRuntime> | null = null;

const loadVisualMarkdownRuntime = () => {
  runtimePromise ??= Promise.all([
    import("react"),
    import("react-dom/client"),
    import("react-markdown"),
    import("../preview/markdownRemarkPlugins"),
    import("../preview/markdownPreviewUrl"),
  ]).then(([
    React,
    { createRoot },
    reactMarkdownModule,
    { MARKDOWN_REMARK_PLUGINS },
    { transformMarkdownPreviewUrl },
  ]) => ({
    React,
    ReactMarkdown: reactMarkdownModule.default,
    createRoot,
    remarkPlugins: MARKDOWN_REMARK_PLUGINS,
    urlTransform: transformMarkdownPreviewUrl,
  }));
  return runtimePromise;
};

const unmountTarget = (target: HTMLElement) => {
  const mount = mountsByTarget.get(target);
  if (!mount) return;
  mount.cancelled = true;
  const root = mount.root;
  if (root) {
    queueMicrotask(() => {
      try {
        root.unmount();
      } finally {
        mount.host.remove();
      }
    });
  } else {
    mount.host.remove();
  }
  mountsByTarget.delete(target);
};

const mountEditorVisualReact = (
  owner: HTMLElement,
  target: HTMLElement,
  fallback: string,
  render: (runtime: VisualMarkdownRuntime) => ReactNode,
) => {
  unmountTarget(target);
  const host = document.createElement("div");
  host.className = "cm-visual-markdown-root";
  host.style.display = "contents";
  host.textContent = fallback;
  target.replaceChildren(host);
  const mount: VisualMarkdownMount = { cancelled: false, host, root: null };
  mountsByTarget.set(target, mount);
  const ownerTargets = targetsByOwner.get(owner) ?? new Set<HTMLElement>();
  ownerTargets.add(target);
  targetsByOwner.set(owner, ownerTargets);

  void loadVisualMarkdownRuntime().then((runtime) => {
    if (
      mount.cancelled ||
      mountsByTarget.get(target) !== mount ||
      !owner.isConnected ||
      !host.isConnected
    ) {
      return;
    }
    const root = runtime.createRoot(host);
    mount.root = root;
    root.render(render(runtime));
  }).catch(() => undefined);
};

const createMarkdownElement = (
  runtime: VisualMarkdownRuntime,
  source: string,
  inline = false,
) => runtime.React.createElement(
  runtime.ReactMarkdown,
  {
    components: inline
      ? {
          p: ({ children }: { children?: ReactNode }) =>
            runtime.React.createElement(runtime.React.Fragment, null, children),
        }
      : undefined,
    remarkPlugins: runtime.remarkPlugins,
    urlTransform: runtime.urlTransform,
  },
  source,
);

export const mountEditorVisualMarkdown = (
  owner: HTMLElement,
  target: HTMLElement,
  source: string,
  options: { inline?: boolean } = {},
) => {
  mountEditorVisualReact(
    owner,
    target,
    source,
    (runtime) => createMarkdownElement(runtime, source, options.inline),
  );
};

export const mountEditorVisualMarkdownTable = (
  owner: HTMLElement,
  target: HTMLElement,
  alignments: Array<"left" | "center" | "right" | null>,
  header: string[],
  rows: string[][],
) => {
  const fallback = [header, ...rows].map((row) => row.join(" | ")).join("\n");
  mountEditorVisualReact(owner, target, fallback, (runtime) => {
    const createCell = (
      tagName: "th" | "td",
      value: string,
      columnIndex: number,
      rowIndex: number,
    ) => runtime.React.createElement(
      tagName,
      {
        key: `${rowIndex}:${columnIndex}`,
        style: alignments[columnIndex]
          ? { textAlign: alignments[columnIndex] } as CSSProperties
          : undefined,
      },
      createMarkdownElement(runtime, value, true),
    );
    return runtime.React.createElement(
      "table",
      null,
      runtime.React.createElement(
        "thead",
        null,
        runtime.React.createElement(
          "tr",
          null,
          header.map((value, columnIndex) => createCell("th", value, columnIndex, -1)),
        ),
      ),
      runtime.React.createElement(
        "tbody",
        null,
        rows.map((row, rowIndex) => runtime.React.createElement(
          "tr",
          { key: rowIndex },
          row.map((value, columnIndex) => createCell("td", value, columnIndex, rowIndex)),
        )),
      ),
    );
  });
};

export const destroyEditorVisualMarkdown = (owner: HTMLElement) => {
  const targets = targetsByOwner.get(owner);
  if (!targets) return;
  for (const target of targets) unmountTarget(target);
  targetsByOwner.delete(owner);
};
