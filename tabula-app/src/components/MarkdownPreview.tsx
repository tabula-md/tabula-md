import {
  forwardRef,
  memo,
  startTransition,
  useCallback,
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
import ReactMarkdown, { type Components } from "react-markdown";
import {
  areLineSurfaceRowsEqual,
  applyPreviewBlockMeasurements,
  buildLineSurfaceAnnotationRows,
  createPreviewBlockIndex,
  getLineNumberForOffset,
  getLineSurfaceAnnotationsSignature,
  getMarkdownLineCount,
  getPreviewWindow,
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
import { classifyMarkdownHref } from "../preview/markdownHref";
import {
  getWorkspaceSurfaceCopy,
  type WorkspaceSurfaceCopy,
} from "../workspaceSurfaceLocale";
import {
  PreviewLineGutter,
  getPreviewBodyHash,
  getPreviewWidthBucket,
  writePreviewLineMeasurementCache,
  type PreviewLineRailRow,
} from "../preview/PreviewLineGutter";
import type {
  MarkdownPreviewCommentAnchor,
  MarkdownPreviewLineAnnotation,
  MarkdownPreviewMetadata,
  MarkdownPreviewProps,
} from "../preview/markdownPreviewTypes";
import { transformMarkdownPreviewUrl } from "../preview/markdownPreviewUrl";
import { MARKDOWN_REMARK_PLUGINS } from "../preview/markdownRemarkPlugins";
import {
  createPreviewCommentAnchorPlugin,
  createPreviewRehypePlugins,
  createPreviewSearchPlugin,
} from "../preview/markdownRehypePlugins";
import {
  getCodeLanguage,
  getNodeText,
  hasCodeClass,
  PreviewCodeBlock,
  PreviewEmbeddedImageSourcesContext,
  PreviewImage,
  PreviewLocaleContext,
  PreviewMath,
  requestPreviewIdleTask,
} from "../preview/PreviewAsyncBlocks";
import {
  getElementOuterHeight,
  getInlinePreviewBlockMeasurements,
  getPreviewMeasurementsAreEqual,
} from "../preview/previewMeasurements";
import {
  getPreviewGlobalMarkdownContext,
  type PreviewGlobalMarkdownContext,
} from "../preview/previewGlobalMarkdownContext";

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

const EMPTY_MARKDOWN_PREVIEW_METADATA: MarkdownPreviewMetadata[] = [];
const EMPTY_PREVIEW_COMMENT_ANCHORS: MarkdownPreviewCommentAnchor[] = [];
const EMPTY_PREVIEW_LINE_ANNOTATIONS: MarkdownPreviewLineAnnotation[] = [];

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
  if (!markdown.includes("<")) {
    return markdown;
  }

  const docsComponentPattern = /<\/?(?:CardGroup|Card|Frame)(?=[\s>/])/;
  if (!docsComponentPattern.test(markdown)) {
    return markdown;
  }

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
  const resolvedHref = typeof href === "string" ? classifyMarkdownHref(href) : null;
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

  if (!href || resolvedHref?.kind !== "external") {
    return <div {...sourceProps} className={className}>{cardBody}</div>;
  }

  return (
    <a
      {...sourceProps}
      className={className}
      href={resolvedHref?.href}
      target={resolvedHref?.openInNewTab ? "_blank" : undefined}
      rel={resolvedHref?.openInNewTab ? "noreferrer" : undefined}
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

const createMarkdownPreviewComponents = (
  onOpenComment?: (commentId: string) => void,
  onToggleTaskLine?: (sourceLineIndex: number) => void,
  searchActive = false,
  copy: WorkspaceSurfaceCopy = getWorkspaceSurfaceCopy("en"),
): Components => ({
  ...PREVIEW_DOCS_COMPONENTS,
  a: ({ node: _node, href, ...props }) => {
    const resolvedHref = typeof href === "string" ? classifyMarkdownHref(href) : null;

    if (resolvedHref?.kind !== "external") {
      return <span {...props} />;
    }

    return (
      <a
        {...props}
        href={resolvedHref?.href}
        target={resolvedHref?.openInNewTab ? "_blank" : undefined}
        rel={resolvedHref?.openInNewTab ? "noreferrer" : undefined}
      />
    );
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

const PREVIEW_VIRTUAL_OVERSCAN = 1_200;
const VIRTUAL_GLOBAL_MARKDOWN_CONTEXT_DELAY_MS = 6_000;
const VIRTUAL_LINE_MEASUREMENT_SCROLL_IDLE_MS = 140;

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
    getViewportLineAnchor,
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
    getViewportLineAnchor,
  }), [followEditorPosition, getViewportLineAnchor]);

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
  const bodyMeasurementKey = useMemo(() => getPreviewBodyHash(renderableBody), [renderableBody]);
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

    const widthBucket = getPreviewWidthBucket(contentElement.clientWidth);
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
      <PreviewEmbeddedImageSourcesContext.Provider value={globalMarkdownContext.embeddedImageSources}>
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
                    globalMarkdownContext={globalMarkdownContext}
                    getBlockRehypePlugins={getVirtualBlockRehypePlugins}
                    getFootnoteRehypePlugins={getVirtualFootnoteRehypePlugins}
                    onBlockHeightChange={handlePreviewBlockHeightChange}
                    overscan={PREVIEW_VIRTUAL_OVERSCAN}
                    remarkPlugins={MARKDOWN_REMARK_PLUGINS}
                    sourceLineOffset={normalizedSourceLineOffset}
                    viewport={previewViewport}
                    urlTransform={transformMarkdownPreviewUrl}
                  />
                ) : (
                  <div className="preview-placeholder quiet" aria-hidden="true" />
                )
              ) : (
                <ReactMarkdown
                  components={markdownPreviewComponents}
                  rehypePlugins={rehypePlugins}
                  remarkPlugins={MARKDOWN_REMARK_PLUGINS}
                  urlTransform={transformMarkdownPreviewUrl}
                >
                  {renderableBody}
                </ReactMarkdown>
              )
            ) : (
              <p className="preview-empty-state" aria-label={uiCopy.preview}>
                {uiCopy.nothingToPreview}
              </p>
            )}
          </div>
        </div>
      </PreviewEmbeddedImageSourcesContext.Provider>
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
