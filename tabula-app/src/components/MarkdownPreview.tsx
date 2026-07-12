import {
  createContext,
  forwardRef,
  isValidElement,
  memo,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ForwardedRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Bookmark, Check, Copy, FileText, Slash, WrapText } from "lucide-react";
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
  createPreviewBlockIndex,
  getLineNumberForOffset,
  getLineSurfaceAnnotationsSignature,
  getMarkdownLineCount,
  getPreviewWindow,
  TABULA_LARGE_DOCUMENT_UX_POLICY,
  type LineSurfaceAnnotation,
  type LineSurfaceRow,
  type LineSurfaceSourceBlock,
  type PreviewBlockIndex,
  type PreviewBlockMeasurements,
  type TextChange,
} from "@tabula-md/tabula";
import type { MarkdownPreviewHandle } from "../preview/previewSyncTypes";
import {
  DEFAULT_SEARCH_OPTIONS,
  getEditorSearchMatches,
  getSearchQueryError,
  type SearchOptions,
} from "../editor/editorSearchModel";
import {
  getPreviewScrollSurface,
  getPreviewViewport,
  PREVIEW_VIEWPORT_FALLBACK_HEIGHT,
  usePreviewFollowController,
  type PreviewViewport,
} from "../preview/usePreviewFollowController";
import { usePreviewBlockIndexWorker } from "../preview/usePreviewBlockIndexWorker";
import { useVirtualPreviewMeasurements } from "../preview/useVirtualPreviewMeasurements";
import {
  VirtualMarkdownPreview,
  type GetVirtualPreviewBlockRehypePlugins,
} from "../preview/VirtualMarkdownPreview";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import {
  getWorkspaceSurfaceCopy,
  type WorkspaceSurfaceCopy,
} from "../workspaceSurfaceLocale";

export type MarkdownPreviewMetadata = {
  key: string;
  value: string;
};

type MarkdownPreviewProps = {
  metadata: MarkdownPreviewMetadata[];
  body: string;
  sourceLineOffset?: number;
  bodyTextChange?: TextChange | null;
  largeDocumentMode?: boolean;
  commentAnchors?: MarkdownPreviewCommentAnchor[];
  lineAnnotations?: MarkdownPreviewLineAnnotation[];
  activeCommentId?: string | null;
  commentsEnabled?: boolean;
  searchQuery?: string;
  searchOptions?: SearchOptions;
  activeSearchMatchIndex?: number;
  suspendLineMeasurement?: boolean;
  uiLanguage?: WorkspaceLanguage;
  onSearchMatchCountChange?: (count: number) => void;
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
  action: "bookmark";
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

const getElementOuterHeight = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const marginTop = Number.parseFloat(style.marginTop);
  const marginBottom = Number.parseFloat(style.marginBottom);
  const outerHeight =
    rect.height +
    (Number.isFinite(marginTop) ? marginTop : 0) +
    (Number.isFinite(marginBottom) ? marginBottom : 0);
  return Math.max(0, Math.ceil(outerHeight));
};

type PreviewMeasuredSourceElement = {
  bottom: number;
  element: HTMLElement;
  endLine: number;
  startLine: number;
  top: number;
};

const getPreviewMeasurementsAreEqual = (
  firstMeasurements: PreviewBlockMeasurements,
  secondMeasurements: PreviewBlockMeasurements,
) => {
  const firstEntries = Object.entries(firstMeasurements);
  const secondEntries = Object.entries(secondMeasurements);
  if (firstEntries.length !== secondEntries.length) {
    return false;
  }

  return firstEntries.every(([key, value]) => secondMeasurements[key] === value);
};

const getInlinePreviewBlockMeasurements = (
  contentElement: HTMLElement,
  blockIndex: PreviewBlockIndex,
  sourceLineOffset: number,
): PreviewBlockMeasurements => {
  const measuredElements = Array.from(
    contentElement.querySelectorAll<HTMLElement>("[data-preview-line-start], [data-preview-block-start-line]"),
  ).map((element): PreviewMeasuredSourceElement | null => {
    const startLine = Number(element.dataset.previewLineStart ?? element.dataset.previewBlockStartLine);
    const endLine = Number(element.dataset.previewLineEnd ?? element.dataset.previewBlockEndLine);
    if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) {
      return null;
    }

    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      element,
      endLine: Math.max(startLine, endLine),
      startLine,
      top: rect.top,
    };
  }).filter((element): element is PreviewMeasuredSourceElement => Boolean(element));

  const measurements: Record<string, number> = {};
  for (const block of blockIndex.blocks) {
    if (block.kind === "blank") {
      measurements[block.id] = 0;
      continue;
    }

    const sourceStartLine = block.startLine + sourceLineOffset;
    const sourceEndLine = block.endLine + sourceLineOffset;
    const exactElements = measuredElements.filter(
      (element) => element.startLine === sourceStartLine && element.endLine === sourceEndLine,
    );
    const containedElements = measuredElements.filter(
      (element) => element.startLine >= sourceStartLine && element.endLine <= sourceEndLine,
    );
    const overlappingElements = measuredElements.filter(
      (element) => element.startLine <= sourceEndLine && element.endLine >= sourceStartLine,
    );
    const blockElements =
      exactElements.length > 0
        ? exactElements
        : containedElements.length > 0
          ? containedElements
          : overlappingElements;
    if (blockElements.length === 0) {
      continue;
    }

    measurements[block.id] =
      blockElements.length === 1
        ? getElementOuterHeight(blockElements[0].element)
        : Math.max(
            0,
            Math.ceil(
              Math.max(...blockElements.map((element) => element.bottom)) -
                Math.min(...blockElements.map((element) => element.top)),
            ),
          );
  }

  return measurements;
};

