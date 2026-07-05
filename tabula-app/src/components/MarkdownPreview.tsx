import {
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Bookmark, Check, Copy, FileText, MessageSquare, WrapText } from "lucide-react";
import ReactMarkdown, { type Components, type Options as ReactMarkdownOptions } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkDeflist from "remark-deflist";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkSupersub from "remark-supersub";
import {
  areLineSurfaceRowsEqual,
  applyPreviewBlockMeasurements,
  buildLineSurfaceAnnotationRows,
  getLineSurfaceAnnotationsSignature,
  getPreviewWindow,
  TABULA_LARGE_DOCUMENT_UX_POLICY,
  type LineSurfaceAnnotation,
  type LineSurfaceRow,
  type LineSurfaceSourceBlock,
  type PreviewBlock,
  type PreviewBlockIndex,
  type PreviewBlockMeasurements,
} from "@tabula-md/tabula";
import { usePreviewBlockIndexWorker } from "../preview/usePreviewBlockIndexWorker";

export type MarkdownPreviewMetadata = {
  key: string;
  value: string;
};

type MarkdownPreviewProps = {
  metadata: MarkdownPreviewMetadata[];
  body: string;
  largeDocumentMode?: boolean;
  commentAnchors?: MarkdownPreviewCommentAnchor[];
  lineAnnotations?: MarkdownPreviewLineAnnotation[];
  activeCommentId?: string | null;
  commentsEnabled?: boolean;
  suspendLineMeasurement?: boolean;
  onLineAction?: (request: MarkdownPreviewLineActionRequest) => void;
  onOpenComment?: (commentId: string) => void;
  onToggleTaskLine?: (sourceLineIndex: number) => void;
};

export type MarkdownPreviewCommentAnchor = {
  id: string;
  start: number;
  end: number;
};

export type MarkdownPreviewLineAnnotation = LineSurfaceAnnotation;

export type MarkdownPreviewLineActionRequest = MarkdownPreviewLineAnnotation & {
  action: "bookmark" | "comment";
};

const externalLinkPattern = /^(?:https?:)?\/\//i;
const PREVIEW_SANITIZE_SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "card",
    "cardgroup",
    "dd",
    "dl",
    "dt",
    "frame",
    "mark",
    "section",
    "sub",
    "sup",
    "tabula-card",
    "tabula-card-group",
    "tabula-frame",
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      "title",
    ],
    card: [
      "href",
      "icon",
      "img",
      "title",
      "horizontal",
    ],
    cardgroup: [
      "cols",
    ],
    frame: [
      "caption",
      "hint",
    ],
    section: [
      ...(defaultSchema.attributes?.section ?? []),
      "ariaLabel",
      "dataFootnotes",
    ],
    "tabula-card": [
      "href",
      "icon",
      "img",
      "title",
      "horizontal",
    ],
    "tabula-card-group": [
      "cols",
    ],
    "tabula-frame": [
      "caption",
      "hint",
    ],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      "alt",
      "dataPath",
      "height",
      "title",
      "width",
    ],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: [
      ...(defaultSchema.protocols?.href ?? []),
      "http",
      "https",
      "mailto",
    ],
    img: [
      ...(defaultSchema.protocols?.img ?? []),
      "http",
      "https",
    ],
    src: [
      ...(defaultSchema.protocols?.src ?? []),
      "data",
      "http",
      "https",
    ],
  },
};
const EMPTY_MARKDOWN_PREVIEW_METADATA: MarkdownPreviewMetadata[] = [];
const EMPTY_PREVIEW_COMMENT_ANCHORS: MarkdownPreviewCommentAnchor[] = [];
const EMPTY_PREVIEW_LINE_ANNOTATIONS: MarkdownPreviewLineAnnotation[] = [];
const previewSourceBlockTags = new Set([
  "blockquote",
  "dd",
  "dl",
  "dt",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "table",
  "ul",
]);

const getNodeText = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }

  return "";
};

type MarkdownAstPosition = {
  start?: {
    offset?: number;
  };
  end?: {
    offset?: number;
  };
};

type MarkdownAstNode = {
  type?: string;
  value?: string;
  data?: Record<string, unknown>;
  position?: MarkdownAstPosition;
  children?: MarkdownAstNode[];
};

const MARK_INLINE_PATTERN = "==";
const markdownMarkIgnoredNodeTypes = new Set(["code", "html", "inlineCode", "yaml"]);

const createPositionFromOffsets = (sourcePosition: MarkdownAstPosition | undefined, start: number, end: number) => {
  const baseOffset = sourcePosition?.start?.offset;
  if (typeof baseOffset !== "number") {
    return undefined;
  }

  return {
    start: { offset: baseOffset + start },
    end: { offset: baseOffset + end },
  };
};

const splitMarkedTextNode = (node: MarkdownAstNode): MarkdownAstNode[] | null => {
  const value = node.value ?? "";
  let cursor = 0;
  const nextNodes: MarkdownAstNode[] = [];

  while (cursor < value.length) {
    const markerStart = value.indexOf(MARK_INLINE_PATTERN, cursor);
    if (markerStart === -1) {
      break;
    }

    const markerEnd = value.indexOf(MARK_INLINE_PATTERN, markerStart + MARK_INLINE_PATTERN.length);
    if (markerEnd === -1) {
      break;
    }

    const markedValue = value.slice(markerStart + MARK_INLINE_PATTERN.length, markerEnd);
    if (markedValue.length === 0 || markedValue.includes("\n")) {
      cursor = markerEnd + MARK_INLINE_PATTERN.length;
      continue;
    }

    if (markerStart > cursor) {
      nextNodes.push({
        type: "text",
        value: value.slice(cursor, markerStart),
        position: createPositionFromOffsets(node.position, cursor, markerStart),
      });
    }

    nextNodes.push({
      type: "mark",
      data: { hName: "mark" },
      position: createPositionFromOffsets(node.position, markerStart, markerEnd + MARK_INLINE_PATTERN.length),
      children: [
        {
          type: "text",
          value: markedValue,
          position: createPositionFromOffsets(
            node.position,
            markerStart + MARK_INLINE_PATTERN.length,
            markerEnd,
          ),
        },
      ],
    });

    cursor = markerEnd + MARK_INLINE_PATTERN.length;
  }

  if (nextNodes.length === 0) {
    return null;
  }

  if (cursor < value.length) {
    nextNodes.push({
      type: "text",
      value: value.slice(cursor),
      position: createPositionFromOffsets(node.position, cursor, value.length),
    });
  }

  return nextNodes;
};

const createRemarkMarkPlugin = () => (tree: MarkdownAstNode) => {
  const walk = (node: MarkdownAstNode) => {
    if (!node.children || markdownMarkIgnoredNodeTypes.has(node.type ?? "")) {
      return;
    }

    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      const child = node.children[index];
      if (child.type === "text") {
        const replacementNodes = splitMarkedTextNode(child);
        if (replacementNodes) {
          node.children.splice(index, 1, ...replacementNodes);
        }
        continue;
      }

      walk(child);
    }
  };

  walk(tree);
};

const MARKDOWN_REMARK_PLUGINS: NonNullable<ReactMarkdownOptions["remarkPlugins"]> = [
  remarkMath,
  remarkSupersub,
  [remarkGfm, { singleTilde: false }],
  remarkDeflist,
  createRemarkMarkPlugin,
  remarkBreaks,
];

type PreviewCodeBlockProps = {
  children?: ReactNode;
} & HTMLAttributes<HTMLPreElement>;

type PreviewMathProps = {
  blockProps?: HTMLAttributes<HTMLDivElement>;
  displayMode?: boolean;
  expression: string;
};

type KatexRenderer = {
  renderToString: (
    expression: string,
    options: {
      displayMode?: boolean;
      output?: "html" | "htmlAndMathml" | "mathml";
      strict?: boolean | "ignore" | "warn";
      throwOnError?: boolean;
      trust?: boolean;
    },
  ) => string;
};

type MermaidRenderer = {
  initialize: (options: Record<string, unknown>) => void;
  render: (id: string, source: string) => Promise<{ svg: string }>;
};

type HighlightRenderer = {
  getLanguage: (languageName: string) => unknown;
  highlight: (code: string, options: { ignoreIllegals?: boolean; language: string }) => { value: string };
};

let katexRendererPromise: Promise<KatexRenderer> | null = null;
let mermaidRendererPromise: Promise<MermaidRenderer> | null = null;
let highlightRendererPromise: Promise<HighlightRenderer> | null = null;
let initializedMermaidThemeKey: string | null = null;
let mermaidRenderCounter = 0;

const getDefaultExport = <TValue,>(module: unknown): TValue => {
  const maybeModule = module as { default?: TValue } & TValue;
  return maybeModule.default ?? maybeModule;
};

const loadKatexRenderer = () => {
  katexRendererPromise ??= import("katex/dist/katex.min.js").then(getDefaultExport<KatexRenderer>);
  return katexRendererPromise;
};

const loadHighlightRenderer = () => {
  highlightRendererPromise ??= import("highlight.js/lib/common").then(getDefaultExport<HighlightRenderer>);
  return highlightRendererPromise;
};

