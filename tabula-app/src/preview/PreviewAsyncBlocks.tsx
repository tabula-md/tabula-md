import {
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Check, Copy, ImageOff, Slash, WrapText } from "lucide-react";
import { BoundedStringCache, replaceAllText } from "./previewRenderCache";
import { classifyMarkdownImageSource } from "./markdownImageSource";
import { getWorkspaceSurfaceCopy, type WorkspaceSurfaceCopy } from "../workspace/workspaceSurfaceLocale";

export const getNodeText = (node: ReactNode): string => {
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

const MERMAID_CACHE_ID_PLACEHOLDER = "__TABULA_MERMAID_ID__";
const katexRenderCache = new BoundedStringCache({
  maxBytes: 2 * 1024 * 1024,
  maxEntries: 256,
  maxEntryBytes: 128 * 1024,
});
const mermaidSvgCache = new BoundedStringCache({
  maxBytes: 4 * 1024 * 1024,
  maxEntries: 48,
  maxEntryBytes: 512 * 1024,
});
const syntaxHighlightCache = new BoundedStringCache({
  maxBytes: 8 * 1024 * 1024,
  maxEntries: 256,
  maxEntryBytes: 1024 * 1024,
});

export const requestPreviewIdleTask = (callback: () => void) => {
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

export const getCodeLanguage = (className = "") =>
  className.match(/(?:^|\s)language-([A-Za-z0-9_-]+)/)?.[1]?.toLowerCase();

export const hasCodeClass = (className: string | undefined, targetClassName: string) =>
  Boolean(className?.split(/\s+/).includes(targetClassName));

export const MATH_FENCE_LANGUAGES = new Set(["katex", "latex", "math", "tex"]);

const isMathDisplayCode = (className: string | undefined, language: string | undefined) =>
  (language ? MATH_FENCE_LANGUAGES.has(language) : false) || hasCodeClass(className, "math-display");

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

export const PreviewLocaleContext = createContext<WorkspaceSurfaceCopy>(
  getWorkspaceSurfaceCopy("en"),
);
export const PreviewEmbeddedImageSourcesContext = createContext<Readonly<Record<string, string>>>({});

export function PreviewMath({ blockProps, copy, displayMode = false, expression }: PreviewMathProps) {
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

    const cachedHtml = katexRenderCache.read(cacheKey);
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
          katexRenderCache.write(cacheKey, html);
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
    const cachedSvg = mermaidSvgCache.read(cacheKey);
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
          mermaidSvgCache.write(cacheKey, cachedTemplate);
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

export function PreviewImage({ alt = "", copy: copyProp, src, title, ...props }: PreviewImageProps) {
  const contextCopy = useContext(PreviewLocaleContext);
  const embeddedImageSources = useContext(PreviewEmbeddedImageSourcesContext);
  const copy = copyProp ?? contextCopy;
  const resolvedSrc = src ? embeddedImageSources[src] ?? src : src;
  const imageSource = useMemo(() => classifyMarkdownImageSource(resolvedSrc), [resolvedSrc]);
  const [hasError, setHasError] = useState(false);
  useEffect(() => setHasError(false), [imageSource]);

  if (imageSource.kind === "placeholder") {
    return null;
  }

  if (imageSource.kind === "local" || imageSource.kind === "unsupported") {
    const errorLabel = imageSource.kind === "local" ? copy.localImageUnavailable : copy.imageFailed;
    return (
      <span
        className="preview-image-error preview-image-unavailable"
        data-image-state={imageSource.kind}
        role="img"
        aria-label={alt ? `${errorLabel}: ${alt}` : errorLabel}
      >
        <ImageOff aria-hidden="true" size={16} />
        <span className="preview-image-error-title">{errorLabel}</span>
        {alt && <span className="preview-image-error-alt">— {alt}</span>}
      </span>
    );
  }

  return (
    <span className={`preview-image-frame ${hasError ? "broken" : ""}`} title={title}>
      <img
        {...props}
        alt={alt}
        aria-hidden={hasError ? "true" : undefined}
        className="preview-image"
        data-load-state={hasError ? "error" : "ready"}
        loading="lazy"
        referrerPolicy={imageSource.kind === "remote" ? "no-referrer" : undefined}
        src={imageSource.src}
        onError={() => setHasError(true)}
      />
      {hasError && (
        <span
          className="preview-image-error preview-image-fallback"
          data-image-state="failed"
          role="img"
          aria-label={alt ? `${copy.imageFailed}: ${alt}` : copy.imageFailed}
        >
          <ImageOff aria-hidden="true" size={16} />
          <span className="preview-image-error-title">{copy.imageFailed}</span>
          {alt && <span className="preview-image-error-alt">— {alt}</span>}
        </span>
      )}
    </span>
  );
}


export function PreviewCodeBlock({ children, copy, searchActive = false, ...props }: PreviewCodeBlockProps) {
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

    const cachedHtml = syntaxHighlightCache.read(highlightKey);
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
          syntaxHighlightCache.write(highlightKey, html);
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
