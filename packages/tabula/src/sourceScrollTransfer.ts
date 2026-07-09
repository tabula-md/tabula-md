import {
  getMarkdownLineCount,
  type PreviewBlock,
  type PreviewBlockIndex,
  type PreviewBlockKind,
  type PreviewBlockMeasurements,
} from "./previewBlockModel";

export type EditorScrollPosition = {
  atDocumentEnd: boolean;
  lineNumber: number;
  lineOffsetRatio: number;
};

export type PreviewScrollTarget = {
  clamped: boolean;
  scrollTop: number;
  sourceLineNumber: number;
  sourceProgress: number;
};

export type SourceScrollSegmentKind = PreviewBlockKind | "document-end" | "frontmatter";

export type SourceScrollSegment = {
  blockId?: string;
  id: string;
  kind: SourceScrollSegmentKind;
  measured: boolean;
  previewHeight: number;
  previewTop: number;
  renderable: boolean;
  sourceEndLine: number;
  sourceStartLine: number;
};

export type SourceScrollMap = {
  lineCount: number;
  segments: SourceScrollSegment[];
  totalPreviewHeight: number;
};

export type SourceScrollPosition = {
  atDocumentEnd: boolean;
  lineNumber: number;
  lineOffsetRatio: number;
  segmentId: string | null;
  segmentProgress: number;
  sourceProgress: number;
};

export type BuildSourceScrollSegmentsMetadata = {
  frontmatterEstimatedHeight?: number;
  frontmatterLineCount?: number;
  frontmatterMeasuredHeight?: number;
  sourceLineCount?: number;
  sourceLineOffset?: number;
};

export type SourceScrollTransferViewport = {
  edgePadding?: number;
  viewportHeight: number;
};

const DEFAULT_FRONTMATTER_ESTIMATED_HEIGHT = 96;
const DEFAULT_EDGE_PADDING = 32;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const normalizeLineNumber = (lineNumber: number, lineCount: number) =>
  clamp(Number.isFinite(lineNumber) ? Math.floor(lineNumber) : 1, 1, Math.max(1, lineCount));

const normalizeRatio = (ratio: number) =>
  clamp(Number.isFinite(ratio) ? ratio : 0, 0, 1);

const normalizeHeight = (height: number | undefined, fallback = 0) => {
  const normalizedHeight = height ?? fallback;
  return Number.isFinite(normalizedHeight) ? Math.max(0, normalizedHeight) : Math.max(0, fallback);
};

const isPreviewBlockRenderableForTransfer = (block: PreviewBlock, previewHeight: number) =>
  block.kind !== "blank" && previewHeight > 0;

const clampPreviewScrollTop = (scrollTop: number, totalHeight: number, viewportHeight: number) => {
  const scrollableDistance = Math.max(0, totalHeight - Math.max(1, viewportHeight));
  const clampedScrollTop = clamp(scrollTop, 0, scrollableDistance);
  return {
    clamped: Math.abs(clampedScrollTop - scrollTop) > 0.5,
    scrollTop: clampedScrollTop,
  };
};

const getSourceProgress = (lineNumber: number, lineOffsetRatio: number, lineCount: number) => {
  if (lineCount <= 1) {
    return lineOffsetRatio >= 1 ? 1 : 0;
  }

  return clamp((lineNumber - 1 + lineOffsetRatio) / lineCount, 0, 1);
};

const findSegmentForLine = (
  segments: readonly SourceScrollSegment[],
  lineNumber: number,
) =>
  segments.find(
    (segment) => segment.sourceStartLine <= lineNumber && segment.sourceEndLine >= lineNumber,
  ) ?? null;

const findSegmentById = (
  segments: readonly SourceScrollSegment[],
  segmentId: string | null,
) => (segmentId ? segments.find((segment) => segment.id === segmentId) ?? null : null);

const getSegmentProgress = (
  segment: SourceScrollSegment,
  lineNumber: number,
  lineOffsetRatio: number,
) => {
  const lineSpan = Math.max(1, segment.sourceEndLine - segment.sourceStartLine + 1);
  const lineOffset = clamp(lineNumber - segment.sourceStartLine + lineOffsetRatio, 0, lineSpan);
  return clamp(lineOffset / lineSpan, 0, 1);
};

