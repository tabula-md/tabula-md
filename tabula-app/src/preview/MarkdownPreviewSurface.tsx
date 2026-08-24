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
  type ForwardedRef,
  type PointerEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import {
  areLineSurfaceRowsEqual,
  applyPreviewBlockMeasurements,
  buildLineSurfaceAnnotationRows,
  createPreviewBlockIndex,
  getLineNumberForOffset,
  getLineSurfaceAnnotationsSignature,
  getMarkdownLineCount,
  type LineSurfaceSourceBlock,
  type PreviewBlockMeasurements,
} from "@tabula-md/tabula";
import {
  DEFAULT_SEARCH_OPTIONS,
  getSearchQueryError,
} from "../editor/editorSearchModel";
import {
  PREVIEW_VIEWPORT_FALLBACK_HEIGHT,
  usePreviewFollowController,
  type PreviewViewport,
} from "./usePreviewFollowController";
import { usePreviewBlockIndexWorker } from "./usePreviewBlockIndexWorker";
import { useVirtualPreviewMeasurements } from "./useVirtualPreviewMeasurements";
import { VirtualMarkdownPreview } from "./VirtualMarkdownPreview";
import {
  getWorkspaceSurfaceCopy,
} from "../workspace/workspaceSurfaceLocale";
import {
  PreviewLineGutter,
  getPreviewBodyHash,
  getPreviewWidthBucket,
  writePreviewLineMeasurementCache,
  type PreviewLineRailRow,
} from "./PreviewLineGutter";
import type {
  MarkdownPreviewCommentAnchor,
  MarkdownPreviewLineAnnotation,
  MarkdownPreviewProps,
} from "./markdownPreviewTypes";
import type { MarkdownPreviewHandle } from "./previewSyncTypes";
import { transformMarkdownPreviewUrl } from "./markdownPreviewUrl";
import { MARKDOWN_REMARK_PLUGINS } from "./markdownRemarkPlugins";
import {
  PreviewEmbeddedImageSourcesContext,
  PreviewLocaleContext,
  requestPreviewIdleTask,
} from "./PreviewAsyncBlocks";
import {
  getInlinePreviewBlockMeasurements,
  getPreviewMeasurementsAreEqual,
} from "./previewMeasurements";
import {
  getPreviewGlobalMarkdownContext,
  type PreviewGlobalMarkdownContext,
} from "./previewGlobalMarkdownContext";
import { normalizePreviewDocsComponents } from "./previewDocsCompatibility";
import { useMarkdownPreviewRenderModel } from "./useMarkdownPreviewRenderModel";
import {
  PREVIEW_VIRTUAL_OVERSCAN,
  usePreviewVirtualizationController,
} from "./usePreviewVirtualizationController";

const EMPTY_PREVIEW_COMMENT_ANCHORS: MarkdownPreviewCommentAnchor[] = [];
const EMPTY_PREVIEW_LINE_ANNOTATIONS: MarkdownPreviewLineAnnotation[] = [];

const VIRTUAL_GLOBAL_MARKDOWN_CONTEXT_DELAY_MS = 6_000;
const VIRTUAL_LINE_MEASUREMENT_SCROLL_IDLE_MS = 140;

function MarkdownPreviewComponent({
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
  onOpenWorkspaceLink,
  sourceDocumentId,
  resolveWorkspaceDocument,
  resolveWorkspaceLink,
  onToggleTaskLine,
}: MarkdownPreviewProps, ref: ForwardedRef<MarkdownPreviewHandle>) {
  const uiCopy = getWorkspaceSurfaceCopy(uiLanguage);
  const documentRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const wasLineMeasurementSuspendedRef = useRef(suspendLineMeasurement);
  const hoverLineFrameRef = useRef<number | null>(null);
  const pendingHoverLineRef = useRef<{ clientY: number; target: EventTarget | null } | null>(null);
  const capturePreviewViewportAnchorForMeasurementRef = useRef<(() => void) | null>(null);
  const lineMeasurementCacheRef = useRef(new Map<string, PreviewLineRailRow[]>());
  const lineRailRowsRef = useRef<PreviewLineRailRow[]>([]);
  const [lineRailRows, setLineRailRows] = useState<PreviewLineRailRow[]>([]);
  const [hoverLineAnnotation, setHoverLineAnnotation] = useState<MarkdownPreviewLineAnnotation | null>(null);
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>(() => ({
    scrollTop: 0,
    viewportHeight: PREVIEW_VIEWPORT_FALLBACK_HEIGHT,
  }));
  const [inlinePreviewBlockMeasurements, setInlinePreviewBlockMeasurements] = useState<PreviewBlockMeasurements>({});
  const showLineGutters = Boolean(onLineAction);
  const stableCommentAnchors = commentAnchors.length > 0 ? commentAnchors : EMPTY_PREVIEW_COMMENT_ANCHORS;
  const stableLineAnnotations = lineAnnotations.length > 0 ? lineAnnotations : EMPTY_PREVIEW_LINE_ANNOTATIONS;
  const renderableBody = useMemo(() => normalizePreviewDocsComponents(body), [body]);
  const previewSearchActive = Boolean(searchQuery.trim()) && !getSearchQueryError(searchQuery, searchOptions);
  const renderableBodyTextChange = renderableBody === body ? bodyTextChange : null;
  const normalizedSourceLineOffset = Math.max(0, Math.floor(sourceLineOffset));
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
  const {
    capturePreviewViewportAnchorForMeasurement,
    followEditorPosition,
    getViewportLineAnchor,
    handlePreviewScrollEvent,
  } = usePreviewFollowController({
    documentRef,
    frontmatterPreviewHeight: 0,
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

  const {
    getVirtualBlockRehypePlugins,
    getVirtualFootnoteRehypePlugins,
    markdownPreviewComponents,
    rehypePlugins,
    virtualPreviewSearchMatches,
    virtualPreviewSearchResult,
  } = useMarkdownPreviewRenderModel({
    activeCommentId,
    activeSearchMatchIndex,
    commentsEnabled,
    normalizedSourceLineOffset,
    onOpenComment,
    onOpenWorkspaceLink,
    onToggleTaskLine,
    previewSearchActive,
    renderableBody,
    resolveWorkspaceDocument,
    resolveWorkspaceLink,
    searchOptions,
    searchQuery,
    shouldVirtualizePreview,
    sourceDocumentId,
    stableCommentAnchors,
    uiCopy,
  });
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
  usePreviewVirtualizationController({
    clearHoverLineAnnotation: clearPreviewHoverLineAnnotation,
    documentRef,
    handlePreviewScrollEvent,
    renderableBody,
    setPreviewViewport,
    shouldVirtualizePreview,
    virtualPreviewBlockIndex,
  });

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
    onSearchMatchCountChange?.(
      previewSearchActive ? nextMatchCount : 0,
      previewSearchActive && shouldVirtualizePreview ? virtualPreviewSearchResult.truncated : false,
    );

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
    virtualPreviewSearchResult.truncated,
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
              <p className="ui-empty-state preview-empty-state" aria-label={uiCopy.preview}>
                {uiCopy.nothingToPreview}
              </p>
            )}
          </div>
        </div>
      </PreviewEmbeddedImageSourcesContext.Provider>
    </PreviewLocaleContext.Provider>
  );
}

const ForwardedMarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(MarkdownPreviewComponent);
ForwardedMarkdownPreview.displayName = "MarkdownPreview";

export const MarkdownPreview = memo(ForwardedMarkdownPreview);
MarkdownPreview.displayName = "MarkdownPreview";
