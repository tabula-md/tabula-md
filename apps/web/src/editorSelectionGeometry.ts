export type SelectionSourceSegmentKind = "text" | "empty-line";

export type SelectionSegmentKind = SelectionSourceSegmentKind | "bridge";

export type SelectionSourceRectangle = {
  kind: SelectionSourceSegmentKind;
  left: number;
  top: number;
  width: number;
  height: number;
  runIndex: number;
};

export type SelectionSegment = {
  kind: SelectionSegmentKind;
  left: number;
  top: number;
  width: number;
  height: number;
  runIndex: number;
  rowIndex: number;
  classNames: string[];
};

export type SelectionGeometryOptions = {
  bridgeOverlap?: number;
  bridgeWidth?: number;
  cornerTolerance?: number;
  rowTolerance?: number;
};

type SelectionVisualRow = {
  runIndex: number;
  rowIndex: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  segments: SelectionSegment[];
};

type SelectionVisualRowGroup = {
  top: number;
  rectangles: SelectionSourceRectangle[];
};

const defaultSelectionGeometryOptions = {
  bridgeOverlap: 4,
  bridgeWidth: 10,
  cornerTolerance: 0.5,
  rowTolerance: 1,
} satisfies Required<SelectionGeometryOptions>;

const selectionClassNames = {
  bridge: "cm-user-selection-bridge",
  emptyLine: "cm-user-selection-empty",
  segment: "cm-user-selection-segment",
  squareBottomLeft: "selection-square-bottom-left",
  squareBottomRight: "selection-square-bottom-right",
  squareTopLeft: "selection-square-top-left",
  squareTopRight: "selection-square-top-right",
} as const;

const getRectangleBottom = (rectangle: Pick<SelectionSourceRectangle | SelectionSegment, "top" | "height">) =>
  rectangle.top + rectangle.height;

const getRectangleRight = (rectangle: Pick<SelectionSourceRectangle | SelectionSegment, "left" | "width">) =>
  rectangle.left + rectangle.width;

const groupRectanglesByRun = (rectangles: SelectionSourceRectangle[]) => {
  const rectanglesByRun = new Map<number, SelectionSourceRectangle[]>();
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

const buildSelectionVisualRows = (
  rectangles: SelectionSourceRectangle[],
  options: Required<SelectionGeometryOptions>,
) => {
  const rows: SelectionVisualRow[] = [];
  groupRectanglesByRun(rectangles).forEach((runRectangles) => {
    const sortedRectangles = [...runRectangles].sort((first, second) => first.top - second.top || first.left - second.left);
    const rowGroups: SelectionVisualRowGroup[] = [];
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
      const rawBottom = Math.max(...rowGroup.rectangles.map(getRectangleBottom));
      const nextTop = rowGroups[rowIndex + 1]?.top;
      const bottom = typeof nextTop === "number" && nextTop > top ? nextTop : rawBottom;
      const height = Math.max(1, bottom - top);
      const segments = rowGroup.rectangles.map((rectangle) => ({
        kind: rectangle.kind,
        left: rectangle.left,
        top,
        width: rectangle.width,
        height,
        runIndex: rectangle.runIndex,
        rowIndex,
        classNames: [
          selectionClassNames.segment,
          ...(rectangle.kind === "empty-line" ? [selectionClassNames.emptyLine] : []),
        ],
      }));

      rows.push({
        runIndex: segments[0]?.runIndex ?? 0,
        rowIndex,
        left: Math.min(...segments.map((segment) => segment.left)),
        right: Math.max(...segments.map(getRectangleRight)),
        top,
        bottom: top + height,
        segments,
      });
    });
  });

  return rows.sort((first, second) => first.runIndex - second.runIndex || first.rowIndex - second.rowIndex);
};

const segmentCoversPoint = (segment: SelectionSegment, x: number, options: Required<SelectionGeometryOptions>) =>
  segment.left - options.cornerTolerance <= x && getRectangleRight(segment) + options.cornerTolerance >= x;

const rowsAreAdjacent = (firstRow: SelectionVisualRow | undefined, secondRow: SelectionVisualRow | undefined) =>
  Boolean(firstRow && secondRow && firstRow.runIndex === secondRow.runIndex && firstRow.rowIndex + 1 === secondRow.rowIndex);

const rowsShareLeftEdge = (
  firstRow: SelectionVisualRow,
  secondRow: SelectionVisualRow,
  options: Required<SelectionGeometryOptions>,
) => Math.abs(firstRow.left - secondRow.left) <= options.cornerTolerance;

const getSelectionSegmentClassNames = (
  segment: SelectionSegment,
  previousRow: SelectionVisualRow | undefined,
  nextRow: SelectionVisualRow | undefined,
  options: Required<SelectionGeometryOptions>,
) => {
  const classNames = [...segment.classNames];
  const left = segment.left;
  const right = getRectangleRight(segment);
  if (previousRow?.segments.some((previousSegment) => segmentCoversPoint(previousSegment, left, options))) {
    classNames.push(selectionClassNames.squareTopLeft);
  }
  if (previousRow?.segments.some((previousSegment) => segmentCoversPoint(previousSegment, right, options))) {
    classNames.push(selectionClassNames.squareTopRight);
  }
  if (nextRow?.segments.some((nextSegment) => segmentCoversPoint(nextSegment, left, options))) {
    classNames.push(selectionClassNames.squareBottomLeft);
  }
  if (nextRow?.segments.some((nextSegment) => segmentCoversPoint(nextSegment, right, options))) {
    classNames.push(selectionClassNames.squareBottomRight);
  }

  return classNames;
};

const createSelectionBridgeSegment = (
  firstRow: SelectionVisualRow,
  secondRow: SelectionVisualRow,
  options: Required<SelectionGeometryOptions>,
): SelectionSegment | null => {
  if (!rowsShareLeftEdge(firstRow, secondRow, options)) {
    return null;
  }

  const top = firstRow.bottom - options.bridgeOverlap;
  const bottom = secondRow.top + options.bridgeOverlap;
  if (bottom <= top) {
    return null;
  }

  return {
    kind: "bridge",
    left: firstRow.left,
    top,
    width: options.bridgeWidth,
    height: bottom - top,
    runIndex: firstRow.runIndex,
    rowIndex: firstRow.rowIndex,
    classNames: [selectionClassNames.segment, selectionClassNames.bridge],
  };
};

export const buildSelectionSegments = (
  rectangles: SelectionSourceRectangle[],
  optionOverrides: SelectionGeometryOptions = {},
) => {
  const options = { ...defaultSelectionGeometryOptions, ...optionOverrides };
  const rows = buildSelectionVisualRows(rectangles, options);
  const rowSegments = rows.flatMap((row, index) => {
    const previousRow = rowsAreAdjacent(rows[index - 1], row) ? rows[index - 1] : undefined;
    const nextRow = rowsAreAdjacent(row, rows[index + 1]) ? rows[index + 1] : undefined;
    return row.segments.map((segment) => ({
      ...segment,
      classNames: getSelectionSegmentClassNames(segment, previousRow, nextRow, options),
    }));
  });
  const bridgeSegments = rows
    .map((row, index) => {
      const nextRow = rowsAreAdjacent(row, rows[index + 1]) ? rows[index + 1] : undefined;
      return nextRow ? createSelectionBridgeSegment(row, nextRow, options) : null;
    })
    .filter((segment): segment is SelectionSegment => Boolean(segment));

  return [...rowSegments, ...bridgeSegments];
};