const getResolvedCssColor = (variableName: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(variableName).trim() || fallback;

const createMermaidThemeConfig = () => {
  const textColor = getResolvedCssColor("--text-primary", "#1f1f1f");
  const softTextColor = getResolvedCssColor("--text-soft", "#777777");
  const panelColor = getResolvedCssColor("--surface-panel", "#ffffff");
  const mutedSurfaceColor = getResolvedCssColor("--surface-muted", "#f7f7f8");
  const lineColor = getResolvedCssColor("--line-subtle", "#eeeeef");

  return {
    key: [textColor, softTextColor, panelColor, mutedSurfaceColor, lineColor].join("|"),
    options: {
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      flowchart: {
        htmlLabels: false,
      },
      themeVariables: {
        background: panelColor,
        mainBkg: panelColor,
        primaryColor: panelColor,
        primaryTextColor: textColor,
        primaryBorderColor: lineColor,
        secondaryColor: mutedSurfaceColor,
        secondaryTextColor: textColor,
        secondaryBorderColor: lineColor,
        tertiaryColor: mutedSurfaceColor,
        tertiaryTextColor: softTextColor,
        tertiaryBorderColor: lineColor,
        lineColor,
        textColor,
        nodeTextColor: textColor,
      },
    },
  };
};

const loadMermaidRenderer = async (themeConfig: ReturnType<typeof createMermaidThemeConfig>) => {
  mermaidRendererPromise ??= import("mermaid/dist/mermaid.core.mjs").then(getDefaultExport<MermaidRenderer>);
  const mermaid = await mermaidRendererPromise;
  if (initializedMermaidThemeKey !== themeConfig.key) {
    mermaid.initialize(themeConfig.options);
    initializedMermaidThemeKey = themeConfig.key;
  }

  return mermaid;
};

const PREVIEW_MATH_RENDER_CACHE_LIMIT = 256;
const PREVIEW_MERMAID_RENDER_CACHE_LIMIT = 48;
const PREVIEW_SYNTAX_RENDER_CACHE_LIMIT = 256;
const MERMAID_CACHE_ID_PLACEHOLDER = "__TABULA_MERMAID_ID__";
const katexRenderCache = new Map<string, string>();
const mermaidSvgCache = new Map<string, string>();
const syntaxHighlightCache = new Map<string, string>();

const replaceAllText = (value: string, search: string, replacement: string) =>
  search.length === 0 ? value : value.split(search).join(replacement);

const readBoundedStringCache = (cache: Map<string, string>, key: string) => {
  const value = cache.get(key);
  if (value === undefined) {
    return undefined;
  }

  cache.delete(key);
  cache.set(key, value);
  return value;
};

const writeBoundedStringCache = (cache: Map<string, string>, key: string, value: string, limit: number) => {
  cache.delete(key);
  cache.set(key, value);

  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== "string") {
      return;
    }

    cache.delete(oldestKey);
  }
};

const requestPreviewIdleTask = (callback: () => void) => {
  if ("requestIdleCallback" in window) {
    const handle = window.requestIdleCallback(callback, { timeout: 700 });
    return () => window.cancelIdleCallback(handle);
  }

  const handle = globalThis.setTimeout(callback, 120);
  return () => globalThis.clearTimeout(handle);
};

const usePreviewIdleReady = (resetKey: string) => {
  const [readyKey, setReadyKey] = useState<string | null>(null);

  useEffect(() => {
    setReadyKey(null);
    return requestPreviewIdleTask(() => setReadyKey(resetKey));
  }, [resetKey]);

  return readyKey === resetKey;
};

const usePreviewDeferredBlockReady = <TElement extends HTMLElement>(resetKey: string) => {
  const elementRef = useRef<TElement | null>(null);
  const [readyKey, setReadyKey] = useState<string | null>(null);

  useEffect(() => {
    setReadyKey(null);
    const element = elementRef.current;
    let cancelIdleTask: (() => void) | null = null;
    let observer: IntersectionObserver | null = null;
    let fallbackTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
    let readyScheduled = false;
    let cancelled = false;

    const markReady = () => {
      if (cancelled || readyScheduled) {
        return;
      }

      readyScheduled = true;
      cancelIdleTask = requestPreviewIdleTask(() => {
        if (!cancelled) {
          setReadyKey(resetKey);
        }
      });
    };

    if (!element || typeof IntersectionObserver === "undefined") {
      markReady();
      return () => {
        cancelled = true;
        cancelIdleTask?.();
      };
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          markReady();
        }
      },
      { rootMargin: "640px 0px" },
    );
    observer.observe(element);
    fallbackTimer = globalThis.setTimeout(markReady, 900);

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (fallbackTimer !== null) {
        globalThis.clearTimeout(fallbackTimer);
      }
      cancelIdleTask?.();
    };
  }, [resetKey]);

  return [elementRef, readyKey === resetKey] as const;
};

const useMermaidThemeConfig = () => {
  const [themeRevision, setThemeRevision] = useState(0);

  useEffect(() => {
    const updateThemeRevision = () => setThemeRevision((revision) => revision + 1);
    const observer =
      typeof MutationObserver === "undefined" ? null : new MutationObserver(updateThemeRevision);
    observer?.observe(document.documentElement, {
      attributeFilter: ["data-theme", "style"],
      attributes: true,
    });

    const colorSchemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    colorSchemeQuery?.addEventListener("change", updateThemeRevision);

    return () => {
      observer?.disconnect();
      colorSchemeQuery?.removeEventListener("change", updateThemeRevision);
    };
  }, []);

  return useMemo(() => createMermaidThemeConfig(), [themeRevision]);
};

const getCodeClassNameFromChildren = (children: ReactNode): string => {
  const candidates = Array.isArray(children) ? children : [children];

  for (const child of candidates) {
    if (!isValidElement<{ className?: string }>(child)) {
      continue;
    }

    if (typeof child.props.className === "string") {
      return child.props.className;
    }
  }

  return "";
};

const getCodeLanguage = (className = "") =>
  className.match(/(?:^|\s)language-([A-Za-z0-9_-]+)/)?.[1]?.toLowerCase();

const hasCodeClass = (className: string | undefined, targetClassName: string) =>
  Boolean(className?.split(/\s+/).includes(targetClassName));

const isMathDisplayCode = (className: string | undefined, language: string | undefined) =>
  language === "math" || hasCodeClass(className, "math-display");

const isMermaidCode = (language: string | undefined) => language === "mermaid" || language === "mmd";