const previewSourceBlockTags = new Set([
  "blockquote",
  "card",
  "cardgroup",
  "dd",
  "dl",
  "dt",
  "frame",
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
  "tabula-card",
  "tabula-card-group",
  "tabula-frame",
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
  copy: WorkspaceSurfaceCopy;
  searchActive?: boolean;
} & HTMLAttributes<HTMLPreElement>;

type PreviewMathProps = {
  blockProps?: HTMLAttributes<HTMLDivElement>;
  copy: WorkspaceSurfaceCopy;
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

const createMermaidThemeCss = ({
  lineColor,
  lineStrongColor,
  mutedSurfaceColor,
  panelColor,
  textColor,
}: {
  lineColor: string;
  lineStrongColor: string;
  mutedSurfaceColor: string;
  panelColor: string;
  textColor: string;
}) => `
  .node rect,
  .node circle,
  .node ellipse,
  .node polygon,
  .node path {
    fill: ${mutedSurfaceColor} !important;
    stroke: ${lineStrongColor} !important;
  }

  .cluster rect {
    fill: ${panelColor} !important;
    stroke: ${lineStrongColor} !important;
  }

  .edgePath .path,
  .flowchart-link,
  .messageLine0,
  .messageLine1,
  .transition,
  .relationshipLine {
    stroke: ${lineColor} !important;
  }

  marker path,
  .arrowMarkerPath {
    fill: ${lineColor} !important;
    stroke: ${lineColor} !important;
  }

  .nodeLabel,
  .edgeLabel,
  .cluster-label,
  .label,
  .label text,
  .label span,
  text,
  tspan {
    color: ${textColor} !important;
    fill: ${textColor} !important;
  }

  .edgeLabel,
  .edgeLabel p,
  .labelBkg,
  .label .background {
    background-color: ${panelColor} !important;
    fill: ${panelColor} !important;
  }
`;

const createMermaidThemeConfig = () => {
  const textColor = getResolvedCssColor("--text-primary", "#1f1f1f");
  const softTextColor = getResolvedCssColor("--text-soft", "#777777");
  const panelColor = getResolvedCssColor("--surface-overlay", "#ffffff");
  const mutedSurfaceColor = getResolvedCssColor("--surface-muted", "#f7f7f8");
  const activeSurfaceColor = getResolvedCssColor("--surface-active", panelColor);
  const lineStrongColor = getResolvedCssColor("--line-strong", "#d8d8dc");
  const lineColor = softTextColor;

  return {
    key: [textColor, softTextColor, panelColor, mutedSurfaceColor, activeSurfaceColor, lineStrongColor, lineColor].join("|"),
    options: {
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeCSS: createMermaidThemeCss({
        lineColor,
        lineStrongColor,
        mutedSurfaceColor,
        panelColor,
        textColor,
      }),
      flowchart: {
        htmlLabels: false,
      },
      themeVariables: {
        background: panelColor,
        mainBkg: mutedSurfaceColor,
        primaryColor: mutedSurfaceColor,
        primaryTextColor: textColor,
        primaryBorderColor: lineStrongColor,
        secondaryColor: activeSurfaceColor,
        secondaryTextColor: textColor,
        secondaryBorderColor: lineStrongColor,
        tertiaryColor: panelColor,
        tertiaryTextColor: textColor,
        tertiaryBorderColor: lineStrongColor,
        nodeBkg: mutedSurfaceColor,
        nodeBorder: lineStrongColor,
        clusterBkg: panelColor,
        clusterBorder: lineStrongColor,
        noteBkgColor: mutedSurfaceColor,
        noteBorderColor: lineStrongColor,
        noteTextColor: textColor,
        lineColor,
        defaultLinkColor: lineColor,
        arrowheadColor: lineColor,
        textColor,
        nodeTextColor: textColor,
        titleColor: textColor,
        edgeLabelBackground: panelColor,
        labelBackgroundColor: panelColor,
        stateBkg: mutedSurfaceColor,
        stateBorder: lineStrongColor,
        stateLabelColor: textColor,
        stateEdgeLabelBackground: panelColor,
        actorBkg: mutedSurfaceColor,
        actorBorder: lineStrongColor,
        actorLineColor: lineColor,
        actorTextColor: textColor,
        signalColor: lineColor,
        signalTextColor: textColor,
        labelBoxBkgColor: panelColor,
        labelBoxBorderColor: lineStrongColor,
        labelTextColor: textColor,
        loopTextColor: textColor,
        activationBorderColor: lineStrongColor,
        activationBkgColor: activeSurfaceColor,
        rectBkgColor: mutedSurfaceColor,
        transitionColor: lineColor,
        transitionLabelColor: textColor,
        classText: textColor,
        personBkg: mutedSurfaceColor,
        personBorder: lineStrongColor,
        compositeBackground: panelColor,
        compositeBorder: lineStrongColor,
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

const toFiniteNumber = (value: string | null, fallback: number) => {
  const parsedValue = Number.parseFloat(value ?? "");
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const preserveMermaidForeignObjectLabelText = (root: DocumentFragment) => {
  root.querySelectorAll("foreignObject").forEach((foreignObject) => {
    const labelText = foreignObject.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (!labelText) {
      foreignObject.remove();
      return;
    }

    const x = toFiniteNumber(foreignObject.getAttribute("x"), 0);
    const y = toFiniteNumber(foreignObject.getAttribute("y"), 0);
    const width = toFiniteNumber(foreignObject.getAttribute("width"), 0);
    const height = toFiniteNumber(foreignObject.getAttribute("height"), 0);
    const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textElement.setAttribute("x", String(x + width / 2));
    textElement.setAttribute("y", String(y + height / 2));
    textElement.setAttribute("text-anchor", "middle");
    textElement.setAttribute("dominant-baseline", "middle");
    textElement.setAttribute("class", "nodeLabel");
    textElement.textContent = labelText;
    foreignObject.replaceWith(textElement);
  });
};

const removeUnsafeMermaidNodes = (root: DocumentFragment) => {
  root.querySelectorAll("script, foreignObject").forEach((element) => element.remove());
};

const removeUnsafeMermaidAttributes = (root: DocumentFragment) => {
  root.querySelectorAll("*").forEach((element) => {
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
};

const sanitizeMermaidSvg = (svg: string) => {
  const template = document.createElement("template");
  template.innerHTML = svg;
  preserveMermaidForeignObjectLabelText(template.content);
  removeUnsafeMermaidNodes(template.content);
  removeUnsafeMermaidAttributes(template.content);

  return template.innerHTML;
};

type PreviewImageProps = {
  alt?: string;
  copy?: WorkspaceSurfaceCopy;
  src?: string;
  title?: string;
};

const PreviewLocaleContext = createContext<WorkspaceSurfaceCopy>(
  getWorkspaceSurfaceCopy("en"),
);

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
  "data-preview-line-end"?: number | string;
  "data-preview-line-start"?: number | string;
  node?: unknown;
};

type MarkdownRehypePlugins = NonNullable<ReactMarkdownOptions["rehypePlugins"]>;

function PreviewMath({ blockProps, copy, displayMode = false, expression }: PreviewMathProps) {
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
          setRenderError(error instanceof Error ? error.message : copy.couldNotRenderMath);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [cacheKey, canRender, copy.couldNotRenderMath, displayMode, trimmedExpression]);

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
  copy,
}: {
  blockProps?: HTMLAttributes<HTMLDivElement>;
  copy: WorkspaceSurfaceCopy;
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
          setRenderError(error instanceof Error ? error.message : copy.couldNotRenderDiagram);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [canRender, copy.couldNotRenderDiagram, mermaidThemeConfig, source]);

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
        <div className="preview-diagram-loading">{copy.renderingDiagram}</div>
      )}
    </div>
  );
}

function PreviewImage({ alt = "", copy: copyProp, src, title, ...props }: PreviewImageProps) {
  const contextCopy = useContext(PreviewLocaleContext);
  const copy = copyProp ?? contextCopy;
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
        <span className="preview-image-fallback" role="img" aria-label={alt || copy.imageFailed}>
          {alt || copy.imageFailed}
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
  footnoteDefinitions: string;
  footnoteReferences: string;
  referenceDefinitions: string;
};

const referenceDefinitionLinePattern = /^ {0,3}\[(?!\^)([^\]\n]+)]:\s+\S/;
const footnoteDefinitionLinePattern = /^ {0,3}\[\^([^\]\n]+)]:/;
const footnoteContinuationLinePattern = /^(?: {4,}|\t)\S/;

const getPreviewGlobalMarkdownContext = (markdown: string): PreviewGlobalMarkdownContext => {
  const lines = markdown.split(/\r?\n/);
  let isInFence = false;
  let activeFenceMarker = "";
  const referenceDefinitionLines: string[] = [];
  const footnoteDefinitionLines: string[] = [];
  const footnoteLabels: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
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

    const footnoteDefinitionMatch = line.match(footnoteDefinitionLinePattern);
    if (footnoteDefinitionMatch) {
      const footnoteLines = [line];
      const pendingBlankLines: string[] = [];
      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1];
        if (nextLine.trim().length === 0) {
          pendingBlankLines.push(nextLine);
          index += 1;
          continue;
        }

        if (footnoteContinuationLinePattern.test(nextLine)) {
          footnoteLines.push(...pendingBlankLines, nextLine);
          pendingBlankLines.length = 0;
          index += 1;
          continue;
        }

        break;
      }

      footnoteDefinitionLines.push(...footnoteLines);
      footnoteLabels.push(footnoteDefinitionMatch[1]);
      continue;
    }

    if (referenceDefinitionLinePattern.test(line)) {
      referenceDefinitionLines.push(line);
    }
  }

  return {
    footnoteDefinitions: footnoteDefinitionLines.join("\n"),
    footnoteReferences: footnoteLabels.map((label) => `[^${label}]`).join(" "),
    referenceDefinitions: referenceDefinitionLines.join("\n"),
  };
};