const getRenderableSegments = (segments: readonly SourceScrollSegment[]) =>
  segments.filter((segment) => segment.renderable && segment.previewHeight > 0);

const getNearestRenderableBoundary = (
  segments: readonly SourceScrollSegment[],
  sourceSegment: SourceScrollSegment | null,
  lineNumber: number,
) => {
  const renderableSegments = getRenderableSegments(segments);
  if (renderableSegments.length === 0) {
    return 0;
  }

  if (!sourceSegment) {
    const nearestSegment = [...renderableSegments].sort((first, second) => {
      const firstDistance =
        lineNumber < first.sourceStartLine
          ? first.sourceStartLine - lineNumber
          : lineNumber - first.sourceEndLine;
      const secondDistance =
        lineNumber < second.sourceStartLine
          ? second.sourceStartLine - lineNumber
          : lineNumber - second.sourceEndLine;
      return firstDistance - secondDistance || first.sourceStartLine - second.sourceStartLine;
    })[0];
    return nearestSegment?.previewTop ?? 0;
  }

  const nextSegment = renderableSegments.find(
    (segment) => segment.sourceStartLine > sourceSegment.sourceEndLine,
  );
  if (nextSegment) {
    return nextSegment.previewTop;
  }

  for (let index = renderableSegments.length - 1; index >= 0; index -= 1) {
    const previousSegment = renderableSegments[index];
    if (previousSegment.sourceEndLine < sourceSegment.sourceStartLine) {
      return previousSegment.previewTop + previousSegment.previewHeight;
    }
  }

  return renderableSegments[0]?.previewTop ?? 0;
};

export const buildSourceScrollSegments = (
  markdown: string,
  previewBlockIndex: PreviewBlockIndex,
  metadata: BuildSourceScrollSegmentsMetadata = {},
): SourceScrollMap => {
  const sourceLineOffset = Math.max(0, Math.floor(metadata.sourceLineOffset ?? 0));
  const frontmatterLineCount = Math.max(
    0,
    Math.floor(metadata.frontmatterLineCount ?? sourceLineOffset),
  );
  const frontmatterHeight = normalizeHeight(
    metadata.frontmatterMeasuredHeight,
    frontmatterLineCount > 0 ? metadata.frontmatterEstimatedHeight ?? DEFAULT_FRONTMATTER_ESTIMATED_HEIGHT : 0,
  );
  const bodyLineCount = getMarkdownLineCount(markdown);
  const lineCount = Math.max(
    1,
    Math.floor(metadata.sourceLineCount ?? sourceLineOffset + bodyLineCount),
    frontmatterLineCount,
    ...previewBlockIndex.blocks.map((block) => block.endLine + sourceLineOffset),
  );

  let previewTop = 0;
  const segments: SourceScrollSegment[] = [];

  if (frontmatterLineCount > 0) {
    segments.push({
      id: "frontmatter",
      kind: "frontmatter",
      measured: typeof metadata.frontmatterMeasuredHeight === "number",
      previewHeight: frontmatterHeight,
      previewTop,
      renderable: frontmatterHeight > 0,
      sourceEndLine: frontmatterLineCount,
      sourceStartLine: 1,
    });
    previewTop += frontmatterHeight;
  }

  for (const block of previewBlockIndex.blocks) {
    const previewHeight = normalizeHeight(block.estimatedHeight);
    segments.push({
      blockId: block.id,
      id: `block:${block.id}`,
      kind: block.kind,
      measured: false,
      previewHeight,
      previewTop,
      renderable: isPreviewBlockRenderableForTransfer(block, previewHeight),
      sourceEndLine: Math.max(1, block.endLine + sourceLineOffset),
      sourceStartLine: Math.max(1, block.startLine + sourceLineOffset),
    });
    previewTop += previewHeight;
  }

  segments.push({
    id: "document-end",
    kind: "document-end",
    measured: true,
    previewHeight: 0,
    previewTop,
    renderable: false,
    sourceEndLine: lineCount,
    sourceStartLine: lineCount,
  });

  return {
    lineCount,
    segments,
    totalPreviewHeight: previewTop,
  };
};