const sanitizeMermaidSvg = (svg: string) => {
  const template = document.createElement("template");
  template.innerHTML = svg;
  template.content.querySelectorAll("script, foreignObject").forEach((element) => element.remove());
  template.content.querySelectorAll("*").forEach((element) => {
    for (let index = element.attributes.length - 1; index >= 0; index -= 1) {
      const attribute = element.attributes.item(index);
      if (!attribute) {
        continue;
      }

      const attributeName = attribute.name.toLowerCase();
      const attributeValue = attribute.value.trim().toLowerCase();
      if (
        attributeName.startsWith("on") ||
        ((attributeName === "href" || attributeName.endsWith(":href")) && attributeValue.startsWith("javascript:"))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  });

  return template.innerHTML;
};

type PreviewImageProps = {
  alt?: string;
  src?: string;
  title?: string;
};

type PreviewDocsComponentProps = {
  children?: ReactNode;
  caption?: string;
  cols?: number | string;
  hint?: string;
  horizontal?: boolean | string;
  href?: string;
  icon?: string;
  img?: string;
  title?: string;
};

type PreviewDocsRawComponentProps = PreviewDocsComponentProps & {
  node?: unknown;
};

type MarkdownRehypePlugins = NonNullable<ReactMarkdownOptions["rehypePlugins"]>;

function PreviewMath({ blockProps, displayMode = false, expression }: PreviewMathProps) {
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const trimmedExpression = expression.trim();
  const cacheKey = `${displayMode ? "display" : "inline"}:${trimmedExpression}`;
  const [blockRef, blockReady] = usePreviewDeferredBlockReady<HTMLDivElement>(cacheKey);
  const inlineReady = usePreviewIdleReady(cacheKey);
  const canRender = displayMode ? blockReady : inlineReady;

  useEffect(() => {
    if (trimmedExpression.length === 0) {
      setRenderedHtml(null);
      setRenderError(null);
      return undefined;
    }

    const cachedHtml = readBoundedStringCache(katexRenderCache, cacheKey);
    if (cachedHtml) {
      setRenderedHtml(cachedHtml);
      setRenderError(null);
      return undefined;
    }

    if (!canRender) {
      setRenderedHtml(null);
      setRenderError(null);
      return undefined;
    }

    let isCancelled = false;
    setRenderedHtml(null);
    setRenderError(null);

    loadKatexRenderer()
      .then((katex) =>
        katex.renderToString(trimmedExpression, {
          displayMode,
          output: "htmlAndMathml",
          strict: "ignore",
          throwOnError: false,
          trust: false,
        }),
      )
      .then((html) => {
        if (!isCancelled) {
          writeBoundedStringCache(katexRenderCache, cacheKey, html, PREVIEW_MATH_RENDER_CACHE_LIMIT);
          setRenderedHtml(html);
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setRenderError(error instanceof Error ? error.message : "Could not render math.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [cacheKey, canRender, displayMode, trimmedExpression]);

  if (displayMode) {
    return (
      <div
        {...blockProps}
        ref={blockRef}
        className={`preview-math-block ${renderError ? "error" : ""} ${blockProps?.className ?? ""}`}
        title={renderError ?? undefined}
      >
        {renderedHtml ? (
          <span className="preview-math-rendered" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        ) : (
          <code>{trimmedExpression}</code>
        )}
      </div>
    );
  }

  return (
    <span className={`preview-math-inline ${renderError ? "error" : ""}`} title={renderError ?? undefined}>
      {renderedHtml ? (
        <span className="preview-math-rendered" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      ) : (
        <code>{trimmedExpression}</code>
      )}
    </span>
  );
}

function PreviewMermaidDiagram({
  source,
  blockProps,
}: {
  blockProps?: HTMLAttributes<HTMLDivElement>;
  source: string;
}) {
  const diagramIdRef = useRef<string | null>(null);
  const [renderedSvg, setRenderedSvg] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const mermaidThemeConfig = useMermaidThemeConfig();
  const renderKey = `${mermaidThemeConfig.key}:${source.trim()}`;
  const [blockRef, canRender] = usePreviewDeferredBlockReady<HTMLDivElement>(renderKey);

  if (!diagramIdRef.current) {
    mermaidRenderCounter += 1;
    diagramIdRef.current = `tabula-mermaid-${mermaidRenderCounter}`;
  }

  useEffect(() => {
    const trimmedSource = source.trim();
    if (trimmedSource.length === 0) {
      setRenderedSvg(null);
      setRenderError(null);
      return undefined;
    }

    const diagramId = diagramIdRef.current ?? `tabula-mermaid-${Date.now()}`;
    const cacheKey = `${mermaidThemeConfig.key}:${trimmedSource}`;
    const cachedSvg = readBoundedStringCache(mermaidSvgCache, cacheKey);
    if (cachedSvg) {
      setRenderedSvg(replaceAllText(cachedSvg, MERMAID_CACHE_ID_PLACEHOLDER, diagramId));
      setRenderError(null);
      return undefined;
    }

    if (!canRender) {
      setRenderedSvg(null);
      setRenderError(null);
      return undefined;
    }

    let isCancelled = false;
    setRenderedSvg(null);
    setRenderError(null);

    loadMermaidRenderer(mermaidThemeConfig)
      .then((mermaid) => mermaid.render(diagramId, trimmedSource))
      .then(({ svg }) => {
        if (!isCancelled) {
          const sanitizedSvg = sanitizeMermaidSvg(svg);
          const cachedTemplate = replaceAllText(sanitizedSvg, diagramId, MERMAID_CACHE_ID_PLACEHOLDER);
          writeBoundedStringCache(mermaidSvgCache, cacheKey, cachedTemplate, PREVIEW_MERMAID_RENDER_CACHE_LIMIT);
          setRenderedSvg(sanitizedSvg);
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setRenderError(error instanceof Error ? error.message : "Could not render Mermaid diagram.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [canRender, mermaidThemeConfig, source]);

  return (
    <div
      {...blockProps}
      ref={blockRef}
      className={`preview-mermaid-block ${renderError ? "error" : ""} ${blockProps?.className ?? ""}`}
      title={renderError ?? undefined}
    >
      {renderedSvg ? (
        <div className="preview-mermaid-svg" dangerouslySetInnerHTML={{ __html: renderedSvg }} />
      ) : renderError ? (
        <pre className="preview-mermaid-fallback"><code>{source.trim()}</code></pre>
      ) : (
        <div className="preview-diagram-loading">Rendering diagram...</div>
      )}
    </div>
  );
}

function PreviewImage({ alt = "", src, title, ...props }: PreviewImageProps) {
  const [hasError, setHasError] = useState(false);
  const caption = title || alt;

  return (
    <span className={`preview-image-frame ${hasError ? "broken" : ""}`}>
      <img
        {...props}
        alt={alt}
        aria-hidden={hasError ? "true" : undefined}
        className="preview-image"
        data-load-state={hasError ? "error" : "ready"}
        loading="lazy"
        src={src}
        title={title}
        onError={() => setHasError(true)}
      />
      {hasError && (
        <span className="preview-image-fallback" role="img" aria-label={alt || "Image failed to load"}>
          {alt || "Image failed to load"}
        </span>
      )}
      {caption && <span className="preview-image-caption">{caption}</span>}
    </span>
  );
}

const normalizeDocsAttribute = (value: boolean | number | string | undefined) =>
  typeof value === "string" ? value.replace(/^\{(.+)\}$/, "$1").trim() : value;

const getPreviewColumnCount = (cols: number | string | undefined) => {
  const parsedColumns = Number(normalizeDocsAttribute(cols));
  if (!Number.isFinite(parsedColumns)) {
    return 1;
  }

  return Math.max(1, Math.min(4, Math.round(parsedColumns)));
};

const normalizePreviewDocsComponents = (markdown: string) => {
  let isInFence = false;
  let activeFenceMarker = "";

  return markdown
    .split(/(\r?\n)/)
    .map((segment) => {
      if (segment === "\n" || segment === "\r\n") {
        return segment;
      }

      const fenceMatch = segment.match(/^ {0,3}(`{3,}|~{3,})/);
      if (fenceMatch) {
        const marker = fenceMatch[1];
        if (!isInFence) {
          isInFence = true;
          activeFenceMarker = marker;
        } else if (marker[0] === activeFenceMarker[0] && marker.length >= activeFenceMarker.length) {
          isInFence = false;
          activeFenceMarker = "";
        }
      }

      if (isInFence) {
        return segment;
      }

      return segment
        .replace(/<\/?CardGroup(?=[\s>/])/g, (match) => (match.startsWith("</") ? "</tabula-card-group" : "<tabula-card-group"))
        .replace(/<\/?Card(?=[\s>/])/g, (match) => (match.startsWith("</") ? "</tabula-card" : "<tabula-card"))
        .replace(/<\/?Frame(?=[\s>/])/g, (match) => (match.startsWith("</") ? "</tabula-frame" : "<tabula-frame"));
    })
    .join("");
};

type PreviewGlobalMarkdownContext = {
  globalDefinitions: string;
};

const referenceDefinitionLinePattern = /^ {0,3}\[(?!\^)([^\]\n]+)]:\s+\S/;
const footnoteDefinitionLinePattern = /^ {0,3}\[\^[^\]\n]+]:/;

const getPreviewGlobalMarkdownContext = (markdown: string): PreviewGlobalMarkdownContext => {
  let isInFence = false;
  let activeFenceMarker = "";
  const globalDefinitionLines: string[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!isInFence) {
        isInFence = true;
        activeFenceMarker = marker;
      } else if (marker[0] === activeFenceMarker[0] && marker.length >= activeFenceMarker.length) {
        isInFence = false;
        activeFenceMarker = "";
      }
      continue;
    }

    if (isInFence) {
      continue;
    }

    if (footnoteDefinitionLinePattern.test(line)) {
      globalDefinitionLines.push(line);
      continue;
    }

    if (referenceDefinitionLinePattern.test(line)) {
      globalDefinitionLines.push(line);
    }
  }

  return {
    globalDefinitions: globalDefinitionLines.join("\n"),
  };
};

function PreviewFrame({ children, caption, hint }: PreviewDocsComponentProps) {
  return (
    <figure className="preview-docs-frame">
      {hint && <div className="preview-docs-frame-hint">{hint}</div>}
      <div className="preview-docs-frame-body">{children}</div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function PreviewCardGroup({ children, cols }: PreviewDocsComponentProps) {
  const columnCount = getPreviewColumnCount(cols);

  return (
    <div
      className="preview-docs-card-group"
      style={{ "--preview-card-columns": columnCount } as CSSProperties}
    >
      {children}
    </div>
  );
}

function PreviewCard({ children, horizontal, href, icon, img, title }: PreviewDocsComponentProps) {
  const isExternal = typeof href === "string" && externalLinkPattern.test(href);
  const isHorizontal = normalizeDocsAttribute(horizontal) === true || normalizeDocsAttribute(horizontal) === "true";
  const cardBody = (
    <>
      {img && <PreviewImage alt={title ?? ""} src={img} />}
      <span className="preview-docs-card-content">
        {(icon || title) && (
          <span className="preview-docs-card-heading">
            {icon && <span className="preview-docs-card-icon">{icon}</span>}
            {title && <strong>{title}</strong>}
          </span>
        )}
        <span className="preview-docs-card-description">{children}</span>
      </span>
    </>
  );
  const className = `preview-docs-card ${isHorizontal ? "horizontal" : ""}`;

  if (!href) {
    return <div className={className}>{cardBody}</div>;
  }

  return (
    <a className={className} href={href} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noreferrer" : undefined}>
      {cardBody}
    </a>
  );
}

const PREVIEW_DOCS_COMPONENTS = {
  card: ({ children, href, icon, img, title, horizontal }: PreviewDocsRawComponentProps) => (
    <PreviewCard
      href={typeof href === "string" ? href : undefined}
      icon={typeof icon === "string" ? icon : undefined}
      img={typeof img === "string" ? img : undefined}
      title={typeof title === "string" ? title : undefined}
      horizontal={typeof horizontal === "string" || typeof horizontal === "boolean" ? horizontal : undefined}
    >
      {children}
    </PreviewCard>
  ),
  "tabula-card": ({ children, href, icon, img, title, horizontal }: PreviewDocsRawComponentProps) => (
    <PreviewCard
      href={typeof href === "string" ? href : undefined}
      icon={typeof icon === "string" ? icon : undefined}
      img={typeof img === "string" ? img : undefined}
      title={typeof title === "string" ? title : undefined}
      horizontal={typeof horizontal === "string" || typeof horizontal === "boolean" ? horizontal : undefined}
    >
      {children}
    </PreviewCard>
  ),
  cardgroup: ({ children, cols }: PreviewDocsRawComponentProps) => (
    <PreviewCardGroup cols={typeof cols === "string" || typeof cols === "number" ? cols : undefined}>
      {children}
    </PreviewCardGroup>
  ),
  "tabula-card-group": ({ children, cols }: PreviewDocsRawComponentProps) => (
    <PreviewCardGroup cols={typeof cols === "string" || typeof cols === "number" ? cols : undefined}>
      {children}
    </PreviewCardGroup>
  ),
  frame: ({ children, caption, hint }: PreviewDocsRawComponentProps) => (
    <PreviewFrame
      caption={typeof caption === "string" ? caption : undefined}
      hint={typeof hint === "string" ? hint : undefined}
    >
      {children}
    </PreviewFrame>
  ),
  "tabula-frame": ({ children, caption, hint }: PreviewDocsRawComponentProps) => (
    <PreviewFrame
      caption={typeof caption === "string" ? caption : undefined}
      hint={typeof hint === "string" ? hint : undefined}
    >
      {children}
    </PreviewFrame>
  ),
} as unknown as Components;

function PreviewCodeBlock({ children, ...props }: PreviewCodeBlockProps) {
  const [isWrapped, setIsWrapped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const codeText = useMemo(() => getNodeText(children).replace(/\n$/, ""), [children]);
  const codeClassName = getCodeClassNameFromChildren(children);
  const language = getCodeLanguage(codeClassName);
  const highlightKey = `${language ?? "plain"}:${codeText}`;
  const [blockRef, canHighlight] = usePreviewDeferredBlockReady<HTMLDivElement>(highlightKey);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  useEffect(() => {
    if (!language || isMathDisplayCode(codeClassName, language) || isMermaidCode(language)) {
      setHighlightedHtml(null);
      return undefined;
    }

    const cachedHtml = readBoundedStringCache(syntaxHighlightCache, highlightKey);
    if (cachedHtml) {
      setHighlightedHtml(cachedHtml);
      return undefined;
    }

    if (!canHighlight) {
      setHighlightedHtml(null);
      return undefined;
    }

    let isCancelled = false;
    setHighlightedHtml(null);
    loadHighlightRenderer()
      .then((highlight) => {
        if (!highlight.getLanguage(language)) {
          return null;
        }

        return highlight.highlight(codeText, { language, ignoreIllegals: true }).value;
      })
      .then((html) => {
        if (!isCancelled && html) {
          writeBoundedStringCache(syntaxHighlightCache, highlightKey, html, PREVIEW_SYNTAX_RENDER_CACHE_LIMIT);
          setHighlightedHtml(html);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setHighlightedHtml(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [canHighlight, codeClassName, codeText, highlightKey, language]);

  if (isMathDisplayCode(codeClassName, language)) {
    return <PreviewMath blockProps={props as HTMLAttributes<HTMLDivElement>} displayMode expression={codeText} />;
  }

  if (isMermaidCode(language)) {
    return <PreviewMermaidDiagram blockProps={props as HTMLAttributes<HTMLDivElement>} source={codeText} />;
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard?.writeText(codeText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const CopyIcon = copied ? Check : Copy;
  const codeClassNames = [
    codeClassName,
    highlightedHtml ? "hljs" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={blockRef} className={`preview-code-block ${isWrapped ? "wrapped" : ""}`}>
      <div className="preview-code-actions" aria-label="Code block actions">
        <button
          type="button"
          className={`preview-code-action ${isWrapped ? "active" : ""}`}
          title={isWrapped ? "Disable word wrap" : "Enable word wrap"}
          aria-label={isWrapped ? "Disable word wrap" : "Enable word wrap"}
          aria-pressed={isWrapped}
          onClick={() => setIsWrapped((nextIsWrapped) => !nextIsWrapped)}
        >
          <WrapText size={16} />
        </button>
        <button
          type="button"
          className="preview-code-action"
          title={copied ? "Copied" : "Copy code"}
          aria-label={copied ? "Copied" : "Copy code"}
          onClick={copyCode}
        >
          <CopyIcon size={16} />
        </button>
      </div>
      <pre {...props}>
        {highlightedHtml ? (
          <code
            className={codeClassNames || undefined}
            data-language={language}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <code className={codeClassNames || undefined} data-language={language}>
            {codeText}
          </code>
        )}
      </pre>
    </div>
  );
}

type HastNode = {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  position?: {
    start?: { line?: number; offset?: number };
    end?: { line?: number; offset?: number };
  };
};

const ignoredPreviewSourceTags = new Set(["button", "code", "pre"]);
const ignoredCommentAnchorTags = new Set(["a", "button", "code", "pre"]);
const previewAlertTypes = new Set(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]);

const isHastElement = (node: HastNode | undefined, tagName?: string): node is HastNode =>
  node?.type === "element" && (tagName === undefined || node.tagName === tagName);

const getHastText = (node: HastNode | undefined): string => {
  if (!node) {
    return "";
  }

  if (node.type === "text") {
    return node.value ?? "";
  }

  return node.children?.map(getHastText).join("") ?? "";
};

const pruneEmptyTextAndLeadingBreaks = (node: HastNode) => {
  if (!node.children) {
    return;
  }

  while (node.children.length > 0) {
    const firstChild = node.children[0];
    const isEmptyText = firstChild.type === "text" && (firstChild.value ?? "").trim().length === 0;
    const isBreak = isHastElement(firstChild, "br");
    if (!isEmptyText && !isBreak) {
      break;
    }

    node.children.shift();
  }
};

const removeAlertMarker = (node: HastNode, pattern: RegExp): boolean => {
  if (node.type === "text" && typeof node.value === "string") {
    const nextValue = node.value.replace(pattern, "");
    if (nextValue !== node.value) {
      node.value = nextValue;
      return true;
    }
    return false;
  }

  return node.children?.some((child) => removeAlertMarker(child, pattern)) ?? false;
};

const isNodeVisuallyEmpty = (node: HastNode | undefined): boolean => !node || getHastText(node).trim().length === 0;

const createPreviewAlertPlugin = () => (tree: HastNode) => {
  const walk = (node: HastNode) => {
    if (isHastElement(node, "blockquote")) {
      const firstContentIndex = node.children?.findIndex((child) => isHastElement(child, "p")) ?? -1;
      const firstParagraph = firstContentIndex >= 0 ? node.children?.[firstContentIndex] : undefined;
      const firstParagraphText = getHastText(firstParagraph);
      const alertMatch = firstParagraphText.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)(?:\/([^\]]+))?\]\s*/i);

      if (firstParagraph && alertMatch) {
        const alertType = alertMatch[1].toUpperCase();
        const alertTitle = (alertMatch[2] ?? alertType).trim();
        if (previewAlertTypes.has(alertType)) {
          const className = [
            ...(Array.isArray(node.properties?.className) ? node.properties.className : []),
            "markdown-alert",
            `markdown-alert-${alertType.toLowerCase()}`,
          ];

          node.properties = {
            ...node.properties,
            className,
            dir: "auto",
          };

          removeAlertMarker(firstParagraph, new RegExp(`^\\s*\\[!${alertType}(?:/[^\\]]+)?\\]\\s*`, "i"));
          pruneEmptyTextAndLeadingBreaks(firstParagraph);

          const titleNode: HastNode = {
            type: "element",
            tagName: "p",
            properties: {
              className: ["markdown-alert-title"],
              dir: "auto",
            },
            children: [{ type: "text", value: alertTitle }],
          };

          const insertIndex = firstContentIndex;
          node.children?.splice(insertIndex, 0, titleNode);
          if (isNodeVisuallyEmpty(firstParagraph)) {
            node.children?.splice(insertIndex + 1, 1);
          }
        }
      }
    }

    node.children?.forEach(walk);
  };

  walk(tree);
};

const createPreviewSourceLinePlugin = (lineOffset = 0) => () => {
  const walk = (node: HastNode) => {
    if (node.type === "element" && typeof node.tagName === "string" && previewSourceBlockTags.has(node.tagName)) {
      const startLine = node.position?.start?.line;
      const endLine = node.position?.end?.line;
      if (typeof startLine === "number" && typeof endLine === "number") {
        const sourceStartLine = startLine + lineOffset;
        const sourceEndLine = endLine + lineOffset;
        node.properties = {
          ...node.properties,
          dataPreviewLineStart: sourceStartLine,
          dataPreviewLineEnd: Math.max(sourceStartLine, sourceEndLine),
        };
      }
    }

    node.children?.forEach(walk);
  };

  return (tree: HastNode) => {
    walk(tree);
  };
};

const PREVIEW_ALERT_REHYPE_PLUGINS = [createPreviewAlertPlugin];

const createPreviewCommentAnchorPlugin =
  (commentAnchors: MarkdownPreviewCommentAnchor[] = [], activeCommentId?: string | null) => () => {
    const anchors = commentAnchors
      .filter((anchor) => anchor.end > anchor.start)
      .sort((first, second) => first.start - second.start || first.end - second.end);

    return (tree: HastNode) => {
      const walk = (
        node: HastNode,
        parent?: HastNode,
        childIndex?: number,
        sourceIgnored = false,
        commentIgnored = false,
      ) => {
        const isSourceIgnored =
          sourceIgnored ||
          (node.type === "element" && typeof node.tagName === "string" && ignoredPreviewSourceTags.has(node.tagName));
        const isCommentIgnored =
          commentIgnored ||
          (node.type === "element" && typeof node.tagName === "string" && ignoredCommentAnchorTags.has(node.tagName));

        if (node.type === "text" && !isSourceIgnored && parent?.children && typeof childIndex === "number") {
          const value = node.value ?? "";
          const nodeStart = node.position?.start?.offset;
          const nodeEnd = node.position?.end?.offset;

          if (typeof nodeStart !== "number" || typeof nodeEnd !== "number" || value.length === 0) {
            return;
          }

          const intersections = (isCommentIgnored ? [] : anchors)
            .filter((anchor) => anchor.start < nodeEnd && anchor.end > nodeStart)
            .map((anchor) => ({
              anchor,
              start: Math.max(0, anchor.start - nodeStart),
              end: Math.min(value.length, anchor.end - nodeStart),
            }))
            .filter((range) => range.end > range.start)
            .sort((first, second) => first.start - second.start || first.end - second.end);

          const boundaries = new Set([0, value.length]);
          intersections.forEach((range) => {
            boundaries.add(range.start);
            boundaries.add(range.end);
          });
          const sortedBoundaries = [...boundaries].sort((first, second) => first - second);

          const nextChildren: HastNode[] = [];
          for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
            const start = sortedBoundaries[index];
            const end = sortedBoundaries[index + 1];
            if (end <= start) {
              continue;
            }

            const segmentAnchor = intersections.find((range) => range.start <= start && range.end >= end)?.anchor;
            const className = ["preview-source-text"];
            if (segmentAnchor) {
              className.push("preview-comment-mark");
              if (segmentAnchor.id === activeCommentId) {
                className.push("active");
              }
            }
            const properties: Record<string, unknown> = {
              className,
              dataSourceStart: nodeStart + start,
              dataSourceEnd: nodeStart + end,
            };

            if (segmentAnchor) {
              properties.dataCommentId = segmentAnchor.id;
              properties.role = "button";
              properties.tabIndex = 0;
              properties.title = segmentAnchor.id === activeCommentId ? "Active comment" : "Open comment";
            }

            nextChildren.push({
              type: "element",
              tagName: "span",
              properties,
              children: [{ type: "text", value: value.slice(start, end) }],
            });
          }

          parent.children.splice(childIndex, 1, ...nextChildren);
          return;
        }

        if (!node.children) {
          return;
        }

        for (let index = node.children.length - 1; index >= 0; index -= 1) {
          walk(node.children[index], node, index, isSourceIgnored, isCommentIgnored);
        }
      };

      walk(tree);
    };
  };

const createMarkdownPreviewComponents = (
  onOpenComment?: (commentId: string) => void,
  onToggleTaskLine?: (sourceLineIndex: number) => void,
): Components => ({
  ...PREVIEW_DOCS_COMPONENTS,
  a: ({ node: _node, href, ...props }) => {
    const isExternal = typeof href === "string" && externalLinkPattern.test(href);

    return <a href={href} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noreferrer" : undefined} {...props} />;
  },
  code: ({ node: _node, className, children, ...props }) => {
    const language = getCodeLanguage(className);

    if (language === "math" || hasCodeClass(className, "math-inline")) {
      return <PreviewMath expression={getNodeText(children)} />;
    }

    return <code className={className} data-language={language} {...props}>{children}</code>;
  },
  input: ({ node: _node, type, checked, ...props }) => {
    if (type !== "checkbox") {
      return <input type={type} checked={checked} {...props} />;
    }

    const className = `preview-task-checkbox ${checked ? "checked" : ""}`;
    if (!onToggleTaskLine) {
      return (
        <span
          aria-hidden="true"
          className={className}
          data-checked={checked ? "true" : "false"}
        />
      );
    }

    const handleTaskClick = (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const block = event.currentTarget.closest("[data-preview-line-start]");
      const sourceLineNumber = Number((block as HTMLElement | null)?.dataset.previewLineStart);
      if (!Number.isFinite(sourceLineNumber)) {
        return;
      }

      onToggleTaskLine(sourceLineNumber - 1);
    };

    return (
      <button
        type="button"
        aria-label={checked ? "Mark task incomplete" : "Mark task complete"}
        aria-pressed={checked}
        className={className}
        data-checked={checked ? "true" : "false"}
        onClick={handleTaskClick}
      />
    );
  },
  img: ({ node: _node, alt, src, title, ...props }) => (
    <PreviewImage alt={alt} src={src} title={typeof title === "string" ? title : undefined} {...props} />
  ),
  h1: ({ node: _node, id, children, ...props }) => (
    <h1 id={id} {...props}>
      {id && <a className="preview-heading-anchor" href={`#${id}`} aria-label="Link to section">#</a>}
      {children}
    </h1>
  ),
  h2: ({ node: _node, id, children, ...props }) => (
    <h2 id={id} {...props}>
      {id && <a className="preview-heading-anchor" href={`#${id}`} aria-label="Link to section">#</a>}
      {children}
    </h2>
  ),
  h3: ({ node: _node, id, children, ...props }) => (
    <h3 id={id} {...props}>
      {id && <a className="preview-heading-anchor" href={`#${id}`} aria-label="Link to section">#</a>}
      {children}
    </h3>
  ),
  h4: ({ node: _node, id, children, ...props }) => (
    <h4 id={id} {...props}>
      {id && <a className="preview-heading-anchor" href={`#${id}`} aria-label="Link to section">#</a>}
      {children}
    </h4>
  ),
  h5: ({ node: _node, id, children, ...props }) => (
    <h5 id={id} {...props}>
      {id && <a className="preview-heading-anchor" href={`#${id}`} aria-label="Link to section">#</a>}
      {children}
    </h5>
  ),
  h6: ({ node: _node, id, children, ...props }) => (
    <h6 id={id} {...props}>
      {id && <a className="preview-heading-anchor" href={`#${id}`} aria-label="Link to section">#</a>}
      {children}
    </h6>
  ),
  pre: ({ node: _node, children, ...props }) => <PreviewCodeBlock {...props}>{children}</PreviewCodeBlock>,
  span: ({ node: _node, className, children, ...props }) => {
    const spanProps = props as typeof props & { "data-comment-id"?: unknown };
    const commentId = typeof spanProps["data-comment-id"] === "string" ? spanProps["data-comment-id"] : undefined;
    const openComment = () => {
      if (commentId) {
        onOpenComment?.(commentId);
      }
    };
    const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openComment();
    };

    if (!commentId) {
      return (
        <span className={className} {...props}>
          {children}
        </span>
      );
    }

    return (
      <span className={className} {...props} onClick={openComment} onKeyDown={handleKeyDown}>
        {children}
      </span>
    );
  },
  table: ({ node: _node, ...props }) => (
    <div className="preview-table-wrap">
      <table {...props} />
    </div>
  ),
});

type PreviewLineRailRow = LineSurfaceRow<MarkdownPreviewLineAnnotation>;

const PREVIEW_LINE_MEASUREMENT_WIDTH_BUCKET = 8;
const PREVIEW_LINE_MEASUREMENT_CACHE_LIMIT = 12;
const PREVIEW_VIRTUAL_OVERSCAN = 1_800;
const PREVIEW_VIEWPORT_FALLBACK_HEIGHT = 720;

type PreviewViewport = {
  scrollTop: number;
  viewportHeight: number;
};

const getStringHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return `${value.length}:${hash.toString(36)}`;
};

const getWidthBucket = (width: number) =>
  Math.max(0, Math.round(width / PREVIEW_LINE_MEASUREMENT_WIDTH_BUCKET) * PREVIEW_LINE_MEASUREMENT_WIDTH_BUCKET);

const writePreviewLineMeasurementCache = (
  cache: Map<string, PreviewLineRailRow[]>,
  key: string,
  rows: PreviewLineRailRow[],
) => {
  cache.delete(key);
  cache.set(key, rows);

  while (cache.size > PREVIEW_LINE_MEASUREMENT_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== "string") {
      return;
    }

    cache.delete(oldestKey);
  }
};

const getPreviewLineButtonLabel = (
  side: "bookmark" | "comment",
  row: MarkdownPreviewLineAnnotation,
) => {
  if (side === "bookmark") {
    return row.hasBookmark ? "Remove preview line bookmark" : "Bookmark preview line";
  }

  return row.hasComment ? "Open preview line comments" : "Comment on preview line";
};

function PreviewLineGutter({
  side,
  rows,
  onLineAction,
  enabled = true,
}: {
  side: "bookmark" | "comment";
  rows: PreviewLineRailRow[];
  onLineAction: (request: MarkdownPreviewLineActionRequest) => void;
  enabled?: boolean;
}) {
  const Icon = side === "bookmark" ? Bookmark : MessageSquare;

  return (
    <div className={`preview-line-gutter ${side}`} aria-label={side === "bookmark" ? "Preview bookmarks" : "Preview comments"}>
      {enabled && rows.map((row) => {
        const isActive = side === "bookmark" ? row.hasBookmark : row.hasComment;
        const className = [
          "preview-line-action",
          side,
          isActive ? `has-${side === "bookmark" ? "bookmark" : "comment"}` : "",
          side === "comment" && row.hasActiveComment ? "active" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={`${side}-${row.lineNumber}`}
            className={className}
            type="button"
            style={{ top: row.top, height: row.height }}
            tabIndex={isActive ? 0 : -1}
            aria-label={getPreviewLineButtonLabel(side, row)}
            title={side === "bookmark" ? (row.hasBookmark ? "Remove bookmark" : "Bookmark line") : row.hasComment ? "Open comments" : "Comment on line"}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onLineAction({ ...row, action: side });
            }}
          >
            <Icon className="preview-line-action-icon" size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

const getPreviewScrollSurface = (documentElement: HTMLElement | null) =>
  documentElement?.closest<HTMLElement>(".preview-surface") ?? null;

const getPreviewViewport = (documentElement: HTMLElement | null): PreviewViewport => {
  const scrollSurface = getPreviewScrollSurface(documentElement);
  return {
    scrollTop: scrollSurface?.scrollTop ?? 0,
    viewportHeight: scrollSurface?.clientHeight ?? PREVIEW_VIEWPORT_FALLBACK_HEIGHT,
  };
};

const createPreviewRehypePlugins = (
  commentAnchorPlugins: MarkdownRehypePlugins,
  lineOffset = 0,
): MarkdownRehypePlugins => [
  rehypeRaw,
  [rehypeSanitize, PREVIEW_SANITIZE_SCHEMA],
  rehypeSlug,
  ...PREVIEW_ALERT_REHYPE_PLUGINS,
  createPreviewSourceLinePlugin(lineOffset),
  ...commentAnchorPlugins,
] as MarkdownRehypePlugins;

const getBlockCommentAnchors = (
  block: PreviewBlock,
  commentAnchors: MarkdownPreviewCommentAnchor[],
) =>
  commentAnchors
    .filter((anchor) => anchor.start < block.endOffset && anchor.end > block.startOffset)
    .map((anchor) => ({
      id: anchor.id,
      start: Math.max(0, anchor.start - block.startOffset),
      end: Math.min(block.endOffset - block.startOffset, anchor.end - block.startOffset),
    }))
    .filter((anchor) => anchor.end > anchor.start);

function VirtualPreviewBlock({
  activeCommentId,
  block,
  commentsEnabled,
  components,
  commentAnchors,
  onBlockHeightChange,
  globalDefinitions,
}: {
  activeCommentId?: string | null;
  block: PreviewBlock;
  commentsEnabled: boolean;
  components: Components;
  commentAnchors: MarkdownPreviewCommentAnchor[];
  onBlockHeightChange: (blockId: string, height: number) => void;
  globalDefinitions: string;
}) {
  const blockRef = useRef<HTMLDivElement | null>(null);
  const blockCommentAnchors = useMemo(
    () => (commentsEnabled ? getBlockCommentAnchors(block, commentAnchors) : EMPTY_PREVIEW_COMMENT_ANCHORS),
    [block, commentAnchors, commentsEnabled],
  );
  const blockCommentPlugins = useMemo(
    () => (commentsEnabled ? [createPreviewCommentAnchorPlugin(blockCommentAnchors, activeCommentId)] : []),
    [activeCommentId, blockCommentAnchors, commentsEnabled],
  );
  const blockRehypePlugins = useMemo(
    () => createPreviewRehypePlugins(blockCommentPlugins, block.startLine - 1),
    [block.startLine, blockCommentPlugins],
  );
  const blockMarkdown = useMemo(
    () => (globalDefinitions ? `${block.text}\n\n${globalDefinitions}` : block.text),
    [block.text, globalDefinitions],
  );

  useLayoutEffect(() => {
    const element = blockRef.current;
    if (!element) {
      return undefined;
    }

    let frameId: number | null = null;
    const reportHeight = () => {
      frameId = null;
      const height = Math.ceil(element.getBoundingClientRect().height);
      if (height > 0) {
        onBlockHeightChange(block.id, height);
      }
    };
    const scheduleReport = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(reportHeight);
    };

    scheduleReport();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleReport);
    resizeObserver?.observe(element);

    return () => {
      resizeObserver?.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [block.id, onBlockHeightChange]);

  return (
    <div
      ref={blockRef}
      className="preview-virtual-block"
      data-preview-virtual-block="true"
      data-preview-block-kind={block.kind}
      data-preview-block-id={block.id}
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 220px" }}
    >
      <ReactMarkdown components={components} rehypePlugins={blockRehypePlugins} remarkPlugins={MARKDOWN_REMARK_PLUGINS}>
        {blockMarkdown}
      </ReactMarkdown>
    </div>
  );
}

function VirtualMarkdownPreview({
  activeCommentId,
  blockIndex,
  commentsEnabled,
  components,
  commentAnchors,
  onBlockHeightChange,
  globalDefinitions,
  viewport,
}: {
  activeCommentId?: string | null;
  blockIndex: PreviewBlockIndex;
  commentsEnabled: boolean;
  components: Components;
  commentAnchors: MarkdownPreviewCommentAnchor[];
  onBlockHeightChange: (blockId: string, height: number) => void;
  globalDefinitions: string;
  viewport: PreviewViewport;
}) {
  const previewWindow = useMemo(
    () => getPreviewWindow(blockIndex, viewport.scrollTop, viewport.viewportHeight, PREVIEW_VIRTUAL_OVERSCAN),
    [blockIndex, viewport.scrollTop, viewport.viewportHeight],
  );
  const firstBlock = previewWindow.blocks[0] ?? null;
  const lastBlock = previewWindow.blocks[previewWindow.blocks.length - 1] ?? null;
  const topSpacerHeight = firstBlock?.estimatedTop ?? 0;
  const bottomSpacerHeight = lastBlock
    ? Math.max(0, blockIndex.totalEstimatedHeight - (lastBlock.estimatedTop + lastBlock.estimatedHeight))
    : 0;

  return (
    <div
      className="preview-virtual-content"
      data-preview-virtual-content="true"
      style={{ minHeight: blockIndex.totalEstimatedHeight }}
    >
      {topSpacerHeight > 0 && <div aria-hidden="true" className="preview-virtual-spacer" style={{ height: topSpacerHeight }} />}
      {previewWindow.blocks.map((block) => (
        <VirtualPreviewBlock
          key={block.id}
          activeCommentId={activeCommentId}
          block={block}
          commentsEnabled={commentsEnabled}
          components={components}
          commentAnchors={commentAnchors}
          onBlockHeightChange={onBlockHeightChange}
          globalDefinitions={globalDefinitions}
        />
      ))}
      {bottomSpacerHeight > 0 && <div aria-hidden="true" className="preview-virtual-spacer" style={{ height: bottomSpacerHeight }} />}
    </div>
  );
}

function MarkdownPreviewComponent({
  metadata = EMPTY_MARKDOWN_PREVIEW_METADATA,
  body,
  largeDocumentMode = false,
  commentAnchors = EMPTY_PREVIEW_COMMENT_ANCHORS,
  lineAnnotations = EMPTY_PREVIEW_LINE_ANNOTATIONS,
  activeCommentId,
  commentsEnabled = true,
  suspendLineMeasurement = false,
  onLineAction,
  onOpenComment,
  onToggleTaskLine,
}: MarkdownPreviewProps) {
  const documentRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const onOpenCommentRef = useRef(onOpenComment);
  const onToggleTaskLineRef = useRef(onToggleTaskLine);
  const wasLineMeasurementSuspendedRef = useRef(suspendLineMeasurement);
  const hoverLineFrameRef = useRef<number | null>(null);
  const pendingHoverLineRef = useRef<{ clientY: number; target: EventTarget | null } | null>(null);
  const lineMeasurementCacheRef = useRef(new Map<string, PreviewLineRailRow[]>());
  const lineRailRowsRef = useRef<PreviewLineRailRow[]>([]);
  const [lineRailRows, setLineRailRows] = useState<PreviewLineRailRow[]>([]);
  const [hoverLineAnnotation, setHoverLineAnnotation] = useState<MarkdownPreviewLineAnnotation | null>(null);
  const [previewBlockMeasurements, setPreviewBlockMeasurements] = useState<PreviewBlockMeasurements>({});
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>(() => ({
    scrollTop: 0,
    viewportHeight: PREVIEW_VIEWPORT_FALLBACK_HEIGHT,
  }));
  const showLineGutters = Boolean(onLineAction);
  const showCommentGutter = showLineGutters;
  const stableCommentAnchors = commentAnchors.length > 0 ? commentAnchors : EMPTY_PREVIEW_COMMENT_ANCHORS;
  const stableLineAnnotations = lineAnnotations.length > 0 ? lineAnnotations : EMPTY_PREVIEW_LINE_ANNOTATIONS;
  const renderableBody = useMemo(() => normalizePreviewDocsComponents(body), [body]);
  const globalMarkdownContext = useMemo(
    () => getPreviewGlobalMarkdownContext(renderableBody),
    [renderableBody],
  );
  const shouldVirtualizePreview =
    largeDocumentMode &&
    renderableBody.trim().length > 0;
  const {
    blockIndex: previewBlockIndex,
    pending: previewBlockIndexPending,
    source: previewBlockIndexSource,
  } = usePreviewBlockIndexWorker(
    renderableBody,
    shouldVirtualizePreview,
  );
  const virtualPreviewBlockIndex = useMemo(
    () => (previewBlockIndex ? applyPreviewBlockMeasurements(previewBlockIndex, previewBlockMeasurements) : null),
    [previewBlockIndex, previewBlockMeasurements],
  );
  const handlePreviewBlockHeightChange = useCallback((blockId: string, height: number) => {
    const measuredHeight = Math.ceil(height);
    if (!Number.isFinite(measuredHeight) || measuredHeight <= 0) {
      return;
    }

    setPreviewBlockMeasurements((currentMeasurements) => {
      const currentHeight = currentMeasurements[blockId];
      if (typeof currentHeight === "number" && Math.abs(currentHeight - measuredHeight) < 1) {
        return currentMeasurements;
      }

      return {
        ...currentMeasurements,
        [blockId]: measuredHeight,
      };
    });
  }, []);
  const effectiveLineAnnotations = useMemo(() => {
    if (!hoverLineAnnotation) {
      return stableLineAnnotations;
    }

    const hasExistingAnnotation = stableLineAnnotations.some(
      (annotation) => annotation.lineNumber === hoverLineAnnotation.lineNumber,
    );
    if (hasExistingAnnotation) {
      return stableLineAnnotations;
    }

    return [...stableLineAnnotations, hoverLineAnnotation].sort((first, second) => first.lineNumber - second.lineNumber);
  }, [hoverLineAnnotation, stableLineAnnotations]);

  useLayoutEffect(() => {
    onOpenCommentRef.current = onOpenComment;
    onToggleTaskLineRef.current = onToggleTaskLine;
  }, [onOpenComment, onToggleTaskLine]);

  useEffect(() => {
    setPreviewBlockMeasurements({});
  }, [renderableBody]);

  const markdownPreviewComponents = useMemo(
    () =>
      createMarkdownPreviewComponents(
        (commentId) => onOpenCommentRef.current?.(commentId),
        (sourceLineIndex) => onToggleTaskLineRef.current?.(sourceLineIndex),
      ),
    [],
  );
  const commentAnchorPlugins = useMemo(
    () => (commentsEnabled ? [createPreviewCommentAnchorPlugin(stableCommentAnchors, activeCommentId)] : []),
    [activeCommentId, commentsEnabled, stableCommentAnchors],
  );
  const rehypePlugins = useMemo(
    () => createPreviewRehypePlugins(commentAnchorPlugins),
    [commentAnchorPlugins],
  );
  const bodyMeasurementKey = useMemo(() => getStringHash(renderableBody), [renderableBody]);
  const lineAnnotationsSignature = useMemo(
    () => getLineSurfaceAnnotationsSignature(effectiveLineAnnotations),
    [effectiveLineAnnotations],
  );
  const setMeasuredLineRailRows = useCallback((nextRows: PreviewLineRailRow[]) => {
    if (areLineSurfaceRowsEqual(lineRailRowsRef.current, nextRows)) {
      return;
    }

    lineRailRowsRef.current = nextRows;
    setLineRailRows(nextRows);
  }, []);
  const measurePreviewLineRows = useCallback((options: { force?: boolean } = {}) => {
    if (suspendLineMeasurement && !options.force) {
      return;
    }

    const documentElement = documentRef.current;
    const contentElement = contentRef.current;
    if (!documentElement || !contentElement || !showLineGutters) {
      setMeasuredLineRailRows([]);
      return;
    }

    const widthBucket = getWidthBucket(contentElement.clientWidth);
    const cacheKey = `${bodyMeasurementKey}:${widthBucket}:${lineAnnotationsSignature}`;
    const canUseMeasurementCache = !shouldVirtualizePreview;
    if (canUseMeasurementCache) {
      const cachedRows = lineMeasurementCacheRef.current.get(cacheKey);
      if (cachedRows) {
        setMeasuredLineRailRows(cachedRows);
        return;
      }
    }

    const documentRect = documentElement.getBoundingClientRect();
    const sourceBlocks = Array.from(contentElement.querySelectorAll<HTMLElement>("[data-preview-line-start]"))
      .map((element) => {
        const startLine = Number(element.dataset.previewLineStart);
        const endLine = Number(element.dataset.previewLineEnd);
        if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) {
          return null;
        }

        const rect = element.getBoundingClientRect();
        return {
          startLine,
          endLine: Math.max(startLine, endLine),
          top: rect.top - documentRect.top,
          bottom: rect.bottom - documentRect.top,
        };
      })
      .filter((block): block is LineSurfaceSourceBlock => Boolean(block))
      .sort((first, second) => first.startLine - second.startLine || first.top - second.top);
    const nextRows = buildLineSurfaceAnnotationRows(effectiveLineAnnotations, sourceBlocks);

    if (canUseMeasurementCache) {
      writePreviewLineMeasurementCache(lineMeasurementCacheRef.current, cacheKey, nextRows);
    }
    setMeasuredLineRailRows(nextRows);
  }, [bodyMeasurementKey, effectiveLineAnnotations, lineAnnotationsSignature, setMeasuredLineRailRows, shouldVirtualizePreview, showLineGutters, suspendLineMeasurement]);

  const updateHoverLineAnnotation = useCallback((target: EventTarget | null, clientY: number) => {
    if (!largeDocumentMode || !showLineGutters || suspendLineMeasurement) {
      return;
    }

    if (!(target instanceof Element)) {
      setHoverLineAnnotation(null);
      return;
    }

    const sourceBlock = target.closest<HTMLElement>("[data-preview-line-start]");
    if (!sourceBlock || !contentRef.current?.contains(sourceBlock)) {
      setHoverLineAnnotation(null);
      return;
    }

    const startLine = Number(sourceBlock.dataset.previewLineStart);
    const endLine = Number(sourceBlock.dataset.previewLineEnd);
    if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) {
      setHoverLineAnnotation(null);
      return;
    }

    const rect = sourceBlock.getBoundingClientRect();
    const sourceLineCount = Math.max(1, Math.round(endLine - startLine + 1));
    const lineHeight = Math.max(1, rect.height / sourceLineCount);
    const lineOffset = Math.max(0, Math.min(sourceLineCount - 1, Math.floor((clientY - rect.top) / lineHeight)));
    const lineNumber = Math.round(startLine + lineOffset);
    setHoverLineAnnotation((current) =>
      current?.lineNumber === lineNumber
        ? current
        : {
            lineNumber,
            start: 0,
            end: 0,
            hasActiveComment: false,
            hasBookmark: false,
            hasComment: false,
          },
    );
  }, [largeDocumentMode, showLineGutters, suspendLineMeasurement]);

  const handlePreviewPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!largeDocumentMode || !showLineGutters) {
      return;
    }

    pendingHoverLineRef.current = {
      clientY: event.clientY,
      target: event.target,
    };

    if (hoverLineFrameRef.current !== null) {
      return;
    }

    hoverLineFrameRef.current = window.requestAnimationFrame(() => {
      hoverLineFrameRef.current = null;
      const pendingHover = pendingHoverLineRef.current;
      pendingHoverLineRef.current = null;
      if (pendingHover) {
        updateHoverLineAnnotation(pendingHover.target, pendingHover.clientY);
      }
    });
  }, [largeDocumentMode, showLineGutters, updateHoverLineAnnotation]);

  const handlePreviewPointerLeave = useCallback(() => {
    pendingHoverLineRef.current = null;
    if (hoverLineFrameRef.current !== null) {
      window.cancelAnimationFrame(hoverLineFrameRef.current);
      hoverLineFrameRef.current = null;
    }
    setHoverLineAnnotation(null);
  }, []);

  useLayoutEffect(() => {
    if (!shouldVirtualizePreview) {
      return undefined;
    }

    const scrollSurface = getPreviewScrollSurface(documentRef.current);
    if (!scrollSurface) {
      setPreviewViewport(getPreviewViewport(documentRef.current));
      return undefined;
    }

    let frameId: number | null = null;
    const updateViewport = () => {
      frameId = null;
      const nextViewport = getPreviewViewport(documentRef.current);
      setPreviewViewport((currentViewport) =>
        currentViewport.scrollTop === nextViewport.scrollTop &&
        currentViewport.viewportHeight === nextViewport.viewportHeight
          ? currentViewport
          : nextViewport,
      );
    };
    const scheduleViewportUpdate = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(updateViewport);
    };

    updateViewport();
    scrollSurface.addEventListener("scroll", scheduleViewportUpdate, { passive: true });
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleViewportUpdate);
    resizeObserver?.observe(scrollSurface);

    return () => {
      scrollSurface.removeEventListener("scroll", scheduleViewportUpdate);
      resizeObserver?.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [shouldVirtualizePreview, renderableBody]);

  useLayoutEffect(() => {
    const wasSuspended = wasLineMeasurementSuspendedRef.current;
    wasLineMeasurementSuspendedRef.current = suspendLineMeasurement;

    if (suspendLineMeasurement) {
      return undefined;
    }

    let rafId: number | null = null;
    if (wasSuspended) {
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        measurePreviewLineRows({ force: true });
      });
    } else {
      measurePreviewLineRows();
    }

    const contentElement = contentRef.current;
    if (!contentElement || !showLineGutters) {
      return () => {
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId);
        }
      };
    }

    const handleLineMeasurementInvalidated = () => measurePreviewLineRows();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(handleLineMeasurementInvalidated);
    resizeObserver?.observe(contentElement);
    window.addEventListener("resize", handleLineMeasurementInvalidated);
    const initialMeasureFrame = window.requestAnimationFrame(handleLineMeasurementInvalidated);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleLineMeasurementInvalidated);
      window.cancelAnimationFrame(initialMeasureFrame);
    };
  }, [measurePreviewLineRows, showLineGutters, suspendLineMeasurement]);

  useLayoutEffect(() => {
    if (!shouldVirtualizePreview || suspendLineMeasurement) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => measurePreviewLineRows({ force: true }));
    return () => window.cancelAnimationFrame(frameId);
  }, [
    measurePreviewLineRows,
    previewViewport.scrollTop,
    previewViewport.viewportHeight,
    shouldVirtualizePreview,
    suspendLineMeasurement,
  ]);

  return (
    <div
      ref={documentRef}
      className={`preview-document ${showLineGutters ? "with-line-gutters" : ""} ${shouldVirtualizePreview ? "virtualized" : ""}`}
      data-preview-index-pending={shouldVirtualizePreview ? String(previewBlockIndexPending) : undefined}
      data-preview-index-source={shouldVirtualizePreview ? previewBlockIndexSource : "inline"}
      onPointerMove={handlePreviewPointerMove}
      onPointerLeave={handlePreviewPointerLeave}
    >
      {showLineGutters && onLineAction && (
        <PreviewLineGutter side="bookmark" rows={lineRailRows} onLineAction={onLineAction} />
      )}

      <div ref={contentRef} className="preview-document-content">
        {metadata.length > 0 && (
          <section className="frontmatter-view" aria-label="Frontmatter">
            {metadata.map((attribute) => (
              <div className="frontmatter-row" key={attribute.key}>
                <span>{attribute.key}</span>
                <strong>{attribute.value}</strong>
              </div>
            ))}
          </section>
        )}

        {renderableBody.trim().length > 0 ? (
          shouldVirtualizePreview ? (
            virtualPreviewBlockIndex ? (
              <VirtualMarkdownPreview
                activeCommentId={activeCommentId}
                blockIndex={virtualPreviewBlockIndex}
                commentsEnabled={commentsEnabled}
                components={markdownPreviewComponents}
                commentAnchors={stableCommentAnchors}
                onBlockHeightChange={handlePreviewBlockHeightChange}
                globalDefinitions={globalMarkdownContext.globalDefinitions}
                viewport={previewViewport}
              />
            ) : (
              <div
                className={`preview-placeholder ${TABULA_LARGE_DOCUMENT_UX_POLICY.showTransientPreviewStatus ? "" : "quiet"}`}
                aria-hidden={!TABULA_LARGE_DOCUMENT_UX_POLICY.showTransientPreviewStatus}
              >
                {TABULA_LARGE_DOCUMENT_UX_POLICY.showTransientPreviewStatus ? "Preparing preview..." : null}
              </div>
            )
          ) : (
            <ReactMarkdown components={markdownPreviewComponents} rehypePlugins={rehypePlugins} remarkPlugins={MARKDOWN_REMARK_PLUGINS}>
              {renderableBody}
            </ReactMarkdown>
          )
        ) : (
          <div className="preview-empty-state" aria-label="Preview">
            <FileText aria-hidden="true" className="preview-empty-state-icon" size={24} strokeWidth={1.8} />
            <span>Preview</span>
          </div>
        )}
      </div>

      {showCommentGutter && onLineAction && (
        <PreviewLineGutter side="comment" rows={lineRailRows} onLineAction={onLineAction} enabled={commentsEnabled} />
      )}
    </div>
  );
}

const arePreviewMetadataEqual = (firstMetadata: MarkdownPreviewMetadata[], secondMetadata: MarkdownPreviewMetadata[]) =>
  firstMetadata === secondMetadata ||
  (firstMetadata.length === secondMetadata.length &&
    firstMetadata.every((firstAttribute, index) => {
      const secondAttribute = secondMetadata[index];
      return firstAttribute.key === secondAttribute.key && firstAttribute.value === secondAttribute.value;
    }));

const arePreviewCommentAnchorsEqual = (
  firstAnchors: MarkdownPreviewCommentAnchor[] = EMPTY_PREVIEW_COMMENT_ANCHORS,
  secondAnchors: MarkdownPreviewCommentAnchor[] = EMPTY_PREVIEW_COMMENT_ANCHORS,
) =>
  firstAnchors === secondAnchors ||
  (firstAnchors.length === secondAnchors.length &&
    firstAnchors.every((firstAnchor, index) => {
      const secondAnchor = secondAnchors[index];
      return firstAnchor.id === secondAnchor.id && firstAnchor.start === secondAnchor.start && firstAnchor.end === secondAnchor.end;
    }));

const arePreviewLineAnnotationsEqual = (
  firstAnnotations: MarkdownPreviewLineAnnotation[] = EMPTY_PREVIEW_LINE_ANNOTATIONS,
  secondAnnotations: MarkdownPreviewLineAnnotation[] = EMPTY_PREVIEW_LINE_ANNOTATIONS,
) =>
  firstAnnotations === secondAnnotations ||
  (firstAnnotations.length === secondAnnotations.length &&
    firstAnnotations.every((firstAnnotation, index) => {
      const secondAnnotation = secondAnnotations[index];
      return (
        firstAnnotation.lineNumber === secondAnnotation.lineNumber &&
        firstAnnotation.start === secondAnnotation.start &&
        firstAnnotation.end === secondAnnotation.end &&
        firstAnnotation.hasBookmark === secondAnnotation.hasBookmark &&
        firstAnnotation.hasComment === secondAnnotation.hasComment &&
        firstAnnotation.hasActiveComment === secondAnnotation.hasActiveComment
      );
    }));

const areMarkdownPreviewPropsEqual = (firstProps: MarkdownPreviewProps, secondProps: MarkdownPreviewProps) =>
  firstProps.body === secondProps.body &&
  firstProps.activeCommentId === secondProps.activeCommentId &&
  firstProps.commentsEnabled === secondProps.commentsEnabled &&
  firstProps.largeDocumentMode === secondProps.largeDocumentMode &&
  firstProps.suspendLineMeasurement === secondProps.suspendLineMeasurement &&
  firstProps.onLineAction === secondProps.onLineAction &&
  firstProps.onOpenComment === secondProps.onOpenComment &&
  firstProps.onToggleTaskLine === secondProps.onToggleTaskLine &&
  arePreviewMetadataEqual(firstProps.metadata, secondProps.metadata) &&
  arePreviewCommentAnchorsEqual(firstProps.commentAnchors, secondProps.commentAnchors) &&
  arePreviewLineAnnotationsEqual(firstProps.lineAnnotations, secondProps.lineAnnotations);

export const MarkdownPreview = memo(MarkdownPreviewComponent, areMarkdownPreviewPropsEqual);
MarkdownPreview.displayName = "MarkdownPreview";
