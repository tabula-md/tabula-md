import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import {
  buildSourceScrollSegments,
  choosePreviewRenderableAnchor,
  getPreviewScrollTopForSourcePosition,
  resolveSourcePosition,
  type EditorScrollPosition,
  type PreviewBlockIndex,
  type PreviewRenderableAnchor,
  type SourceScrollMap,
} from "@tabula-md/tabula";
import type { SplitPreviewMode } from "./previewSyncTypes";

export type PreviewViewport = {
  scrollTop: number;
  viewportHeight: number;
};

type PreviewDomAnchor = PreviewRenderableAnchor & {
  element: HTMLElement;
};

type PreviewViewportDomAnchor = {
  lineNumber: number;
  viewportOffsetPx: number;
};

type PreviewElementSourceRange = {
  endLine: number;
  startLine: number;
};

type UsePreviewFollowControllerArgs = {
  documentRef: RefObject<HTMLElement | null>;
  frontmatterPreviewHeight: number;
  onPreviewViewportChange: (viewport: PreviewViewport) => void;
  previewBlockIndex: PreviewBlockIndex | null;
  renderableBody: string;
  sourceLineCount: number;
  sourceLineOffset: number;
  shouldVirtualizePreview: boolean;
};

export const PREVIEW_VIEWPORT_FALLBACK_HEIGHT = 720;

const PREVIEW_ANCHOR_EDGE_PADDING = 32;

export const getPreviewScrollSurface = (documentElement: HTMLElement | null) =>
  documentElement?.closest<HTMLElement>(".preview-surface") ?? null;

export const getPreviewViewport = (documentElement: HTMLElement | null): PreviewViewport => {
  const scrollSurface = getPreviewScrollSurface(documentElement);
  return {
    scrollTop: scrollSurface?.scrollTop ?? 0,
    viewportHeight: scrollSurface?.clientHeight ?? PREVIEW_VIEWPORT_FALLBACK_HEIGHT,
  };
};

const clampPreviewScrollTop = (scrollSurface: HTMLElement, scrollTop: number) => {
  const scrollableDistance = Math.max(0, scrollSurface.scrollHeight - scrollSurface.clientHeight);
  return Math.max(0, Math.min(scrollableDistance, scrollTop));
};

const getPreviewElementSourceRange = (element: HTMLElement): PreviewElementSourceRange | null => {
  const startLine = Number(element.dataset.previewLineStart ?? element.dataset.previewBlockStartLine);
  const endLine = Number(element.dataset.previewLineEnd ?? element.dataset.previewBlockEndLine);
  if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) {
    return null;
  }

  return {
    endLine: Math.max(startLine, endLine),
    startLine,
  };
};

const getPreviewElementRenderedHeight = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return Math.max(rect.height, element.scrollHeight);
};

const findNearestPreviewDomAnchor = (
  scrollSurface: HTMLElement,
  sourceLineNumber: number,
  options: { blockOnly?: boolean } = {},
): PreviewDomAnchor | null => {
  const targetLine = Math.max(1, Math.floor(sourceLineNumber));
  const elements = Array.from(
    scrollSurface.querySelectorAll<HTMLElement>(
      options.blockOnly
        ? "[data-preview-block-start-line]"
        : "[data-preview-line-start], [data-preview-block-start-line]",
    ),
  );
  const candidates = elements.map((element): PreviewDomAnchor | null => {
    const range = getPreviewElementSourceRange(element);
    if (!range) {
      return null;
    }

    const height = getPreviewElementRenderedHeight(element);
    return {
      element,
      ...range,
      rendered: height > 0,
      sourceElement: element.hasAttribute("data-preview-line-start"),
    };
  }).filter((candidate): candidate is PreviewDomAnchor => Boolean(candidate));

  return choosePreviewRenderableAnchor(candidates, targetLine);
};

const readPreviewViewportDomAnchor = (scrollSurface: HTMLElement): PreviewViewportDomAnchor | null => {
  const surfaceRect = scrollSurface.getBoundingClientRect();
  const blockElements = Array.from(scrollSurface.querySelectorAll<HTMLElement>("[data-preview-block-start-line]"));
  const elements =
    blockElements.length > 0
      ? blockElements
      : Array.from(scrollSurface.querySelectorAll<HTMLElement>("[data-preview-line-start]"));
  const visibleAnchors = elements
    .map((element) => {
      const range = getPreviewElementSourceRange(element);
      if (!range) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      const rendered = Math.max(rect.height, element.scrollHeight) > 0;
      const visible = rendered && rect.bottom > surfaceRect.top + 8 && rect.top < surfaceRect.bottom - 8;
      if (!visible) {
        return null;
      }

      return {
        lineNumber: range.startLine,
        viewportOffsetPx: rect.top - surfaceRect.top,
      };
    })
    .filter((anchor): anchor is PreviewViewportDomAnchor => Boolean(anchor));

  return visibleAnchors[0] ?? null;
};

