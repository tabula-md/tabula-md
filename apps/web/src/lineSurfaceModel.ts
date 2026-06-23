// Shared line surface contract:
// - source lines are 1-based lines backed by [start, end] document offsets; empty lines keep start === end and remain addressable.
// - visual rows are measured rectangles normalized by source run and wrapped row order; one source line may become many visual rows.
// - annotation rows consume source-line semantics first, then use DOM measurement only to place gutters and overlays.
export type LineSurfaceRectKind = "text" | "empty-line";

export type LineSurfaceRect = {
  kind: LineSurfaceRectKind;
  left: number;
  top: number;
  width: number;
  height: number;
  runIndex: number;
};

export type LineSurfaceVisualRow<TRectangle extends LineSurfaceRect = LineSurfaceRect> = {
  runIndex: number;
  rowIndex: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  rectangles: TRectangle[];
};

export type LineSurfaceSourceLine = {
  number: number;
  start: number;
  end: number;
};

export type LineSurfaceSourceRange = {
  start: number;
  end: number;
};

export type LineSurfaceAnnotation = {
  lineNumber: number;
  start: number;
  end: number;
  hasBookmark: boolean;
  hasComment: boolean;
  hasActiveComment?: boolean;
};

export type LineSurfaceSourceBlock = {
  startLine: number;
  endLine: number;
  top: number;
  bottom: number;
};

export type LineSurfaceRow<TAnnotation extends LineSurfaceAnnotation = LineSurfaceAnnotation> = TAnnotation & {
  top: number;
  height: number;
};

export type LineSurfaceVisualRowOptions = {
  rowTolerance?: number;
};

export type LineSurfaceAnnotationRowOptions = {
  fallbackHeight?: number;
  fallbackGap?: number;
  minRowHeight?: number;
};

const defaultVisualRowOptions = {
  rowTolerance: 1,
} satisfies Required<LineSurfaceVisualRowOptions>;

const defaultAnnotationRowOptions = {
  fallbackGap: 6,
  fallbackHeight: 24,
  minRowHeight: 20,
} satisfies Required<LineSurfaceAnnotationRowOptions>;

export const getLineSurfaceRectRight = (rectangle: Pick<LineSurfaceRect, "left" | "width">) =>
  rectangle.left + rectangle.width;

export const getLineSurfaceRectBottom = (rectangle: Pick<LineSurfaceRect, "top" | "height">) =>
  rectangle.top + rectangle.height;

const clampSourcePosition = (position: number, docLength: number) =>
  Math.max(0, Math.min(position, Math.max(0, docLength)));

const normalizeSourceRange = (range: LineSurfaceSourceRange, docLength: number): LineSurfaceSourceRange => {
  const start = clampSourcePosition(Math.min(range.start, range.end), docLength);
  const end = clampSourcePosition(Math.max(range.start, range.end), docLength);
  return { start, end };
};

const groupRectsByRun = <TRectangle extends LineSurfaceRect>(rectangles: TRectangle[]) => {
  const rectanglesByRun = new Map<number, TRectangle[]>();
  rectangles.forEach((rectangle) => {
    const runRectangles = rectanglesByRun.get(rectangle.runIndex);
    if (runRectangles) {
      runRectangles.push(rectangle);
      return;
    }

    rectanglesByRun.set(rectangle.runIndex, [rectangle]);
  });

  return rectanglesByRun;
};

export const buildLineSurfaceVisualRows = <TRectangle extends LineSurfaceRect>(
  rectangles: TRectangle[],
  optionOverrides: LineSurfaceVisualRowOptions = {},
) => {
  const options = { ...defaultVisualRowOptions, ...optionOverrides };
  const rows: LineSurfaceVisualRow<TRectangle>[] = [];

  groupRectsByRun(rectangles).forEach((runRectangles) => {
    const sortedRectangles = [...runRectangles].sort((first, second) => first.top - second.top || first.left - second.left);
    const rowGroups: { top: number; rectangles: TRectangle[] }[] = [];

    sortedRectangles.forEach((rectangle) => {
      const currentGroup = rowGroups[rowGroups.length - 1];
      if (!currentGroup || Math.abs(rectangle.top - currentGroup.top) > options.rowTolerance) {
        rowGroups.push({ top: rectangle.top, rectangles: [rectangle] });
        return;
      }

      currentGroup.rectangles.push(rectangle);
      currentGroup.top = Math.min(currentGroup.top, rectangle.top);
    });

    rowGroups.forEach((rowGroup, rowIndex) => {
      const top = rowGroup.top;
      const rawBottom = Math.max(...rowGroup.rectangles.map(getLineSurfaceRectBottom));
      const nextTop = rowGroups[rowIndex + 1]?.top;
      const bottom = typeof nextTop === "number" && nextTop > top ? nextTop : rawBottom;

      rows.push({
        runIndex: rowGroup.rectangles[0]?.runIndex ?? 0,
        rowIndex,
        left: Math.min(...rowGroup.rectangles.map((rectangle) => rectangle.left)),
        right: Math.max(...rowGroup.rectangles.map(getLineSurfaceRectRight)),
        top,
        bottom: top + Math.max(1, bottom - top),
        rectangles: rowGroup.rectangles,
      });
    });
  });

  return rows.sort((first, second) => first.runIndex - second.runIndex || first.rowIndex - second.rowIndex);
};

