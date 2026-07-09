import type { TextPatch } from "../textPatches";

export type MarkdownTaskMarker = {
  lineStart: number;
  lineEnd: number;
  markerStart: number;
  markerEnd: number;
  stateStart: number;
  stateEnd: number;
  checked: boolean;
};

export type MarkdownTaskToggleEdit = {
  patch: TextPatch;
  selection: {
    from: number;
    to: number;
  };
};

const taskMarkerPattern = /^(\s*[-*+]\s+\[)([ xX])(\]\s+)/;

const getLineRanges = (text: string) => {
  const ranges: Array<{ start: number; end: number; text: string }> = [];
  let start = 0;

  while (start <= text.length) {
    const lineBreak = text.indexOf("\n", start);
    const end = lineBreak === -1 ? text.length : lineBreak;
    ranges.push({ start, end, text: text.slice(start, end) });
    if (lineBreak === -1) {
      break;
    }
    start = lineBreak + 1;
  }

  return ranges;
};

export const getMarkdownTaskMarkers = (text: string): MarkdownTaskMarker[] =>
  getLineRanges(text)
    .map((line) => {
      const match = line.text.match(taskMarkerPattern);
      if (!match) {
        return null;
      }

      const stateStart = line.start + match[1].length;
      return {
        lineStart: line.start,
        lineEnd: line.end,
        markerStart: line.start + match[1].length - 1,
        markerEnd: line.start + match[0].length,
        stateStart,
        stateEnd: stateStart + 1,
        checked: match[2].toLowerCase() === "x",
      };
    })
    .filter((marker): marker is MarkdownTaskMarker => marker !== null);

export const getMarkdownTaskAtOffset = (text: string, offset: number): MarkdownTaskMarker | null => {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  return (
    getMarkdownTaskMarkers(text).find(
      (marker) => safeOffset >= marker.markerStart && safeOffset <= marker.markerEnd,
    ) ?? null
  );
};

export const toggleMarkdownTaskAtOffset = (text: string, offset: number): MarkdownTaskToggleEdit | null => {
  const task = getMarkdownTaskAtOffset(text, offset);
  if (!task) {
    return null;
  }

  const insert = task.checked ? " " : "x";
  return {
    patch: {
      from: task.stateStart,
      to: task.stateEnd,
      insert,
    },
    selection: {
      from: task.stateStart,
      to: task.stateStart + insert.length,
    },
  };
};

export const toggleMarkdownTaskOnLine = (text: string, lineStart: number): MarkdownTaskToggleEdit | null => {
  const safeLineStart = Math.max(0, Math.min(lineStart, text.length));
  const task = getMarkdownTaskMarkers(text).find((marker) => marker.lineStart === safeLineStart);
  if (!task) {
    return null;
  }

  const insert = task.checked ? " " : "x";
  return {
    patch: {
      from: task.stateStart,
      to: task.stateEnd,
      insert,
    },
    selection: {
      from: task.stateStart,
      to: task.stateStart + insert.length,
    },
  };
};
