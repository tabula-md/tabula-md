export type MarkdownRangeSelection = {
  from: number;
  to: number;
};

export type MarkdownRangeEdit = {
  from: number;
  to: number;
  insert: string;
  selection: MarkdownRangeSelection;
};

const orderedMarkerPattern = /^(\s*)(\d+)(\.\s+)/;
const listMarkerPattern = /^(\s*)(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+)/;

const getSelectedLineRange = (text: string, selection: MarkdownRangeSelection) => {
  const safeFrom = Math.max(0, Math.min(Math.min(selection.from, selection.to), text.length));
  const safeTo = Math.max(0, Math.min(Math.max(selection.from, selection.to), text.length));
  const lineStart = text.lastIndexOf("\n", Math.max(0, safeFrom - 1)) + 1;
  const selectedEnd = safeTo > safeFrom && text[safeTo - 1] === "\n" ? safeTo - 1 : safeTo;
  const nextLineBreak = text.indexOf("\n", selectedEnd);
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;

  return {
    from: lineStart,
    to: lineEnd,
    selectionFrom: safeFrom,
    selectionTo: safeTo,
    lines: text.slice(lineStart, lineEnd).split("\n"),
  };
};

const getListLineIndentChange = (line: string, direction: "indent" | "outdent") => {
  const listMatch = line.match(listMarkerPattern);
  if (!listMatch) {
    return line;
  }

  if (direction === "indent") {
    return `  ${line}`;
  }

  const indent = listMatch[1];
  const removeCount = Math.min(2, indent.length);
  if (removeCount === 0) {
    return line;
  }

  return line.slice(removeCount);
};

const getCommonPrefixLength = (left: string, right: string) => {
  let index = 0;
  while (index < left.length && index < right.length && left[index] === right[index]) {
    index += 1;
  }
  return index;
};

const getCommonSuffixLength = (left: string, right: string, prefixLength: number) => {
  let length = 0;
  while (
    length + prefixLength < left.length &&
    length + prefixLength < right.length &&
    left[left.length - length - 1] === right[right.length - length - 1]
  ) {
    length += 1;
  }
  return length;
};

const mapColumnThroughLineReplacement = (column: number, originalLine: string, nextLine: string) => {
  if (originalLine === nextLine) {
    return column;
  }

  const prefixLength = getCommonPrefixLength(originalLine, nextLine);
  const suffixLength = getCommonSuffixLength(originalLine, nextLine, prefixLength);
  const originalChangeEnd = originalLine.length - suffixLength;
  const nextChangeEnd = nextLine.length - suffixLength;

  if (column === prefixLength && originalChangeEnd === prefixLength && nextChangeEnd > prefixLength) {
    return nextChangeEnd;
  }

  if (column <= prefixLength) {
    return column;
  }

  if (column >= originalChangeEnd) {
    return Math.max(prefixLength, column + nextLine.length - originalLine.length);
  }

  return nextChangeEnd;
};

const mapOffsetThroughLineReplacements = (
  offset: number,
  rangeStart: number,
  originalLines: string[],
  nextLines: string[],
) => {
  let originalLineStart = 0;
  let nextLineStart = 0;

  for (let index = 0; index < originalLines.length; index += 1) {
    const originalLine = originalLines[index] ?? "";
    const nextLine = nextLines[index] ?? "";
    const originalLineEnd = originalLineStart + originalLine.length;

    if (offset <= rangeStart + originalLineEnd) {
      const column = Math.max(0, offset - rangeStart - originalLineStart);
      return rangeStart + nextLineStart + mapColumnThroughLineReplacement(column, originalLine, nextLine);
    }

    originalLineStart += originalLine.length + 1;
    nextLineStart += nextLine.length + 1;
  }

  return rangeStart + nextLines.join("\n").length;
};

const renumberOrderedListRuns = (lines: string[]) => {
  const countersByIndent = new Map<string, number>();

  return lines.map((line) => {
    const orderedMatch = line.match(orderedMarkerPattern);
    if (!orderedMatch) {
      if (line.trim().length > 0) {
        countersByIndent.clear();
      }
      return line;
    }

    const indent = orderedMatch[1];
    const previousNumber = countersByIndent.get(indent);
    const nextNumber = previousNumber === undefined ? Number(orderedMatch[2]) : previousNumber + 1;
    countersByIndent.set(indent, nextNumber);

    for (const key of countersByIndent.keys()) {
      if (key.length > indent.length) {
        countersByIndent.delete(key);
      }
    }

    return `${indent}${nextNumber}${orderedMatch[3]}${line.slice(orderedMatch[0].length)}`;
  });
};

export const getMarkdownIndentEdit = (
  text: string,
  selection: MarkdownRangeSelection,
  direction: "indent" | "outdent",
): MarkdownRangeEdit | null => {
  const range = getSelectedLineRange(text, selection);
  const transformedLines = range.lines.map((line) => getListLineIndentChange(line, direction));
  const nextLines = renumberOrderedListRuns(transformedLines);
  const changed = nextLines.some((line, index) => line !== range.lines[index]);

  if (!changed) {
    return null;
  }

  const insert = nextLines.join("\n");
  return {
    from: range.from,
    to: range.to,
    insert,
    selection: {
      from: mapOffsetThroughLineReplacements(range.selectionFrom, range.from, range.lines, nextLines),
      to: mapOffsetThroughLineReplacements(range.selectionTo, range.from, range.lines, nextLines),
    },
  };
};