const getPreviewDomAnchorScrollTop = (
  scrollSurface: HTMLElement,
  anchorElement: HTMLElement,
  position: EditorScrollPosition,
) => {
  const surfaceRect = scrollSurface.getBoundingClientRect();
  const anchorRect = anchorElement.getBoundingClientRect();
  const currentScrollTop = scrollSurface.scrollTop;

  if (position.atDocumentEnd) {
    return clampPreviewScrollTop(
      scrollSurface,
      currentScrollTop + anchorRect.bottom - surfaceRect.bottom + PREVIEW_ANCHOR_EDGE_PADDING,
    );
  }

  const range = getPreviewElementSourceRange(anchorElement);
  const lineCount = range ? Math.max(1, range.endLine - range.startLine + 1) : 1;
  const lineProgress = range
    ? Math.max(0, Math.min(lineCount, position.lineNumber - range.startLine + position.lineOffsetRatio)) / lineCount
    : 0;
  const blockOffset = anchorRect.height * lineProgress;

  return clampPreviewScrollTop(
    scrollSurface,
    currentScrollTop + anchorRect.top + blockOffset - surfaceRect.top - PREVIEW_ANCHOR_EDGE_PADDING,
  );
};

export const usePreviewFollowController = ({
  documentRef,
  frontmatterPreviewHeight,
  onPreviewViewportChange,
  previewBlockIndex,
  renderableBody,
  sourceLineCount,
  sourceLineOffset,
  shouldVirtualizePreview,
}: UsePreviewFollowControllerArgs) => {
  const splitPreviewModeRef = useRef<SplitPreviewMode>({ kind: "preview-free" });
  const pendingProgrammaticPreviewScrollTopRef = useRef<number | null>(null);
  const pendingFollowAfterMapReadyRef = useRef(false);
  const pendingPreviewViewportAnchorRef = useRef<PreviewViewportDomAnchor | null>(null);
  const lastRenderableBodyRef = useRef<string | null>(null);
  const sourceScrollMapRef = useRef<SourceScrollMap | null>(null);
  const shouldVirtualizePreviewRef = useRef(false);

  const applyPreviewScrollTop = useCallback((scrollSurface: HTMLElement, nextScrollTop: number) => {
    const clampedScrollTop = clampPreviewScrollTop(scrollSurface, nextScrollTop);
    if (Math.abs(scrollSurface.scrollTop - clampedScrollTop) > 1) {
      pendingProgrammaticPreviewScrollTopRef.current = clampedScrollTop;
      scrollSurface.scrollTop = clampedScrollTop;
    } else {
      pendingProgrammaticPreviewScrollTopRef.current = null;
    }
    onPreviewViewportChange({
      scrollTop: clampedScrollTop,
      viewportHeight: scrollSurface.clientHeight || PREVIEW_VIEWPORT_FALLBACK_HEIGHT,
    });
  }, [onPreviewViewportChange]);

  const followPreviewPosition = useCallback((position: EditorScrollPosition) => {
    const scrollSurface = getPreviewScrollSurface(documentRef.current);
    if (!scrollSurface) {
      return false;
    }
    const sourceScrollMap = sourceScrollMapRef.current;
    if (sourceScrollMap) {
      pendingFollowAfterMapReadyRef.current = false;
      const sourcePosition = resolveSourcePosition(position, sourceScrollMap);
      const target = getPreviewScrollTopForSourcePosition(
        sourceScrollMap,
        sourcePosition,
        {
          edgePadding: PREVIEW_ANCHOR_EDGE_PADDING,
          viewportHeight: scrollSurface.clientHeight || PREVIEW_VIEWPORT_FALLBACK_HEIGHT,
        },
      );
      const maximumScrollTop = Math.max(
        0,
        scrollSurface.scrollHeight - scrollSurface.clientHeight,
      );
      const remainsClampedAtEnd =
        !sourcePosition.atDocumentEnd &&
        maximumScrollTop > 0 &&
        target.scrollTop >= maximumScrollTop - 1;
      const nextScrollTop = remainsClampedAtEnd
        ? maximumScrollTop * sourcePosition.sourceProgress
        : target.scrollTop;
      applyPreviewScrollTop(scrollSurface, nextScrollTop);
      return true;
    }

    pendingFollowAfterMapReadyRef.current = true;
    const domAnchor = findNearestPreviewDomAnchor(scrollSurface, position.lineNumber);
    if (!domAnchor) {
      return false;
    }

    applyPreviewScrollTop(scrollSurface, getPreviewDomAnchorScrollTop(scrollSurface, domAnchor.element, position));
    return true;
  }, [applyPreviewScrollTop, documentRef]);

  const capturePreviewViewportAnchorForMeasurement = useCallback(() => {
    const scrollSurface = getPreviewScrollSurface(documentRef.current);
    if (scrollSurface) {
      pendingPreviewViewportAnchorRef.current = readPreviewViewportDomAnchor(scrollSurface);
    }
  }, [documentRef]);

  const followEditorPosition = useCallback((position: EditorScrollPosition) => {
    const normalizedPosition: EditorScrollPosition = {
      atDocumentEnd: position.atDocumentEnd,
      lineNumber: Math.max(1, Math.floor(position.lineNumber)),
      lineOffsetRatio: Math.max(0, Math.min(1, position.lineOffsetRatio)),
    };
    splitPreviewModeRef.current = { kind: "editor-follow", latestEditorPosition: normalizedPosition };
    pendingPreviewViewportAnchorRef.current = null;
    followPreviewPosition(normalizedPosition);
  }, [followPreviewPosition]);

  const handlePreviewScrollEvent = useCallback((scrollSurface: HTMLElement) => {
    const pendingProgrammaticScrollTop = pendingProgrammaticPreviewScrollTopRef.current;
    const isProgrammaticScrollEvent =
      pendingProgrammaticScrollTop !== null &&
      Math.abs(scrollSurface.scrollTop - pendingProgrammaticScrollTop) <= 1;
    pendingProgrammaticPreviewScrollTopRef.current = null;
    if (!isProgrammaticScrollEvent) {
      splitPreviewModeRef.current = { kind: "preview-free" };
    }
  }, []);

  useLayoutEffect(() => {
    const normalizedSourceLineOffset = Math.max(0, Math.floor(sourceLineOffset));
    shouldVirtualizePreviewRef.current = shouldVirtualizePreview;
    sourceScrollMapRef.current =
      previewBlockIndex
        ? buildSourceScrollSegments(renderableBody, previewBlockIndex, {
            frontmatterLineCount: normalizedSourceLineOffset,
            frontmatterMeasuredHeight: frontmatterPreviewHeight,
            sourceLineCount,
            sourceLineOffset: normalizedSourceLineOffset,
          })
        : null;
  });

  useLayoutEffect(() => {
    if (lastRenderableBodyRef.current === null) {
      lastRenderableBodyRef.current = renderableBody;
      return;
    }

    if (lastRenderableBodyRef.current === renderableBody) {
      return;
    }

    lastRenderableBodyRef.current = renderableBody;
    const scrollSurface = getPreviewScrollSurface(documentRef.current);
    if (scrollSurface && shouldVirtualizePreview) {
      pendingPreviewViewportAnchorRef.current = readPreviewViewportDomAnchor(scrollSurface);
    }
  }, [documentRef, renderableBody, shouldVirtualizePreview]);

  useLayoutEffect(() => {
    const pendingViewportAnchor = pendingPreviewViewportAnchorRef.current;
    if (pendingViewportAnchor && shouldVirtualizePreview && previewBlockIndex) {
      pendingPreviewViewportAnchorRef.current = null;
      const scrollSurface = getPreviewScrollSurface(documentRef.current);
      if (!scrollSurface) {
        return;
      }

      const domAnchor = findNearestPreviewDomAnchor(scrollSurface, pendingViewportAnchor.lineNumber, {
        blockOnly: shouldVirtualizePreviewRef.current,
      });
      if (!domAnchor) {
        return;
      }

      const surfaceRect = scrollSurface.getBoundingClientRect();
      const anchorRect = domAnchor.element.getBoundingClientRect();
      const nextScrollTop = clampPreviewScrollTop(
        scrollSurface,
        scrollSurface.scrollTop + anchorRect.top - surfaceRect.top - pendingViewportAnchor.viewportOffsetPx,
      );
      if (Math.abs(scrollSurface.scrollTop - nextScrollTop) <= 1) {
        return;
      }

      applyPreviewScrollTop(scrollSurface, nextScrollTop);
      return;
    }

    const splitPreviewMode = splitPreviewModeRef.current;
    if (pendingFollowAfterMapReadyRef.current && splitPreviewMode.kind === "editor-follow") {
      followPreviewPosition(splitPreviewMode.latestEditorPosition);
    }
  }, [
    applyPreviewScrollTop,
    documentRef,
    followPreviewPosition,
    previewBlockIndex,
    shouldVirtualizePreview,
  ]);

  return {
    capturePreviewViewportAnchorForMeasurement,
    followEditorPosition,
    handlePreviewScrollEvent,
  };
};
