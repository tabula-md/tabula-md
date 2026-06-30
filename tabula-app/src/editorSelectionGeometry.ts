import {
  buildLineSurfaceVisualRows,
  getLineSurfaceRectRight,
  lineSurfaceRowsAreAdjacent,
  type LineSurfaceRect,
} from "@tabula-md/tabula";

export type SelectionSourceSegmentKind = "text" | "empty-line";

export type SelectionSegmentKind = SelectionSourceSegmentKind | "bridge";

export type SelectionSourceRectangle = LineSurfaceRect & {
  kind: SelectionSourceSegmentKind;
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

const buildSelectionVisualRows = (
  rectangles: SelectionSourceRectangle[],
  options: Required<SelectionGeometryOptions>,
) => {
  return buildLineSurfaceVisualRows(rectangles, { rowTolerance: options.rowTolerance }).map((row) => {
    const height = Math.max(1, row.bottom - row.top);
    const segments = row.rectangles.map((rectangle) => ({
      kind: rectangle.kind,
      left: rectangle.left,
      top: row.top,
      width: rectangle.width,
      height,
      runIndex: rectangle.runIndex,
      rowIndex: row.rowIndex,
      classNames: [
        selectionClassNames.segment,
        ...(rectangle.kind === "empty-line" ? [selectionClassNames.emptyLine] : []),
      ],
    }));

    return {
      runIndex: row.runIndex,
      rowIndex: row.rowIndex,
      left: row.left,
      right: row.right,
      top: row.top,
      bottom: row.bottom,
      segments,
    };
  });
};

const segmentCoversPoint = (segment: SelectionSegment, x: number, options: Required<SelectionGeometryOptions>) =>
  segment.left - options.cornerTolerance <= x && getLineSurfaceRectRight(segment) + options.cornerTolerance >= x;

const rowsAreAdjacent = (firstRow: SelectionVisualRow | undefined, secondRow: SelectionVisualRow | undefined) =>
  lineSurfaceRowsAreAdjacent(firstRow, secondRow);

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
  const right = getLineSurfaceRectRight(segment);
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