function PreviewFrame({ children, caption, hint, ...sourceProps }: PreviewDocsComponentProps & HTMLAttributes<HTMLElement>) {
  return (
    <figure {...sourceProps} className={`preview-docs-frame ${sourceProps.className ?? ""}`.trim()}>
      {hint && <div className="preview-docs-frame-hint">{hint}</div>}
      <div className="preview-docs-frame-body">{children}</div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function PreviewCardGroup({ children, cols, ...sourceProps }: PreviewDocsComponentProps & HTMLAttributes<HTMLElement>) {
  const columnCount = getPreviewColumnCount(cols);

  return (
    <div
      {...sourceProps}
      className={`preview-docs-card-group ${sourceProps.className ?? ""}`.trim()}
      style={{ "--preview-card-columns": columnCount } as CSSProperties}
    >
      {children}
    </div>
  );
}

function PreviewCard({
  children,
  horizontal,
  href,
  icon,
  img,
  title,
  ...sourceProps
}: PreviewDocsComponentProps & HTMLAttributes<HTMLElement>) {
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
  const className = `preview-docs-card ${isHorizontal ? "horizontal" : ""} ${sourceProps.className ?? ""}`.trim();

  if (!href) {
    return <div {...sourceProps} className={className}>{cardBody}</div>;
  }

  return (
    <a
      {...sourceProps}
      className={className}
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noreferrer" : undefined}
    >
      {cardBody}
    </a>
  );
}

const PREVIEW_DOCS_COMPONENTS = {
  card: ({ children, href, icon, img, title, horizontal, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewCard
      {...sourceProps}
      href={typeof href === "string" ? href : undefined}
      icon={typeof icon === "string" ? icon : undefined}
      img={typeof img === "string" ? img : undefined}
      title={typeof title === "string" ? title : undefined}
      horizontal={typeof horizontal === "string" || typeof horizontal === "boolean" ? horizontal : undefined}
    >
      {children}
    </PreviewCard>
  ),
  "tabula-card": ({ children, href, icon, img, title, horizontal, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewCard
      {...sourceProps}
      href={typeof href === "string" ? href : undefined}
      icon={typeof icon === "string" ? icon : undefined}
      img={typeof img === "string" ? img : undefined}
      title={typeof title === "string" ? title : undefined}
      horizontal={typeof horizontal === "string" || typeof horizontal === "boolean" ? horizontal : undefined}
    >
      {children}
    </PreviewCard>
  ),
  cardgroup: ({ children, cols, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewCardGroup {...sourceProps} cols={typeof cols === "string" || typeof cols === "number" ? cols : undefined}>
      {children}
    </PreviewCardGroup>
  ),
  "tabula-card-group": ({ children, cols, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewCardGroup {...sourceProps} cols={typeof cols === "string" || typeof cols === "number" ? cols : undefined}>
      {children}
    </PreviewCardGroup>
  ),
  frame: ({ children, caption, hint, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewFrame
      {...sourceProps}
      caption={typeof caption === "string" ? caption : undefined}
      hint={typeof hint === "string" ? hint : undefined}
    >
      {children}
    </PreviewFrame>
  ),
  "tabula-frame": ({ children, caption, hint, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewFrame
      {...sourceProps}
      caption={typeof caption === "string" ? caption : undefined}
      hint={typeof hint === "string" ? hint : undefined}
    >
      {children}
    </PreviewFrame>
  ),
} as unknown as Components;

function PreviewCodeBlock({ children, copy, searchActive = false, ...props }: PreviewCodeBlockProps) {
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
    return <PreviewMath blockProps={props as HTMLAttributes<HTMLDivElement>} copy={copy} displayMode expression={codeText} />;
  }

  if (isMermaidCode(language)) {
    return <PreviewMermaidDiagram blockProps={props as HTMLAttributes<HTMLDivElement>} copy={copy} source={codeText} />;
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
      <div className="preview-code-actions" aria-label={copy.codeBlockActions}>
        <button
          type="button"
          className={`preview-code-action ${isWrapped ? "active" : ""}`}
          data-tooltip={isWrapped ? copy.disableWordWrap : copy.enableWordWrap}
          aria-label={isWrapped ? copy.disableWordWrap : copy.enableWordWrap}
          aria-pressed={isWrapped}
          onClick={() => setIsWrapped((nextIsWrapped) => !nextIsWrapped)}
        >
          <span className="preview-code-action-icon-stack" aria-hidden="true">
            <WrapText size={16} />
            {isWrapped && <Slash className="preview-code-action-off-mark" size={16} />}
          </span>
        </button>
        <button
          type="button"
          className="preview-code-action"
          data-tooltip={copied ? copy.copied : copy.copyCode}
          aria-label={copied ? copy.copied : copy.copyCode}
          onClick={copyCode}
        >
          <CopyIcon size={16} />
        </button>
      </div>
      <pre {...props}>
        {searchActive ? (
          children
        ) : highlightedHtml ? (
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

const hasFootnoteSectionClass = (className: unknown) =>
  Array.isArray(className)
    ? className.includes("footnotes")
    : typeof className === "string" && className.split(/\s+/).includes("footnotes");

const isFootnoteSectionNode = (node: HastNode | undefined) =>
  isHastElement(node, "section") &&
  (
    node.properties?.dataFootnotes === true ||
    node.properties?.dataFootnotes === "true" ||
    node.properties?.["data-footnotes"] === true ||
    node.properties?.["data-footnotes"] === "true" ||
    hasFootnoteSectionClass(node.properties?.className)
  );

const createStripFootnoteSectionPlugin = () => (tree: HastNode) => {
  const walk = (node: HastNode) => {
    if (!node.children) {
      return;
    }

    node.children = node.children.filter((child) => !isFootnoteSectionNode(child));
    node.children.forEach(walk);
  };

  walk(tree);
};

const createFootnoteCollectorPlugin = () => (tree: HastNode) => {
  if (!tree.children) {
    return;
  }

  const footnoteSectionIndex = tree.children.findIndex(isFootnoteSectionNode);
  if (footnoteSectionIndex <= 0) {
    return;
  }

  tree.children = tree.children.filter(
    (child, index) => index >= footnoteSectionIndex || !isHastElement(child, "p"),
  );
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
  (
    commentAnchors: MarkdownPreviewCommentAnchor[] = [],
    activeCommentId: string | null | undefined,
    copy: Pick<WorkspaceSurfaceCopy, "activeComment" | "openComment">,
  ) => () => {
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
              properties.dataTooltip = segmentAnchor.id === activeCommentId ? copy.activeComment : copy.openComment;
              properties.ariaLabel = segmentAnchor.id === activeCommentId ? copy.activeComment : copy.openComment;
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

const previewSearchIgnoredTags = new Set(["script", "style", "svg"]);

const createPreviewSearchPlugin =
  (
    query: string,
    searchOptions: SearchOptions = DEFAULT_SEARCH_OPTIONS,
    activeMatchIndex = -1,
    options: {
      sourceBackedMatches?: Array<{ start: number; end: number }>;
      sourceOffsetBase?: number;
    } = {},
  ) => () => {
    const normalizedQuery = query.trim();
    const searchError = getSearchQueryError(normalizedQuery, searchOptions);
    if (!normalizedQuery || searchError) {
      return () => undefined;
    }

    return (tree: HastNode) => {
      let matchIndex = 0;
      const splitSearchTextNode = (node: HastNode): HastNode[] | null => {
        const value = node.value ?? "";
        const nodeStart =
          typeof node.position?.start?.offset === "number"
            ? node.position.start.offset + (options.sourceOffsetBase ?? 0)
            : null;
        const nodeEnd = nodeStart === null ? null : nodeStart + value.length;
        const matches = options.sourceBackedMatches && nodeStart !== null && nodeEnd !== null
          ? options.sourceBackedMatches
              .map((match, index) => ({
                end: Math.min(value.length, match.end - nodeStart),
                index,
                start: Math.max(0, match.start - nodeStart),
              }))
              .filter((match) => match.start < match.end && match.start < value.length && match.end > 0)
          : getEditorSearchMatches(value, normalizedQuery, searchOptions).map((match, index) => ({
              end: match.end,
              index,
              start: match.start,
            }));
        if (matches.length === 0) {
          return null;
        }

        const nextChildren: HastNode[] = [];
        let cursor = 0;
        for (const match of matches) {
          if (match.start > cursor) {
            nextChildren.push({ type: "text", value: value.slice(cursor, match.start) });
          }

          const currentMatchIndex = options.sourceBackedMatches ? match.index : matchIndex;
          const className = ["preview-search-match"];
          if (currentMatchIndex === activeMatchIndex) {
            className.push("active");
          }

          nextChildren.push({
            type: "element",
            tagName: "mark",
            properties: {
              className,
              dataPreviewSearchIndex: currentMatchIndex,
            },
            children: [{ type: "text", value: value.slice(match.start, match.end) }],
          });

          cursor = match.end;
          if (!options.sourceBackedMatches) {
            matchIndex += 1;
          }
        }

        if (cursor < value.length) {
          nextChildren.push({ type: "text", value: value.slice(cursor) });
        }

        return nextChildren;
      };
      const walk = (node: HastNode, ignored = false) => {
        const isIgnored =
          ignored ||
          (node.type === "element" &&
            typeof node.tagName === "string" &&
            previewSearchIgnoredTags.has(node.tagName));

        if (!node.children || isIgnored) {
          return;
        }

        const nextChildren: HastNode[] = [];
        for (const child of node.children) {
          if (child.type === "text") {
            const replacementNodes = splitSearchTextNode(child);
            nextChildren.push(...(replacementNodes ?? [child]));
            continue;
          }

          walk(child, isIgnored);
          nextChildren.push(child);
        }
        node.children = nextChildren;
      };

      walk(tree);
    };
  };

const createMarkdownPreviewComponents = (
  onOpenComment?: (commentId: string) => void,
  onToggleTaskLine?: (sourceLineIndex: number) => void,
  searchActive = false,
  copy: WorkspaceSurfaceCopy = getWorkspaceSurfaceCopy("en"),
): Components => ({
  ...PREVIEW_DOCS_COMPONENTS,
  a: ({ node: _node, href, ...props }) => {
    const isExternal = typeof href === "string" && externalLinkPattern.test(href);

    return <a href={href} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noreferrer" : undefined} {...props} />;
  },
  code: ({ node: _node, className, children, ...props }) => {
    const language = getCodeLanguage(className);

    if (language === "math" || hasCodeClass(className, "math-inline")) {
      return <PreviewMath copy={copy} expression={getNodeText(children)} />;
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
        aria-label={checked ? copy.markTaskIncomplete : copy.markTaskComplete}
        aria-pressed={checked}
        className={className}
        data-checked={checked ? "true" : "false"}
        onClick={handleTaskClick}
      />
    );
  },
  img: ({ node: _node, alt, src, title, ...props }) => (
    <PreviewImage alt={alt} copy={copy} src={src} title={typeof title === "string" ? title : undefined} {...props} />
  ),
  h1: ({ node: _node, id, children, ...props }) => (
    <h1 id={id} {...props}>
      {id && <a className="preview-heading-anchor" href={`#${id}`} aria-label={copy.linkToSection}>#</a>}
      {children}
    </h1>
  ),
  h2: ({ node: _node, id, children, ...props }) => (
    <h2 id={id} {...props}>
      {id && <a className="preview-heading-anchor" href={`#${id}`} aria-label={copy.linkToSection}>#</a>}
      {children}
    </h2>
  ),
  h3: ({ node: _node, id, children, ...props }) => (
    <h3 id={id} {...props}>
      {id && <a className="preview-heading-anchor" href={`#${id}`} aria-label={copy.linkToSection}>#</a>}
      {children}
    </h3>
  ),
  h4: ({ node: _node, id, children, ...props }) => (
    <h4 id={id} {...props}>
      {id && <a className="preview-heading-anchor" href={`#${id}`} aria-label={copy.linkToSection}>#</a>}
      {children}
    </h4>
  ),
  h5: ({ node: _node, id, children, ...props }) => (
    <h5 id={id} {...props}>
      {id && <a className="preview-heading-anchor" href={`#${id}`} aria-label={copy.linkToSection}>#</a>}
      {children}
    </h5>
  ),
  h6: ({ node: _node, id, children, ...props }) => (
    <h6 id={id} {...props}>
      {id && <a className="preview-heading-anchor" href={`#${id}`} aria-label={copy.linkToSection}>#</a>}
      {children}
    </h6>
  ),
  pre: ({ node: _node, children, ...props }) => (
    <PreviewCodeBlock copy={copy} searchActive={searchActive} {...props}>{children}</PreviewCodeBlock>
  ),
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
const PREVIEW_VIRTUAL_OVERSCAN = 1_200;
const VIRTUAL_GLOBAL_MARKDOWN_CONTEXT_DELAY_MS = 6_000;
const VIRTUAL_LINE_MEASUREMENT_SCROLL_IDLE_MS = 140;

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
  row: MarkdownPreviewLineAnnotation,
  copy: Pick<WorkspaceSurfaceCopy, "bookmarkLine" | "removeLineBookmark">,
) => row.hasBookmark ? copy.removeLineBookmark : copy.bookmarkLine;

function PreviewLineGutter({
  rows,
  onLineAction,
  copy,
}: {
  rows: PreviewLineRailRow[];
  onLineAction: (request: MarkdownPreviewLineActionRequest) => void;
  copy: WorkspaceSurfaceCopy;
}) {
  return (
    <div
      className="preview-line-gutter bookmark"
      aria-label={copy.previewBookmarks}
    >
      {rows.map((row) => {
        const isActive = row.hasBookmark;
        const className = [
          "preview-line-action",
          "bookmark",
          isActive ? "has-bookmark" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const label = getPreviewLineButtonLabel(row, copy);
        const children = <Bookmark className="preview-line-action-icon" size={14} strokeWidth={2} aria-hidden="true" />;

        if (!isActive) {
          return (
            <span
              key={`bookmark-${row.lineNumber}`}
              className={className}
              style={{ top: row.top, height: row.height }}
              aria-hidden="true"
              data-tooltip={label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onLineAction({ ...row, action: "bookmark" });
              }}
            >
              {children}
            </span>
          );
        }

        return (
          <button
            key={`bookmark-${row.lineNumber}`}
            className={className}
            type="button"
            style={{ top: row.top, height: row.height }}
            tabIndex={isActive ? 0 : -1}
            aria-label={label}
            data-tooltip={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onLineAction({ ...row, action: "bookmark" });
            }}
          >
            {children}
          </button>
        );
      })}
    </div>
  );
}

const createPreviewRehypePlugins = (
  commentAnchorPlugins: MarkdownRehypePlugins,
  lineOffset = 0,
  options: {
    previewSearchPlugin?: MarkdownRehypePlugins[number] | null;
    stripFootnoteSection?: boolean;
    stripGeneratedFootnoteReferences?: boolean;
  } = {},
): MarkdownRehypePlugins => [
  rehypeRaw,
  [rehypeSanitize, PREVIEW_SANITIZE_SCHEMA],
  rehypeSlug,
  ...PREVIEW_ALERT_REHYPE_PLUGINS,
  createPreviewSourceLinePlugin(lineOffset),
  ...(options.stripFootnoteSection ? [createStripFootnoteSectionPlugin] : []),
  ...(options.stripGeneratedFootnoteReferences ? [createFootnoteCollectorPlugin] : []),
  ...commentAnchorPlugins,
  ...(options.previewSearchPlugin ? [options.previewSearchPlugin] : []),
] as MarkdownRehypePlugins;

function MarkdownPreviewComponent({
  metadata = EMPTY_MARKDOWN_PREVIEW_METADATA,
  body,
  sourceLineOffset = 0,
  bodyTextChange,
  largeDocumentMode = false,
  commentAnchors = EMPTY_PREVIEW_COMMENT_ANCHORS,
  lineAnnotations = EMPTY_PREVIEW_LINE_ANNOTATIONS,
  activeCommentId,
  commentsEnabled = true,
  searchQuery = "",
  searchOptions = DEFAULT_SEARCH_OPTIONS,
  activeSearchMatchIndex = -1,
  suspendLineMeasurement = false,
  uiLanguage = "en",
  onSearchMatchCountChange,
  onLineAction,
  onOpenComment,
  onToggleTaskLine,
}: MarkdownPreviewProps, ref: ForwardedRef<MarkdownPreviewHandle>) {
  const uiCopy = getWorkspaceSurfaceCopy(uiLanguage);
  const documentRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const frontmatterRef = useRef<HTMLElement | null>(null);
  const onOpenCommentRef = useRef(onOpenComment);
  const onToggleTaskLineRef = useRef(onToggleTaskLine);
  const wasLineMeasurementSuspendedRef = useRef(suspendLineMeasurement);
  const hoverLineFrameRef = useRef<number | null>(null);
  const pendingHoverLineRef = useRef<{ clientY: number; target: EventTarget | null } | null>(null);
  const capturePreviewViewportAnchorForMeasurementRef = useRef<(() => void) | null>(null);
  const previewViewportBlockIndexRef = useRef<PreviewBlockIndex | null>(null);
  const lineMeasurementCacheRef = useRef(new Map<string, PreviewLineRailRow[]>());
  const lineRailRowsRef = useRef<PreviewLineRailRow[]>([]);
  const [lineRailRows, setLineRailRows] = useState<PreviewLineRailRow[]>([]);
  const [hoverLineAnnotation, setHoverLineAnnotation] = useState<MarkdownPreviewLineAnnotation | null>(null);
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>(() => ({
    scrollTop: 0,
    viewportHeight: PREVIEW_VIEWPORT_FALLBACK_HEIGHT,
  }));
  const [frontmatterPreviewHeight, setFrontmatterPreviewHeight] = useState(0);
  const [inlinePreviewBlockMeasurements, setInlinePreviewBlockMeasurements] = useState<PreviewBlockMeasurements>({});
  const showLineGutters = Boolean(onLineAction);
  const stableCommentAnchors = commentAnchors.length > 0 ? commentAnchors : EMPTY_PREVIEW_COMMENT_ANCHORS;
  const stableLineAnnotations = lineAnnotations.length > 0 ? lineAnnotations : EMPTY_PREVIEW_LINE_ANNOTATIONS;
  const renderableBody = useMemo(() => normalizePreviewDocsComponents(body), [body]);
  const previewSearchActive = Boolean(searchQuery.trim()) && !getSearchQueryError(searchQuery, searchOptions);
  const renderableBodyTextChange = renderableBody === body ? bodyTextChange : null;
  const normalizedSourceLineOffset = Math.max(0, Math.floor(sourceLineOffset));
  const frontmatterEndLine = Math.max(1, normalizedSourceLineOffset);
  const previewSourceLineCount = useMemo(
    () => Math.max(1, normalizedSourceLineOffset + getMarkdownLineCount(renderableBody)),
    [normalizedSourceLineOffset, renderableBody],
  );
  const shouldVirtualizePreview =
    largeDocumentMode &&
    renderableBody.trim().length > 0;
  const inlinePreviewBlockIndex = useMemo(
    () =>
      !shouldVirtualizePreview && renderableBody.trim().length > 0
        ? createPreviewBlockIndex(renderableBody)
        : null,
    [renderableBody, shouldVirtualizePreview],
  );
  const measuredInlinePreviewBlockIndex = useMemo(
    () =>
      inlinePreviewBlockIndex
        ? applyPreviewBlockMeasurements(inlinePreviewBlockIndex, inlinePreviewBlockMeasurements)
        : null,
    [inlinePreviewBlockIndex, inlinePreviewBlockMeasurements],
  );
  const [virtualGlobalMarkdownContext, setVirtualGlobalMarkdownContext] = useState<PreviewGlobalMarkdownContext>(() =>
    getPreviewGlobalMarkdownContext(renderableBody),
  );
  const inlineGlobalMarkdownContext = useMemo(
    () => (shouldVirtualizePreview ? null : getPreviewGlobalMarkdownContext(renderableBody)),
    [renderableBody, shouldVirtualizePreview],
  );
  const globalMarkdownContext = inlineGlobalMarkdownContext ?? virtualGlobalMarkdownContext;
  const {
    blockIndex: previewBlockIndex,
    pending: previewBlockIndexPending,
    source: previewBlockIndexSource,
  } = usePreviewBlockIndexWorker(
    renderableBody,
    shouldVirtualizePreview,
    { textChange: renderableBodyTextChange },
  );
  const onBeforePreviewMeasurementsCommit = useCallback(() => {
    capturePreviewViewportAnchorForMeasurementRef.current?.();
  }, []);
  const {
    handlePreviewBlockHeightChange,
    virtualPreviewBlockIndex,
  } = useVirtualPreviewMeasurements({
    onBeforeMeasurementsCommit: onBeforePreviewMeasurementsCommit,
    previewBlockIndex,
  });
  useLayoutEffect(() => {
    const element = frontmatterRef.current;
    if (!element) {
      setFrontmatterPreviewHeight(0);
      return undefined;
    }

    let frameId: number | null = null;
    const measureFrontmatter = () => {
      frameId = null;
      const nextHeight = getElementOuterHeight(element);
      setFrontmatterPreviewHeight((currentHeight) =>
        Math.abs(currentHeight - nextHeight) < 1 ? currentHeight : nextHeight,
      );
    };
    const scheduleMeasure = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(measureFrontmatter);
    };

    scheduleMeasure();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(element);

    return () => {
      resizeObserver?.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [metadata.length]);
  useLayoutEffect(() => {
    const contentElement = contentRef.current;
    if (shouldVirtualizePreview || !contentElement || !inlinePreviewBlockIndex) {
      setInlinePreviewBlockMeasurements((currentMeasurements) =>
        Object.keys(currentMeasurements).length === 0 ? currentMeasurements : {},
      );
      return undefined;
    }

    let frameId: number | null = null;
    const measureInlinePreviewBlocks = () => {
      frameId = null;
      const nextMeasurements = getInlinePreviewBlockMeasurements(
        contentElement,
        inlinePreviewBlockIndex,
        normalizedSourceLineOffset,
      );
      setInlinePreviewBlockMeasurements((currentMeasurements) =>
        getPreviewMeasurementsAreEqual(currentMeasurements, nextMeasurements)
          ? currentMeasurements
          : nextMeasurements,
      );
    };
    const scheduleMeasurement = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(measureInlinePreviewBlocks);
    };

    scheduleMeasurement();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleMeasurement);
    resizeObserver?.observe(contentElement);

    return () => {
      resizeObserver?.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [inlinePreviewBlockIndex, normalizedSourceLineOffset, shouldVirtualizePreview]);
  useLayoutEffect(() => {
    previewViewportBlockIndexRef.current = virtualPreviewBlockIndex;
  });
  const {
    capturePreviewViewportAnchorForMeasurement,
    followEditorPosition,
    handlePreviewScrollEvent,
  } = usePreviewFollowController({
    documentRef,
    frontmatterPreviewHeight,
    onPreviewViewportChange: setPreviewViewport,
    previewBlockIndex: shouldVirtualizePreview ? virtualPreviewBlockIndex : measuredInlinePreviewBlockIndex,
    renderableBody,
    sourceLineCount: previewSourceLineCount,
    sourceLineOffset: normalizedSourceLineOffset,
    shouldVirtualizePreview,
  });
  useLayoutEffect(() => {
    capturePreviewViewportAnchorForMeasurementRef.current = capturePreviewViewportAnchorForMeasurement;
  }, [capturePreviewViewportAnchorForMeasurement]);
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
    if (!shouldVirtualizePreview) {
      return;
    }

    let cancelled = false;
    let cancelIdleTask: (() => void) | null = null;
    const timer = window.setTimeout(() => {
      cancelIdleTask = requestPreviewIdleTask(() => {
        const nextGlobalMarkdownContext = getPreviewGlobalMarkdownContext(renderableBody);
        startTransition(() => {
          if (!cancelled) {
            setVirtualGlobalMarkdownContext(nextGlobalMarkdownContext);
          }
        });
      });
    }, VIRTUAL_GLOBAL_MARKDOWN_CONTEXT_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelIdleTask?.();
    };
  }, [renderableBody, shouldVirtualizePreview]);

  useImperativeHandle(ref, () => ({
    followEditorPosition,
  }), [followEditorPosition]);

  const markdownPreviewComponents = useMemo(
    () =>
      createMarkdownPreviewComponents(
        (commentId) => onOpenCommentRef.current?.(commentId),
        (sourceLineIndex) => onToggleTaskLineRef.current?.(sourceLineIndex),
        previewSearchActive,
        uiCopy,
      ),
    [previewSearchActive, uiCopy],
  );
  const commentAnchorPlugins = useMemo(
    () => (
      commentsEnabled
        ? [createPreviewCommentAnchorPlugin(stableCommentAnchors, activeCommentId, uiCopy)]
        : []
    ),
    [activeCommentId, commentsEnabled, stableCommentAnchors, uiCopy],
  );
  const virtualPreviewSearchMatches = useMemo(
    () =>
      shouldVirtualizePreview && previewSearchActive
        ? getEditorSearchMatches(renderableBody, searchQuery, searchOptions)
        : [],
    [previewSearchActive, renderableBody, searchOptions, searchQuery, shouldVirtualizePreview],
  );
  const previewSearchPlugin = useMemo(
    () =>
      previewSearchActive && !shouldVirtualizePreview
        ? createPreviewSearchPlugin(searchQuery, searchOptions, activeSearchMatchIndex)
        : null,
    [activeSearchMatchIndex, previewSearchActive, searchOptions, searchQuery, shouldVirtualizePreview],
  );
  const rehypePlugins = useMemo(
    () => createPreviewRehypePlugins(commentAnchorPlugins, normalizedSourceLineOffset, { previewSearchPlugin }),
    [commentAnchorPlugins, normalizedSourceLineOffset, previewSearchPlugin],
  );
  const getVirtualBlockRehypePlugins = useCallback<GetVirtualPreviewBlockRehypePlugins>(
    (block, blockCommentAnchors) => {
      const blockCommentPlugins = commentsEnabled
        ? [createPreviewCommentAnchorPlugin(blockCommentAnchors, activeCommentId, uiCopy)]
        : [];
      const blockPreviewSearchPlugin =
        previewSearchActive && shouldVirtualizePreview
          ? createPreviewSearchPlugin(searchQuery, searchOptions, activeSearchMatchIndex, {
              sourceBackedMatches: virtualPreviewSearchMatches,
              sourceOffsetBase: block.startOffset,
            })
          : previewSearchPlugin;
      return createPreviewRehypePlugins(
        blockCommentPlugins,
        normalizedSourceLineOffset + block.startLine - 1,
        { previewSearchPlugin: blockPreviewSearchPlugin, stripFootnoteSection: true },
      );
    },
    [
      activeCommentId,
      activeSearchMatchIndex,
      commentsEnabled,
      normalizedSourceLineOffset,
      previewSearchActive,
      previewSearchPlugin,
      searchOptions,
      searchQuery,
      shouldVirtualizePreview,
      uiCopy,
      virtualPreviewSearchMatches,
    ],
  );
  const getVirtualFootnoteRehypePlugins = useCallback(
    () => createPreviewRehypePlugins([], normalizedSourceLineOffset, {
      stripGeneratedFootnoteReferences: true,
    }),
    [normalizedSourceLineOffset],
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
    if (effectiveLineAnnotations.length === 0) {
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

  const clearPreviewHoverLineAnnotation = useCallback(() => {
    pendingHoverLineRef.current = null;
    if (hoverLineFrameRef.current !== null) {
      window.cancelAnimationFrame(hoverLineFrameRef.current);
      hoverLineFrameRef.current = null;
    }
    setHoverLineAnnotation((current) => (current === null ? current : null));
  }, []);

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

  const handlePreviewPointerLeave = clearPreviewHoverLineAnnotation;

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
      startTransition(() => {
        setPreviewViewport((currentViewport) => {
          if (
            currentViewport.scrollTop === nextViewport.scrollTop &&
            currentViewport.viewportHeight === nextViewport.viewportHeight
          ) {
            return currentViewport;
          }

          const blockIndex = previewViewportBlockIndexRef.current;
          if (
            blockIndex &&
            currentViewport.viewportHeight === nextViewport.viewportHeight
          ) {
            const currentWindow = getPreviewWindow(
              blockIndex,
              currentViewport.scrollTop,
              currentViewport.viewportHeight,
              PREVIEW_VIRTUAL_OVERSCAN,
            );
            const nextWindow = getPreviewWindow(
              blockIndex,
              nextViewport.scrollTop,
              nextViewport.viewportHeight,
              PREVIEW_VIRTUAL_OVERSCAN,
            );
            if (
              currentWindow.startIndex === nextWindow.startIndex &&
              currentWindow.blocks.length === nextWindow.blocks.length
            ) {
              return currentViewport;
            }
          }

          return nextViewport;
        });
      });
    };
    const scheduleViewportUpdate = () => {
      clearPreviewHoverLineAnnotation();
      handlePreviewScrollEvent(scrollSurface);
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
  }, [clearPreviewHoverLineAnnotation, handlePreviewScrollEvent, renderableBody, shouldVirtualizePreview]);

  useLayoutEffect(() => {
    const wasSuspended = wasLineMeasurementSuspendedRef.current;
    wasLineMeasurementSuspendedRef.current = suspendLineMeasurement;

    if (suspendLineMeasurement) {
      return undefined;
    }

    let initialMeasureFrameId: number | null = null;
    let invalidationFrameId: number | null = null;
    const scheduleLineMeasurement = (options: { force?: boolean } = {}) => {
      if (invalidationFrameId !== null) {
        return;
      }

      invalidationFrameId = window.requestAnimationFrame(() => {
        invalidationFrameId = null;
        measurePreviewLineRows(options);
      });
    };

    if (wasSuspended) {
      scheduleLineMeasurement({ force: true });
    } else {
      measurePreviewLineRows();
    }

    const contentElement = contentRef.current;
    if (!contentElement || !showLineGutters) {
      return () => {
        if (initialMeasureFrameId !== null) {
          window.cancelAnimationFrame(initialMeasureFrameId);
        }
        if (invalidationFrameId !== null) {
          window.cancelAnimationFrame(invalidationFrameId);
        }
      };
    }

    const handleLineMeasurementInvalidated = () => scheduleLineMeasurement();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(handleLineMeasurementInvalidated);
    resizeObserver?.observe(contentElement);
    window.addEventListener("resize", handleLineMeasurementInvalidated);
    if (!wasSuspended) {
      initialMeasureFrameId = window.requestAnimationFrame(handleLineMeasurementInvalidated);
    }

    return () => {
      if (initialMeasureFrameId !== null) {
        window.cancelAnimationFrame(initialMeasureFrameId);
      }
      if (invalidationFrameId !== null) {
        window.cancelAnimationFrame(invalidationFrameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleLineMeasurementInvalidated);
    };
  }, [measurePreviewLineRows, showLineGutters, suspendLineMeasurement]);

  useLayoutEffect(() => {
    if (
      !shouldVirtualizePreview ||
      suspendLineMeasurement ||
      !showLineGutters ||
      stableLineAnnotations.length === 0
    ) {
      return undefined;
    }

    let frameId: number | null = null;
    const timeoutId = window.setTimeout(() => {
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        measurePreviewLineRows({ force: true });
      });
    }, VIRTUAL_LINE_MEASUREMENT_SCROLL_IDLE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
    measurePreviewLineRows,
    previewViewport.scrollTop,
    previewViewport.viewportHeight,
    shouldVirtualizePreview,
    showLineGutters,
    stableLineAnnotations.length,
    suspendLineMeasurement,
  ]);

  useLayoutEffect(() => {
    const contentElement = contentRef.current;
    const nextMatchCount =
      previewSearchActive && shouldVirtualizePreview
        ? virtualPreviewSearchMatches.length
        : contentElement?.querySelectorAll(".preview-search-match").length ?? 0;
    onSearchMatchCountChange?.(previewSearchActive ? nextMatchCount : 0);

    if (!previewSearchActive || activeSearchMatchIndex < 0) {
      return undefined;
    }

    let frameId: number | null = window.requestAnimationFrame(() => {
      frameId = null;
      const activeMatchElement = contentRef.current?.querySelector<HTMLElement>(".preview-search-match.active");
      if (activeMatchElement) {
        activeMatchElement.scrollIntoView({ block: "center" });
        return;
      }

      if (!shouldVirtualizePreview) {
        return;
      }

      const activeMatch = virtualPreviewSearchMatches[activeSearchMatchIndex];
      if (!activeMatch) {
        return;
      }

      followEditorPosition({
        atDocumentEnd: false,
        lineNumber: normalizedSourceLineOffset + getLineNumberForOffset(renderableBody, activeMatch.start),
        lineOffsetRatio: 0,
      });
    });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
    activeSearchMatchIndex,
    followEditorPosition,
    normalizedSourceLineOffset,
    onSearchMatchCountChange,
    previewSearchActive,
    previewViewport.scrollTop,
    previewViewport.viewportHeight,
    renderableBody,
    shouldVirtualizePreview,
    virtualPreviewSearchMatches,
  ]);

  return (
    <PreviewLocaleContext.Provider value={uiCopy}>
      <div
        ref={documentRef}
        className={`preview-document ${showLineGutters ? "with-line-gutters" : ""} ${shouldVirtualizePreview ? "virtualized" : ""}`}
        data-preview-index-pending={shouldVirtualizePreview ? String(previewBlockIndexPending) : undefined}
        data-preview-index-source={shouldVirtualizePreview ? previewBlockIndexSource : "inline"}
        onPointerMove={handlePreviewPointerMove}
        onPointerLeave={handlePreviewPointerLeave}
      >
      {showLineGutters && onLineAction && (
        <PreviewLineGutter rows={lineRailRows} onLineAction={onLineAction} copy={uiCopy} />
      )}

      <div ref={contentRef} className="preview-document-content">
        {metadata.length > 0 && (
          <section
            ref={frontmatterRef}
            className="frontmatter-view"
            aria-label={uiCopy.frontmatter}
            data-preview-block-start-line={1}
            data-preview-block-end-line={frontmatterEndLine}
            data-preview-line-start={1}
            data-preview-line-end={frontmatterEndLine}
          >
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
                blockIndex={virtualPreviewBlockIndex}
                commentsEnabled={commentsEnabled}
                components={markdownPreviewComponents}
                commentAnchors={stableCommentAnchors}
                footnoteDefinitions={globalMarkdownContext.footnoteDefinitions}
                footnoteReferences={globalMarkdownContext.footnoteReferences}
                getBlockRehypePlugins={getVirtualBlockRehypePlugins}
                getFootnoteRehypePlugins={getVirtualFootnoteRehypePlugins}
                referenceDefinitions={globalMarkdownContext.referenceDefinitions}
                onBlockHeightChange={handlePreviewBlockHeightChange}
                overscan={PREVIEW_VIRTUAL_OVERSCAN}
                remarkPlugins={MARKDOWN_REMARK_PLUGINS}
                sourceLineOffset={normalizedSourceLineOffset}
                viewport={previewViewport}
              />
            ) : (
              <div
                className={`preview-placeholder ${TABULA_LARGE_DOCUMENT_UX_POLICY.showTransientPreviewStatus ? "" : "quiet"}`}
                aria-hidden={!TABULA_LARGE_DOCUMENT_UX_POLICY.showTransientPreviewStatus}
              >
                {TABULA_LARGE_DOCUMENT_UX_POLICY.showTransientPreviewStatus ? uiCopy.preparingPreview : null}
              </div>
            )
          ) : (
            <ReactMarkdown components={markdownPreviewComponents} rehypePlugins={rehypePlugins} remarkPlugins={MARKDOWN_REMARK_PLUGINS}>
              {renderableBody}
            </ReactMarkdown>
          )
        ) : (
          <div className="preview-empty-state" aria-label={uiCopy.preview}>
            <FileText aria-hidden="true" className="preview-empty-state-icon" size={28} strokeWidth={1.8} />
            <strong>{uiCopy.nothingToPreview}</strong>
            <span>{uiCopy.previewEmptyDescription}</span>
          </div>
        )}
      </div>

      </div>
    </PreviewLocaleContext.Provider>
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

const areSearchOptionsEqual = (
  firstOptions: SearchOptions | undefined,
  secondOptions: SearchOptions | undefined,
) => {
  const first = firstOptions ?? DEFAULT_SEARCH_OPTIONS;
  const second = secondOptions ?? DEFAULT_SEARCH_OPTIONS;
  return (
    first.caseSensitive === second.caseSensitive &&
    first.wholeWord === second.wholeWord &&
    first.regexp === second.regexp
  );
};

const getComparableSourceLineOffset = (sourceLineOffset: number | undefined) =>
  Math.max(0, Math.floor(sourceLineOffset ?? 0));

const areTextChangesEqual = (firstChange: TextChange | null | undefined, secondChange: TextChange | null | undefined) => {
  if (firstChange === secondChange) {
    return true;
  }

  if (!firstChange || !secondChange) {
    return !firstChange && !secondChange;
  }

  return (
    firstChange.docLength === secondChange.docLength &&
    firstChange.lineCount === secondChange.lineCount &&
    firstChange.patches.length === secondChange.patches.length &&
    firstChange.patches.every((firstPatch, index) => {
      const secondPatch = secondChange.patches[index];
      return (
        firstPatch.from === secondPatch.from &&
        firstPatch.to === secondPatch.to &&
        firstPatch.insert === secondPatch.insert
      );
    })
  );
};

const areMarkdownPreviewPropsEqual = (firstProps: MarkdownPreviewProps, secondProps: MarkdownPreviewProps) =>
  firstProps.body === secondProps.body &&
  getComparableSourceLineOffset(firstProps.sourceLineOffset) === getComparableSourceLineOffset(secondProps.sourceLineOffset) &&
  areTextChangesEqual(firstProps.bodyTextChange, secondProps.bodyTextChange) &&
  firstProps.activeCommentId === secondProps.activeCommentId &&
  firstProps.commentsEnabled === secondProps.commentsEnabled &&
  firstProps.largeDocumentMode === secondProps.largeDocumentMode &&
  firstProps.searchQuery === secondProps.searchQuery &&
  firstProps.activeSearchMatchIndex === secondProps.activeSearchMatchIndex &&
  firstProps.onSearchMatchCountChange === secondProps.onSearchMatchCountChange &&
  firstProps.suspendLineMeasurement === secondProps.suspendLineMeasurement &&
  firstProps.uiLanguage === secondProps.uiLanguage &&
  firstProps.onLineAction === secondProps.onLineAction &&
  firstProps.onOpenComment === secondProps.onOpenComment &&
  firstProps.onToggleTaskLine === secondProps.onToggleTaskLine &&
  areSearchOptionsEqual(firstProps.searchOptions, secondProps.searchOptions) &&
  arePreviewMetadataEqual(firstProps.metadata, secondProps.metadata) &&
  arePreviewCommentAnchorsEqual(firstProps.commentAnchors, secondProps.commentAnchors) &&
  arePreviewLineAnnotationsEqual(firstProps.lineAnnotations, secondProps.lineAnnotations);

const ForwardedMarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(MarkdownPreviewComponent);
ForwardedMarkdownPreview.displayName = "MarkdownPreview";

export const MarkdownPreview = memo(ForwardedMarkdownPreview, areMarkdownPreviewPropsEqual);
MarkdownPreview.displayName = "MarkdownPreview";