export const lineSurfaceRowsAreAdjacent = (
  firstRow: Pick<LineSurfaceVisualRow, "runIndex" | "rowIndex"> | undefined,
  secondRow: Pick<LineSurfaceVisualRow, "runIndex" | "rowIndex"> | undefined,
) => Boolean(firstRow && secondRow && firstRow.runIndex === secondRow.runIndex && firstRow.rowIndex + 1 === secondRow.rowIndex);

export const positionInSourceLine = (position: number, lineStart: number, lineEnd: number) =>
  lineStart === lineEnd ? position === lineStart : position >= lineStart && position <= lineEnd;

export const sourceRangeIntersectsLine = (
  range: LineSurfaceSourceRange,
  line: Pick<LineSurfaceSourceLine, "start" | "end">,
) => {
  const start = Math.min(range.start, range.end);
  const end = Math.max(range.start, range.end);

  if (line.start === line.end) {
    return start <= line.start && end >= line.start;
  }

  if (start === end) {
    return positionInSourceLine(start, line.start, line.end);
  }

  return end > line.start && start < line.end;
};

export const getLineNumberForSourcePosition = ({
  docLength,
  position,
  resolveLineAt,
}: {
  docLength: number;
  position: number;
  resolveLineAt: (position: number) => Pick<LineSurfaceSourceLine, "number">;
}) => resolveLineAt(clampSourcePosition(position, docLength)).number;

export const getLineNumbersForSourceRanges = ({
  docLength,
  ranges,
  resolveLineAt,
}: {
  docLength: number;
  ranges: LineSurfaceSourceRange[];
  resolveLineAt: (position: number) => Pick<LineSurfaceSourceLine, "number">;
}) => {
  const lineNumbers = new Set<number>();

  ranges.forEach((range) => {
    const normalizedRange = normalizeSourceRange(range, docLength);
    const startLine = resolveLineAt(normalizedRange.start).number;
    const endLine =
      normalizedRange.end > normalizedRange.start
        ? resolveLineAt(Math.max(normalizedRange.start, normalizedRange.end - 1)).number
        : startLine;

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      lineNumbers.add(lineNumber);
    }
  });

  return lineNumbers;
};

export const getLineSurfaceAnnotationsSignature = (annotations: LineSurfaceAnnotation[]) =>
  annotations
    .map((annotation) =>
      [
        annotation.lineNumber,
        annotation.start,
        annotation.end,
        annotation.hasBookmark ? 1 : 0,
        annotation.hasComment ? 1 : 0,
        annotation.hasActiveComment ? 1 : 0,
      ].join(":"),
    )
    .join("|");

export const areLineSurfaceRowsEqual = <TRow extends LineSurfaceRow>(firstRows: TRow[], secondRows: TRow[]) =>
  firstRows.length === secondRows.length &&
  firstRows.every((firstRow, index) => {
    const secondRow = secondRows[index];
    return (
      firstRow.lineNumber === secondRow.lineNumber &&
      firstRow.start === secondRow.start &&
      firstRow.end === secondRow.end &&
      firstRow.hasBookmark === secondRow.hasBookmark &&
      firstRow.hasComment === secondRow.hasComment &&
      firstRow.hasActiveComment === secondRow.hasActiveComment &&
      Math.abs(firstRow.top - secondRow.top) < 0.5 &&
      Math.abs(firstRow.height - secondRow.height) < 0.5
    );
  });

const getFallbackLineTop = (
  lineNumber: number,
  sourceBlocks: LineSurfaceSourceBlock[],
  options: Required<LineSurfaceAnnotationRowOptions>,
) => {
  const previousBlock = [...sourceBlocks].reverse().find((block) => block.endLine < lineNumber);
  const nextBlock = sourceBlocks.find((block) => block.startLine > lineNumber);
  if (previousBlock && nextBlock) {
    return previousBlock.bottom + Math.max(0, nextBlock.top - previousBlock.bottom) / 2 - options.fallbackHeight / 2;
  }

  if (previousBlock) {
    return previousBlock.bottom + options.fallbackGap;
  }

  if (nextBlock) {
    return Math.max(0, nextBlock.top - options.fallbackHeight - options.fallbackGap);
  }

  return 0;
};

export const buildLineSurfaceAnnotationRows = <TAnnotation extends LineSurfaceAnnotation>(
  annotations: TAnnotation[],
  sourceBlocks: LineSurfaceSourceBlock[],
  optionOverrides: LineSurfaceAnnotationRowOptions = {},
): LineSurfaceRow<TAnnotation>[] => {
  const options = { ...defaultAnnotationRowOptions, ...optionOverrides };

  return annotations
    .map((annotation) => {
      const matchingBlock = sourceBlocks.find(
        (block) => block.startLine <= annotation.lineNumber && block.endLine >= annotation.lineNumber,
      );

      if (!matchingBlock) {
        return {
          ...annotation,
          top: getFallbackLineTop(annotation.lineNumber, sourceBlocks, options),
          height: options.fallbackHeight,
        };
      }

      const sourceLineCount = Math.max(1, matchingBlock.endLine - matchingBlock.startLine + 1);
      const sourceLineHeight = Math.max(options.minRowHeight, (matchingBlock.bottom - matchingBlock.top) / sourceLineCount);
      return {
        ...annotation,
        top: matchingBlock.top + (annotation.lineNumber - matchingBlock.startLine) * sourceLineHeight,
        height: sourceLineHeight,
      };
    })
    .filter((row, index, rows) => rows.findIndex((candidate) => candidate.lineNumber === row.lineNumber) === index);
};