export const resolveSourcePosition = (
  editorPosition: EditorScrollPosition,
  sourceScrollMap: SourceScrollMap,
): SourceScrollPosition => {
  const lineCount = Math.max(1, sourceScrollMap.lineCount);
  const lineNumber = editorPosition.atDocumentEnd
    ? lineCount
    : normalizeLineNumber(editorPosition.lineNumber, lineCount);
  const lineOffsetRatio = editorPosition.atDocumentEnd ? 1 : normalizeRatio(editorPosition.lineOffsetRatio);
  const segment = editorPosition.atDocumentEnd
    ? sourceScrollMap.segments.at(-1) ?? null
    : findSegmentForLine(sourceScrollMap.segments, lineNumber);
  const segmentProgress = segment ? getSegmentProgress(segment, lineNumber, lineOffsetRatio) : 0;
  const sourceProgress = editorPosition.atDocumentEnd
    ? 1
    : getSourceProgress(lineNumber, lineOffsetRatio, lineCount);

  return {
    atDocumentEnd: editorPosition.atDocumentEnd,
    lineNumber,
    lineOffsetRatio,
    segmentId: segment?.id ?? null,
    segmentProgress,
    sourceProgress,
  };
};

export const getPreviewScrollTopForSourcePosition = (
  sourceScrollMap: SourceScrollMap,
  sourcePosition: SourceScrollPosition,
  viewport: SourceScrollTransferViewport,
): PreviewScrollTarget => {
  const viewportHeight = Math.max(1, viewport.viewportHeight);
  const edgePadding = viewport.edgePadding ?? DEFAULT_EDGE_PADDING;
  const sourceLineNumber = normalizeLineNumber(sourcePosition.lineNumber, sourceScrollMap.lineCount);

  if (sourcePosition.atDocumentEnd) {
    const target = clampPreviewScrollTop(
      sourceScrollMap.totalPreviewHeight,
      sourceScrollMap.totalPreviewHeight,
      viewportHeight,
    );
    return {
      ...target,
      sourceLineNumber,
      sourceProgress: 1,
    };
  }

  const sourceSegment = findSegmentById(sourceScrollMap.segments, sourcePosition.segmentId);
  const rawScrollTop =
    sourceSegment && sourceSegment.renderable && sourceSegment.previewHeight > 0
      ? sourceSegment.previewTop + sourceSegment.previewHeight * sourcePosition.segmentProgress - edgePadding
      : getNearestRenderableBoundary(sourceScrollMap.segments, sourceSegment, sourceLineNumber) - edgePadding;
  const target = clampPreviewScrollTop(rawScrollTop, sourceScrollMap.totalPreviewHeight, viewportHeight);

  return {
    ...target,
    sourceLineNumber,
    sourceProgress: sourcePosition.sourceProgress,
  };
};

export const getPreviewScrollTargetForEditorPosition = (
  markdown: string,
  previewBlockIndex: PreviewBlockIndex,
  editorPosition: EditorScrollPosition,
  viewport: SourceScrollTransferViewport,
  metadata: BuildSourceScrollSegmentsMetadata = {},
) => {
  const sourceScrollMap = buildSourceScrollSegments(markdown, previewBlockIndex, metadata);
  const sourcePosition = resolveSourcePosition(editorPosition, sourceScrollMap);
  return getPreviewScrollTopForSourcePosition(sourceScrollMap, sourcePosition, viewport);
};

export const applyPreviewSegmentMeasurements = (
  sourceScrollMap: SourceScrollMap,
  measurements: PreviewBlockMeasurements,
): SourceScrollMap => {
  let previewTop = 0;
  const segments = sourceScrollMap.segments.map((segment) => {
    const measuredHeight =
      segment.blockId !== undefined ? measurements[segment.blockId] : measurements[segment.id];
    const previewHeight = normalizeHeight(measuredHeight, segment.previewHeight);
    const measuredSegment: SourceScrollSegment = {
      ...segment,
      measured: segment.measured || typeof measuredHeight === "number",
      previewHeight,
      previewTop,
      renderable: segment.kind !== "blank" && segment.kind !== "document-end" && previewHeight > 0,
    };
    previewTop += previewHeight;
    return measuredSegment;
  });

  return {
    ...sourceScrollMap,
    segments,
    totalPreviewHeight: previewTop,
  };
};
