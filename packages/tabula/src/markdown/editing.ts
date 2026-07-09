export type MarkdownTextEdit = {
  from: number;
  to: number;
  insert: string;
  selection: number;
};

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

type MarkdownLineMatch = {
  marker: string;
  content: string;
  nextMarker: string;
};

const markdownUrlPattern = /^(?:https?:\/\/|mailto:)[^\s<>()]+$/i;
const orderedMarkerPattern = /^(\s*)(\d+)(\.\s+)/;
const listMarkerPattern = /^(\s*)(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+)/;

const getLineAtOffset = (text: string, offset: number) => {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const lineStart = text.lastIndexOf("\n", Math.max(0, safeOffset - 1)) + 1;
  const nextLineBreak = text.indexOf("\n", safeOffset);
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;
  const lineText = text.slice(lineStart, lineEnd);
  const column = safeOffset - lineStart;

  return {
    lineStart,
    lineEnd,
    lineText,
    beforeCursor: lineText.slice(0, column),
    afterCursor: lineText.slice(column),
  };
};

const isMarkdownUrl = (text: string) => markdownUrlPattern.test(text);

const formatMarkdownLinkText = (text: string) => {
  const label = text.replace(/\s+/g, " ").trim() || "link";
  return label.replace(/]/g, "\\]");
};

const getMarkdownLineMatch = (beforeCursor: string): MarkdownLineMatch | null => {
  const checklistMatch = beforeCursor.match(/^(\s*)([-*+])\s+\[[ xX]\]\s+(.*)$/);
  if (checklistMatch) {
    return {
      marker: beforeCursor.slice(0, beforeCursor.length - checklistMatch[3].length),
      content: checklistMatch[3],
      nextMarker: `${checklistMatch[1]}${checklistMatch[2]} [ ] `,
    };
  }

  const numberedMatch = beforeCursor.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (numberedMatch) {
    return {
      marker: beforeCursor.slice(0, beforeCursor.length - numberedMatch[3].length),
      content: numberedMatch[3],
      nextMarker: `${numberedMatch[1]}${Number(numberedMatch[2]) + 1}. `,
    };
  }

  const bulletMatch = beforeCursor.match(/^(\s*)([-*+])\s+(.*)$/);
  if (bulletMatch) {
    return {
      marker: beforeCursor.slice(0, beforeCursor.length - bulletMatch[3].length),
      content: bulletMatch[3],
      nextMarker: `${bulletMatch[1]}${bulletMatch[2]} `,
    };
  }

  const quoteMatch = beforeCursor.match(/^(\s*(?:>\s?)+)(.*)$/);
  if (quoteMatch) {
    const marker = quoteMatch[1].endsWith(" ") ? quoteMatch[1] : `${quoteMatch[1]} `;
    return {
      marker: quoteMatch[1],
      content: quoteMatch[2],
      nextMarker: marker,
    };
  }

  return null;
};

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

const getEmptyMarkerRemoval = (beforeCursor: string, afterCursor: string) => {
  if (afterCursor.trim().length > 0) {
    return null;
  }

  const checklistMatch = beforeCursor.match(/^(\s*[-*+]\s+\[[ xX]\]\s*)$/);
  if (checklistMatch) {
    return beforeCursor.length;
  }

  const orderedMatch = beforeCursor.match(/^(\s*\d+\.\s*)$/);
  if (orderedMatch) {
    return beforeCursor.length;
  }

  const bulletMatch = beforeCursor.match(/^(\s*[-*+]\s+)$/);
  if (bulletMatch) {
    return beforeCursor.length;
  }

  const quoteMatch = beforeCursor.match(/^(\s*(?:>\s?)+)$/);
  if (quoteMatch) {
    return beforeCursor.length;
  }

  return null;
};

const getListOutdentEdit = (
  lineStart: number,
  lineText: string,
  offset: number,
): MarkdownTextEdit | null => {
  const listMatch = lineText.match(listMarkerPattern);
  if (!listMatch) {
    return null;
  }

  const indent = listMatch[1];
  const removeCount = Math.min(2, indent.length);
  if (removeCount === 0) {
    return null;
  }

  const markerEnd = lineStart + listMatch[0].length;
  const safeOffset = Math.max(0, offset);
  if (safeOffset > markerEnd) {
    return null;
  }

  return {
    from: lineStart,
    to: lineStart + removeCount,
    insert: "",
    selection: Math.max(lineStart, safeOffset - removeCount),
  };
};

const normalizePastedMarkdown = (pastedText: string) => {
  const lineEndingNormalized = pastedText.replace(/\r\n?/g, "\n");
  const tabNormalized = lineEndingNormalized.replace(/(^|\n)(\t+)/g, (_, prefix: string, tabs: string) => {
    return `${prefix}${"  ".repeat(tabs.length)}`;
  });

  return tabNormalized === pastedText ? null : tabNormalized;
};

export const getMarkdownEnterEdit = (text: string, offset: number): MarkdownTextEdit | null => {
  const { lineStart, beforeCursor, afterCursor } = getLineAtOffset(text, offset);
  const lineMatch = getMarkdownLineMatch(beforeCursor);
  if (!lineMatch) {
    return null;
  }

  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const hasEmptyItem = lineMatch.content.trim().length === 0 && afterCursor.trim().length === 0;
  if (hasEmptyItem) {
    return {
      from: lineStart,
      to: lineStart + lineMatch.marker.length,
      insert: "",
      selection: lineStart,
    };
  }

  const insert = `\n${lineMatch.nextMarker}`;
  return {
    from: safeOffset,
    to: safeOffset,
    insert,
    selection: safeOffset + insert.length,
  };
};

export const getMarkdownBackspaceEdit = (text: string, offset: number): MarkdownTextEdit | null => {
  const { lineStart, lineText, beforeCursor, afterCursor } = getLineAtOffset(text, offset);
  const markerLength = getEmptyMarkerRemoval(beforeCursor, afterCursor);
  if (markerLength !== null) {
    return {
      from: lineStart,
      to: lineStart + markerLength,
      insert: "",
      selection: lineStart,
    };
  }

  return getListOutdentEdit(lineStart, lineText, offset);
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

export const getMarkdownPasteEdit = (
  text: string,
  selection: MarkdownRangeSelection,
  pastedText: string,
): MarkdownRangeEdit | null => {
  if (!pastedText) {
    return null;
  }

  const range = getSelectedLineRange(text, selection);
  const from = range.selectionFrom;
  const to = range.selectionTo;
  const selectedText = text.slice(from, to);
  const urlCandidate = pastedText.trim();
  const shouldLinkSelection =
    selectedText.trim().length > 0 &&
    !selectedText.includes("\n") &&
    urlCandidate === pastedText &&
    isMarkdownUrl(urlCandidate);

  if (shouldLinkSelection) {
    const linkText = formatMarkdownLinkText(selectedText);
    const insert = `[${linkText}](${urlCandidate})`;
    const nextOffset = from + insert.length;
    return {
      from,
      to,
      insert,
      selection: { from: nextOffset, to: nextOffset },
    };
  }

  const normalizedPaste = normalizePastedMarkdown(pastedText);
  if (!normalizedPaste) {
    return null;
  }

  const nextOffset = from + normalizedPaste.length;
  return {
    from,
    to,
    insert: normalizedPaste,
    selection: { from: nextOffset, to: nextOffset },
  };
};
