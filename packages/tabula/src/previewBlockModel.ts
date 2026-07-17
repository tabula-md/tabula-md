import { applyTextPatches, normalizeTextPatches, type TextPatch } from "./textPatches";

export const LARGE_DOCUMENT_CHAR_THRESHOLD = 64_000;
export const LARGE_DOCUMENT_LINE_THRESHOLD = 800;
export const LARGE_DOCUMENT_WORD_THRESHOLD = 8_000;
export const LARGE_DOCUMENT_LONG_LINE_THRESHOLD = 8_000;
export const LARGE_DOCUMENT_TABLE_RUN_THRESHOLD = 120;
export const LIVE_PREVIEW_CHAR_THRESHOLD = 24_000;
export const HEAVY_PREVIEW_TABLE_RUN_THRESHOLD = 16;
export const HEAVY_PREVIEW_FENCE_LINE_THRESHOLD = 80;
export const HEAVY_PREVIEW_FENCE_CHAR_THRESHOLD = 12_000;

export type PreviewBlockKind =
  | "blank"
  | "blockquote"
  | "fence"
  | "heading"
  | "html"
  | "list"
  | "paragraph"
  | "table"
  | "thematic";

export type PreviewBlock = {
  id: string;
  kind: PreviewBlockKind;
  text: string;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  estimatedTop: number;
  estimatedHeight: number;
};

export type PreviewBlockIndex = {
  blocks: PreviewBlock[];
  lineCount: number;
  totalEstimatedHeight: number;
};

export type PreviewBlockMeasurements = Readonly<Record<string, number>>;

export type PreviewWindow = {
  blocks: PreviewBlock[];
  endIndex: number;
  startIndex: number;
};

export type PreviewRenderableAnchor = {
  endLine: number;
  rendered: boolean;
  sourceElement?: boolean;
  startLine: number;
};

export type PreviewScrollMapAnchor = {
  align: "end" | "preserve-offset";
  lineNumber: number;
  lineOffsetRatio?: number;
};

export type PreviewScrollMapOptions = {
  edgePadding?: number;
  viewportHeight: number;
};

type MarkdownLine = {
  text: string;
  startOffset: number;
  endOffset: number;
};

const DEFAULT_LINE_HEIGHT = 27;
const BLOCK_GAP_HEIGHT = 10;
const CODE_LINE_HEIGHT = 24;
const HEADING_ESTIMATED_HEIGHT_BY_LEVEL = {
  1: 49,
  2: 43,
  3: 38,
  4: 33,
  5: 29,
  6: 27,
} as const;
const PREVIEW_PARAGRAPH_LINE_CHUNK_SIZE = 40;
const PREVIEW_PARAGRAPH_CHAR_CHUNK_SIZE = 4_000;
const PREVIEW_PARAGRAPH_ESTIMATED_CHARS_PER_LINE = 92;
// Measurements are partial while scrolling, so small count-based pads prevent visible gaps from estimate drift.
const PREVIEW_WINDOW_MAX_LEADING_OVERSCAN = 240;
const PREVIEW_WINDOW_LEADING_BLOCK_PADDING = 0;
const PREVIEW_WINDOW_TRAILING_BLOCK_PADDING = 1;
const PREVIEW_WINDOW_END_LEADING_BLOCK_PADDING = 4;
const PREVIEW_WINDOW_END_TRAILING_BLOCK_PADDING = 4;
const PREVIEW_WINDOW_END_SCROLL_RATIO = 0.8;
const OPTIMISTIC_INDEX_MAX_CHANGED_LINES = 80;
const OPTIMISTIC_INDEX_CONTEXT_BLOCK_COUNT = 1;

const fenceLinePattern = /^ {0,3}(`{3,}|~{3,})/;
const headingLinePattern = /^ {0,3}#{1,6}\s+\S/;
const thematicLinePattern = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const blockquoteLinePattern = /^ {0,3}>/;
const listLinePattern = /^ {0,3}(?:[-+*]|\d{1,9}[.)])\s+/;
const indentedContinuationPattern = /^(?: {2,}|\t)\S/;
const tableSeparatorPattern = /^ {0,3}\|?\s*:?-{1,}:?\s*(?:\|\s*:?-{1,}:?\s*)+\|?\s*$/;
const htmlLinePattern = /^ {0,3}<\/?[A-Za-z][A-Za-z0-9-]*(?:\s|>|\/>)/;
const displayMathLinePattern = /^ {0,3}\$\$\s*$/;
const heavyFenceLanguagePattern = /^(?:mermaid|mmd|math|tex|latex|katex)$/i;
const frontmatterFencePattern = /^---\s*$/;
const yamlKeyLinePattern = /^[A-Za-z0-9_-]+:\s*/;
const footnoteDefinitionLinePattern = /^ {0,3}\[\^[^\]\n]+]:/;
const footnoteContinuationLinePattern = /^(?: {4,}|\t)\S/;
const footnoteReferencePattern = /\[\^[^\]\n]+]/;
const referenceDefinitionLinePattern = /^ {0,3}\[(?!\^)([^\]\n]+)]:\s+\S/;
const referenceLinkPattern = /\[[^\]\n]+]\[[^\]\n]*]/;
const definitionListLinePattern = /^ {0,3}:\s+\S/;

export const getMarkdownLineCount = (markdown: string) => {
  if (markdown.length === 0) {
    return 1;
  }

  let lineCount = 1;
  for (let index = 0; index < markdown.length; index += 1) {
    if (markdown.charCodeAt(index) === 10) {
      lineCount += 1;
    }
  }
  return lineCount;
};

export const hasLongMarkdownLine = (
  markdown: string,
  threshold = LARGE_DOCUMENT_LONG_LINE_THRESHOLD,
) => {
  let currentLineLength = 0;

  for (let index = 0; index < markdown.length; index += 1) {
    const characterCode = markdown.charCodeAt(index);
    if (characterCode === 10) {
      if (currentLineLength >= threshold) {
        return true;
      }
      currentLineLength = 0;
      continue;
    }

    if (characterCode !== 13) {
      currentLineLength += 1;
    }
  }

  return currentLineLength >= threshold;
};

export const hasLargeMarkdownWordCount = (markdown: string) => {
  let wordCount = 0;
  let inWord = false;

  for (let index = 0; index < markdown.length; index += 1) {
    const character = markdown.charCodeAt(index);
    const isWhitespace =
      character === 32 ||
      character === 9 ||
      character === 10 ||
      character === 13 ||
      character === 12 ||
      character === 11;

    if (isWhitespace) {
      inWord = false;
      continue;
    }

    if (!inWord) {
      wordCount += 1;
      if (wordCount >= LARGE_DOCUMENT_WORD_THRESHOLD) {
        return true;
      }
      inWord = true;
    }
  }

  return false;
};

export const hasLargeMarkdownDocumentShape = (markdown: string) => {
  let currentLineLength = 0;
  let currentTableRun = 0;
  let lineHasTableDelimiter = false;

  const finishLine = () => {
    if (currentLineLength >= LARGE_DOCUMENT_LONG_LINE_THRESHOLD) {
      return true;
    }

    currentTableRun = lineHasTableDelimiter ? currentTableRun + 1 : 0;
    if (currentTableRun >= LARGE_DOCUMENT_TABLE_RUN_THRESHOLD) {
      return true;
    }

    currentLineLength = 0;
    lineHasTableDelimiter = false;
    return false;
  };

  for (let index = 0; index < markdown.length; index += 1) {
    const characterCode = markdown.charCodeAt(index);
    if (characterCode === 10) {
      if (finishLine()) {
        return true;
      }
      continue;
    }

    if (characterCode !== 13) {
      currentLineLength += 1;
    }
    if (characterCode === 124) {
      lineHasTableDelimiter = true;
    }
  }

  return finishLine();
};

export const isLargeMarkdownDocument = (markdown: string) =>
  markdown.length >= LARGE_DOCUMENT_CHAR_THRESHOLD ||
  getMarkdownLineCount(markdown) >= LARGE_DOCUMENT_LINE_THRESHOLD ||
  hasLargeMarkdownWordCount(markdown) ||
  hasLargeMarkdownDocumentShape(markdown);

export const hasHeavyMarkdownPreviewShape = (markdown: string) => {
  const lines = markdown.split(/\r?\n/);
  let tableRun = 0;
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;
  let fenceLanguage = "";
  let fenceLineCount = 0;
  let fenceCharCount = 0;
  let inDisplayMath = false;

  const finishFence = () => {
    const isHeavyFence =
      heavyFenceLanguagePattern.test(fenceLanguage) ||
      fenceLineCount >= HEAVY_PREVIEW_FENCE_LINE_THRESHOLD ||
      fenceCharCount >= HEAVY_PREVIEW_FENCE_CHAR_THRESHOLD;
    fenceLanguage = "";
    fenceLineCount = 0;
    fenceCharCount = 0;
    return isHeavyFence;
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})\s*([A-Za-z0-9_-]+)?/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceChar = marker[0];
        fenceLength = marker.length;
        fenceLanguage = fenceMatch[2]?.toLowerCase() ?? "";
        fenceLineCount = 0;
        fenceCharCount = 0;
        if (heavyFenceLanguagePattern.test(fenceLanguage)) {
          return true;
        }
        continue;
      }

      if (marker[0] === fenceChar && marker.length >= fenceLength) {
        inFence = false;
        if (finishFence()) {
          return true;
        }
        continue;
      }
    }

    if (inFence) {
      fenceLineCount += 1;
      fenceCharCount += line.length;
      if (
        fenceLineCount >= HEAVY_PREVIEW_FENCE_LINE_THRESHOLD ||
        fenceCharCount >= HEAVY_PREVIEW_FENCE_CHAR_THRESHOLD
      ) {
        return true;
      }
      continue;
    }

    if (displayMathLinePattern.test(line)) {
      inDisplayMath = !inDisplayMath;
      return true;
    }

    if (inDisplayMath) {
      return true;
    }

    if (htmlLinePattern.test(line)) {
      return true;
    }

    tableRun = line.includes("|") ? tableRun + 1 : 0;
    if (tableRun >= HEAVY_PREVIEW_TABLE_RUN_THRESHOLD) {
      return true;
    }
  }

  return inFence ? finishFence() : false;
};

export const hasGlobalMarkdownSyntax = (markdown: string) => {
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;

  if (
    lines.length >= 3 &&
    frontmatterFencePattern.test(lines[0] ?? "") &&
    lines.slice(1, Math.min(lines.length, 40)).some((line) => yamlKeyLinePattern.test(line)) &&
    lines.slice(1).some((line) => frontmatterFencePattern.test(line))
  ) {
    return true;
  }

  for (const line of lines) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceChar = marker[0];
        fenceLength = marker.length;
        continue;
      }

      if (marker[0] === fenceChar && marker.length >= fenceLength) {
        inFence = false;
        continue;
      }
    }

    if (inFence) {
      continue;
    }

    if (
      footnoteDefinitionLinePattern.test(line) ||
      footnoteReferencePattern.test(line) ||
      referenceDefinitionLinePattern.test(line) ||
      referenceLinkPattern.test(line) ||
      definitionListLinePattern.test(line)
    ) {
      return true;
    }
  }

  return false;
};

export const shouldUseImmediateMarkdownPreview = (markdown: string) =>
  markdown.length <= LIVE_PREVIEW_CHAR_THRESHOLD &&
  !isLargeMarkdownDocument(markdown) &&
  !hasHeavyMarkdownPreviewShape(markdown);

const splitMarkdownLines = (markdown: string): MarkdownLine[] => {
  if (markdown.length === 0) {
    return [{ text: "", startOffset: 0, endOffset: 0 }];
  }

  const lines: MarkdownLine[] = [];
  let startOffset = 0;
  while (startOffset <= markdown.length) {
    const lineBreakIndex = markdown.indexOf("\n", startOffset);
    const rawEndOffset = lineBreakIndex === -1 ? markdown.length : lineBreakIndex;
    const endOffset =
      rawEndOffset > startOffset && markdown.charCodeAt(rawEndOffset - 1) === 13
        ? rawEndOffset - 1
        : rawEndOffset;
    lines.push({
      text: markdown.slice(startOffset, endOffset),
      startOffset,
      endOffset,
    });

    if (lineBreakIndex === -1) {
      break;
    }

    startOffset = lineBreakIndex + 1;
  }

  return lines;
};

const isBlankLine = (line: MarkdownLine) => line.text.trim().length === 0;

const startsStructuralBlock = (line: MarkdownLine, nextLine?: MarkdownLine) =>
  isBlankLine(line) ||
  fenceLinePattern.test(line.text) ||
  headingLinePattern.test(line.text) ||
  thematicLinePattern.test(line.text) ||
  blockquoteLinePattern.test(line.text) ||
  listLinePattern.test(line.text) ||
  referenceDefinitionLinePattern.test(line.text) ||
  footnoteDefinitionLinePattern.test(line.text) ||
  htmlLinePattern.test(line.text) ||
  isTableStart(line, nextLine);

const isTableStart = (line: MarkdownLine, nextLine?: MarkdownLine) =>
  Boolean(nextLine && line.text.includes("|") && tableSeparatorPattern.test(nextLine.text));

const getHeadingLevel = (text: string): 1 | 2 | 3 | 4 | 5 | 6 | undefined => {
  const match = text.match(/^ {0,3}(#{1,6})\s+\S/);
  const level = match?.[1]?.length;
  return level === 1 || level === 2 || level === 3 || level === 4 || level === 5 || level === 6
    ? level
    : undefined;
};

const estimateBlockHeight = (kind: PreviewBlockKind, lineCount: number, text = "") => {
  if (kind === "blank") {
    return 0;
  }

  if (kind === "fence") {
    return Math.max(54, lineCount * CODE_LINE_HEIGHT + 34);
  }

  if (kind === "heading") {
    return HEADING_ESTIMATED_HEIGHT_BY_LEVEL[getHeadingLevel(text) ?? 3];
  }

  if (kind === "table") {
    return Math.max(52, lineCount * DEFAULT_LINE_HEIGHT + 20);
  }

  return Math.max(DEFAULT_LINE_HEIGHT, lineCount * DEFAULT_LINE_HEIGHT) + BLOCK_GAP_HEIGHT;
};

const createBlock = (
  lines: MarkdownLine[],
  startIndex: number,
  endIndex: number,
  kind: PreviewBlockKind,
  estimatedTop: number,
): PreviewBlock => {
  const startLine = startIndex + 1;
  const endLine = endIndex + 1;
  const startOffset = lines[startIndex]?.startOffset ?? 0;
  const endOffset = lines[endIndex]?.endOffset ?? startOffset;
  const text = lines
    .slice(startIndex, endIndex + 1)
    .map((line) => line.text)
    .join("\n");
  const headingLevel = kind === "heading" ? getHeadingLevel(text) : undefined;
  const estimatedHeight = estimateBlockHeight(kind, endLine - startLine + 1, text);

  return {
    id: `${startLine}:${endLine}:${startOffset}`,
    kind,
    text,
    ...(headingLevel ? { headingLevel } : {}),
    startLine,
    endLine,
    startOffset,
    endOffset,
    estimatedTop,
    estimatedHeight,
  };
};

const findParagraphTextChunkEnd = (text: string, startOffset: number) => {
  const preferredEnd = Math.min(text.length, startOffset + PREVIEW_PARAGRAPH_CHAR_CHUNK_SIZE);
  if (preferredEnd >= text.length) {
    return text.length;
  }

  const searchEnd = Math.min(text.length, preferredEnd + 600);
  for (let index = preferredEnd; index < searchEnd; index += 1) {
    const character = text.charCodeAt(index);
    if (character === 32 || character === 9) {
      return index + 1;
    }
  }

  return preferredEnd;
};

const createParagraphTextChunkBlock = (
  line: MarkdownLine,
  lineIndex: number,
  chunkStart: number,
  chunkEnd: number,
  estimatedTop: number,
): PreviewBlock => {
  const startLine = lineIndex + 1;
  const startOffset = line.startOffset + chunkStart;
  const endOffset = line.startOffset + chunkEnd;
  const text = line.text.slice(chunkStart, chunkEnd);
  const estimatedLineCount = Math.max(1, Math.ceil(text.length / PREVIEW_PARAGRAPH_ESTIMATED_CHARS_PER_LINE));
  const estimatedHeight = estimateBlockHeight("paragraph", estimatedLineCount, text);

  return {
    id: `${startLine}:${startLine}:${startOffset}:${endOffset}`,
    kind: "paragraph",
    text,
    startLine,
    endLine: startLine,
    startOffset,
    endOffset,
    estimatedTop,
    estimatedHeight,
  };
};

const createParagraphBlocks = (
  lines: MarkdownLine[],
  startIndex: number,
  endIndex: number,
  estimatedTop: number,
): { blocks: PreviewBlock[]; estimatedTop: number } => {
  const blocks: PreviewBlock[] = [];

  if (startIndex === endIndex && lines[startIndex].text.length > PREVIEW_PARAGRAPH_CHAR_CHUNK_SIZE) {
    const line = lines[startIndex];
    let chunkStart = 0;
    let nextEstimatedTop = estimatedTop;
    while (chunkStart < line.text.length) {
      const chunkEnd = findParagraphTextChunkEnd(line.text, chunkStart);
      const block = createParagraphTextChunkBlock(line, startIndex, chunkStart, chunkEnd, nextEstimatedTop);
      blocks.push(block);
      nextEstimatedTop += block.estimatedHeight;
      chunkStart = chunkEnd;
    }
    return { blocks, estimatedTop: nextEstimatedTop };
  }

  let chunkStartIndex = startIndex;
  let nextEstimatedTop = estimatedTop;
  while (chunkStartIndex <= endIndex) {
    const chunkEndIndex = Math.min(endIndex, chunkStartIndex + PREVIEW_PARAGRAPH_LINE_CHUNK_SIZE - 1);
    const block = createBlock(lines, chunkStartIndex, chunkEndIndex, "paragraph", nextEstimatedTop);
    blocks.push(block);
    nextEstimatedTop += block.estimatedHeight;
    chunkStartIndex = chunkEndIndex + 1;
  }

  return { blocks, estimatedTop: nextEstimatedTop };
};

const findFenceEnd = (lines: MarkdownLine[], startIndex: number) => {
  const openingMatch = lines[startIndex]?.text.match(fenceLinePattern);
  if (!openingMatch) {
    return startIndex;
  }

  const marker = openingMatch[1];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const closingMatch = lines[index].text.match(fenceLinePattern);
    if (closingMatch && closingMatch[1][0] === marker[0] && closingMatch[1].length >= marker.length) {
      return index;
    }
  }

  return lines.length - 1;
};

const getHtmlBlockOpeningTagName = (line: string) => {
  const match = line.match(/^ {0,3}<([A-Za-z][A-Za-z0-9-]*)(?:\s|>|\/>)/);
  if (!match || line.trimStart().startsWith("</")) {
    return null;
  }

  const tagName = match[1];
  const closingPattern = new RegExp(`</${tagName}>`, "i");
  if (closingPattern.test(line) || /\/>\s*$/.test(line)) {
    return null;
  }

  return tagName;
};

const findPairedHtmlEnd = (lines: MarkdownLine[], startIndex: number) => {
  const tagName = getHtmlBlockOpeningTagName(lines[startIndex]?.text ?? "");
  if (!tagName) {
    return null;
  }

  const openingPattern = new RegExp(`^ {0,3}<${tagName}(?:\\s|>|/>)`, "i");
  const closingPattern = new RegExp(`</${tagName}>`, "i");
  let depth = 0;

  for (let index = startIndex; index < lines.length; index += 1) {
    const text = lines[index].text;
    if (openingPattern.test(text) && !/\/>\s*$/.test(text) && !closingPattern.test(text)) {
      depth += 1;
    }

    if (closingPattern.test(text)) {
      depth -= 1;
      if (depth <= 0) {
        return index;
      }
    }
  }

  return null;
};

const findHtmlEnd = (lines: MarkdownLine[], startIndex: number) => {
  const pairedHtmlEnd = findPairedHtmlEnd(lines, startIndex);
  if (pairedHtmlEnd !== null) {
    return pairedHtmlEnd;
  }

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (isBlankLine(lines[index])) {
      return index - 1;
    }
  }
  return lines.length - 1;
};

const findListEnd = (lines: MarkdownLine[], startIndex: number) => {
  let sawBlank = false;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isBlankLine(line)) {
      sawBlank = true;
      continue;
    }
    if (listLinePattern.test(line.text) || indentedContinuationPattern.test(line.text)) {
      sawBlank = false;
      continue;
    }
    return sawBlank ? index - 2 : index - 1;
  }
  return lines.length - 1;
};

const findBlockquoteEnd = (lines: MarkdownLine[], startIndex: number) => {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (isBlankLine(lines[index])) {
      return index - 1;
    }
    if (!blockquoteLinePattern.test(lines[index].text)) {
      return index - 1;
    }
  }
  return lines.length - 1;
};

const findTableEnd = (lines: MarkdownLine[], startIndex: number) => {
  for (let index = startIndex + 2; index < lines.length; index += 1) {
    if (!lines[index].text.includes("|") || isBlankLine(lines[index])) {
      return index - 1;
    }
  }
  return lines.length - 1;
};

const findFootnoteDefinitionEnd = (lines: MarkdownLine[], startIndex: number) => {
  let endIndex = startIndex;
  let index = startIndex + 1;

  while (index < lines.length) {
    if (footnoteContinuationLinePattern.test(lines[index].text)) {
      endIndex = index;
      index += 1;
      continue;
    }

    if (!isBlankLine(lines[index])) {
      break;
    }

    let continuationIndex = index;
    while (continuationIndex < lines.length && isBlankLine(lines[continuationIndex])) {
      continuationIndex += 1;
    }
    if (
      continuationIndex >= lines.length ||
      !footnoteContinuationLinePattern.test(lines[continuationIndex].text)
    ) {
      break;
    }

    endIndex = continuationIndex;
    index = continuationIndex + 1;
  }

  return endIndex;
};

const findParagraphEnd = (lines: MarkdownLine[], startIndex: number) => {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (startsStructuralBlock(lines[index], lines[index + 1])) {
      return index - 1;
    }
  }
  return lines.length - 1;
};

const resolveBlockRange = (lines: MarkdownLine[], startIndex: number) => {
  const line = lines[startIndex];
  const nextLine = lines[startIndex + 1];

  if (isBlankLine(line)) {
    let endIndex = startIndex;
    while (endIndex + 1 < lines.length && isBlankLine(lines[endIndex + 1])) {
      endIndex += 1;
    }
    return { endIndex, kind: "blank" as const };
  }

  if (fenceLinePattern.test(line.text)) {
    return { endIndex: findFenceEnd(lines, startIndex), kind: "fence" as const };
  }

  if (isTableStart(line, nextLine)) {
    return { endIndex: findTableEnd(lines, startIndex), kind: "table" as const };
  }

  if (headingLinePattern.test(line.text)) {
    return { endIndex: startIndex, kind: "heading" as const };
  }

  if (thematicLinePattern.test(line.text)) {
    return { endIndex: startIndex, kind: "thematic" as const };
  }

  if (referenceDefinitionLinePattern.test(line.text)) {
    return { endIndex: startIndex, kind: "blank" as const };
  }

  if (footnoteDefinitionLinePattern.test(line.text)) {
    return { endIndex: findFootnoteDefinitionEnd(lines, startIndex), kind: "blank" as const };
  }

  if (blockquoteLinePattern.test(line.text)) {
    return { endIndex: findBlockquoteEnd(lines, startIndex), kind: "blockquote" as const };
  }

  if (listLinePattern.test(line.text)) {
    return { endIndex: findListEnd(lines, startIndex), kind: "list" as const };
  }

  if (htmlLinePattern.test(line.text)) {
    return { endIndex: findHtmlEnd(lines, startIndex), kind: "html" as const };
  }

  return { endIndex: findParagraphEnd(lines, startIndex), kind: "paragraph" as const };
};

export const createPreviewBlockIndex = (markdown: string): PreviewBlockIndex => {
  const lines = splitMarkdownLines(markdown);
  const blocks: PreviewBlock[] = [];
  let lineIndex = 0;
  let estimatedTop = 0;

  while (lineIndex < lines.length) {
    const { endIndex, kind } = resolveBlockRange(lines, lineIndex);
    const safeEndIndex = Math.max(lineIndex, Math.min(endIndex, lines.length - 1));
    if (kind === "paragraph") {
      const paragraphBlocks = createParagraphBlocks(lines, lineIndex, safeEndIndex, estimatedTop);
      blocks.push(...paragraphBlocks.blocks);
      estimatedTop = paragraphBlocks.estimatedTop;
      lineIndex = safeEndIndex + 1;
      continue;
    }

    const block = createBlock(lines, lineIndex, safeEndIndex, kind, estimatedTop);
    blocks.push(block);
    estimatedTop += block.estimatedHeight;
    lineIndex = safeEndIndex + 1;
  }

  return {
    blocks,
    lineCount: lines.length,
    totalEstimatedHeight: estimatedTop,
  };
};

type TextChangeRange = {
  nextEndOffset: number;
  nextStartOffset: number;
  previousEndOffset: number;
  previousStartOffset: number;
};

const getTextChangeRange = (previousMarkdown: string, nextMarkdown: string): TextChangeRange | null => {
  if (previousMarkdown === nextMarkdown) {
    return null;
  }

  const sharedLength = Math.min(previousMarkdown.length, nextMarkdown.length);
  let startOffset = 0;
  while (
    startOffset < sharedLength &&
    previousMarkdown.charCodeAt(startOffset) === nextMarkdown.charCodeAt(startOffset)
  ) {
    startOffset += 1;
  }

  let suffixLength = 0;
  const maxSuffixLength = sharedLength - startOffset;
  while (
    suffixLength < maxSuffixLength &&
    previousMarkdown.charCodeAt(previousMarkdown.length - suffixLength - 1) ===
      nextMarkdown.charCodeAt(nextMarkdown.length - suffixLength - 1)
  ) {
    suffixLength += 1;
  }

  return {
    nextEndOffset: nextMarkdown.length - suffixLength,
    nextStartOffset: startOffset,
    previousEndOffset: previousMarkdown.length - suffixLength,
    previousStartOffset: startOffset,
  };
};

const getTextChangeRangeFromPatches = (
  previousMarkdown: string,
  nextMarkdown: string,
  patches: readonly TextPatch[],
): TextChangeRange | null | undefined => {
  if (patches.length === 0) {
    return previousMarkdown === nextMarkdown ? null : undefined;
  }

  const normalizedPatches = normalizeTextPatches(patches);
  if (applyTextPatches(previousMarkdown, normalizedPatches) !== nextMarkdown) {
    return undefined;
  }

  let previousStartOffset = Number.POSITIVE_INFINITY;
  let previousEndOffset = 0;
  let nextStartOffset = Number.POSITIVE_INFINITY;
  let nextEndOffset = 0;
  let offsetDelta = 0;

  for (const patch of normalizedPatches) {
    const nextPatchStartOffset = patch.from + offsetDelta;
    const nextPatchEndOffset = nextPatchStartOffset + patch.insert.length;
    previousStartOffset = Math.min(previousStartOffset, patch.from);
    previousEndOffset = Math.max(previousEndOffset, patch.to);
    nextStartOffset = Math.min(nextStartOffset, nextPatchStartOffset);
    nextEndOffset = Math.max(nextEndOffset, nextPatchEndOffset);
    offsetDelta += patch.insert.length - (patch.to - patch.from);
  }

  return {
    nextEndOffset,
    nextStartOffset,
    previousEndOffset,
    previousStartOffset,
  };
};

const getLineNumberForMarkdownOffset = (lines: readonly MarkdownLine[], offset: number) => {
  if (lines.length === 0) {
    return 1;
  }

  const clampedOffset = Math.max(0, offset);
  for (let index = 0; index < lines.length; index += 1) {
    const nextLineStartOffset = lines[index + 1]?.startOffset;
    if (typeof nextLineStartOffset !== "number" || clampedOffset < nextLineStartOffset) {
      return index + 1;
    }
  }

  return lines.length;
};

const getChangedLineSpan = (
  lines: readonly MarkdownLine[],
  startOffset: number,
  endOffset: number,
) => {
  const startLine = getLineNumberForMarkdownOffset(lines, startOffset);
  const endLine = getLineNumberForMarkdownOffset(lines, Math.max(startOffset, endOffset - 1));
  return {
    endLine: Math.max(startLine, endLine),
    startLine,
  };
};

const isOptimisticStructuralLine = (
  line: MarkdownLine | undefined,
  nextLine?: MarkdownLine,
) => {
  if (!line) {
    return true;
  }

  return (
    fenceLinePattern.test(line.text) ||
    thematicLinePattern.test(line.text) ||
    blockquoteLinePattern.test(line.text) ||
    listLinePattern.test(line.text) ||
    tableSeparatorPattern.test(line.text) ||
    isTableStart(line, nextLine) ||
    htmlLinePattern.test(line.text) ||
    displayMathLinePattern.test(line.text) ||
    frontmatterFencePattern.test(line.text)
  );
};

const isUnsafeOptimisticChangedLine = (
  lines: readonly MarkdownLine[],
  lineIndex: number,
  options: { blankIsUnsafe: boolean },
) => {
  const line = lines[lineIndex];
  if (!line) {
    return true;
  }

  if (isBlankLine(line)) {
    return (
      options.blankIsUnsafe &&
      (
        isOptimisticStructuralLine(lines[lineIndex - 1], line) ||
        isOptimisticStructuralLine(lines[lineIndex + 1], lines[lineIndex + 2])
      )
    );
  }

  return isOptimisticStructuralLine(line, lines[lineIndex + 1]);
};

const hasUnsafeOptimisticChangedLines = (
  lines: readonly MarkdownLine[],
  span: { endLine: number; startLine: number },
  options: { blankIsUnsafe?: boolean } = {},
) => {
  const startIndex = Math.max(0, span.startLine - 1);
  const endIndex = Math.min(lines.length - 1, span.endLine - 1);
  const blankIsUnsafe = options.blankIsUnsafe ?? true;

  for (let index = startIndex; index <= endIndex; index += 1) {
    if (isUnsafeOptimisticChangedLine(lines, index, { blankIsUnsafe })) {
      return true;
    }
  }

  return false;
};

const findFirstPreviewBlockIndexAtLine = (blocks: readonly PreviewBlock[], lineNumber: number) =>
  blocks.findIndex((block) => block.endLine >= lineNumber);

const findLastPreviewBlockIndexAtLine = (blocks: readonly PreviewBlock[], lineNumber: number) => {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (blocks[index].startLine <= lineNumber) {
      return index;
    }
  }
  return -1;
};

const getLineStartOffsetFromLines = (lines: readonly MarkdownLine[], lineNumber: number) =>
  lines[Math.max(0, Math.min(lines.length - 1, lineNumber - 1))]?.startOffset ?? 0;

const getLineEndOffsetFromLines = (lines: readonly MarkdownLine[], lineNumber: number) =>
  lines[Math.max(0, Math.min(lines.length - 1, lineNumber - 1))]?.endOffset ?? 0;

const rekeyPreviewBlock = (
  block: PreviewBlock,
  startLine: number,
  endLine: number,
  startOffset: number,
  endOffset: number,
) => {
  const hasExplicitEndOffset = block.id.split(":").length >= 4;
  return hasExplicitEndOffset
    ? `${startLine}:${endLine}:${startOffset}:${endOffset}`
    : `${startLine}:${endLine}:${startOffset}`;
};

const rebasePreviewBlock = (
  block: PreviewBlock,
  options: {
    lineOffset: number;
    offsetBase: number;
  },
): PreviewBlock => {
  const startLine = block.startLine + options.lineOffset;
  const endLine = block.endLine + options.lineOffset;
  const startOffset = block.startOffset + options.offsetBase;
  const endOffset = block.endOffset + options.offsetBase;

  return {
    ...block,
    id: rekeyPreviewBlock(block, startLine, endLine, startOffset, endOffset),
    startLine,
    endLine,
    startOffset,
    endOffset,
  };
};

const shiftPreviewBlock = (
  block: PreviewBlock,
  options: {
    charDelta: number;
    lineDelta: number;
  },
): PreviewBlock => {
  if (options.charDelta === 0 && options.lineDelta === 0) {
    return block;
  }

  const startLine = block.startLine + options.lineDelta;
  const endLine = block.endLine + options.lineDelta;
  const startOffset = block.startOffset + options.charDelta;
  const endOffset = block.endOffset + options.charDelta;

  return {
    ...block,
    id: rekeyPreviewBlock(block, startLine, endLine, startOffset, endOffset),
    startLine,
    endLine,
    startOffset,
    endOffset,
  };
};

const reflowPreviewBlockTops = (blocks: readonly PreviewBlock[]) => {
  let estimatedTop = 0;
  return blocks.map((block) => {
    const nextBlock = block.estimatedTop === estimatedTop ? block : { ...block, estimatedTop };
    estimatedTop += nextBlock.estimatedHeight;
    return nextBlock;
  });
};

const createOptimisticPreviewBlockIndexForChangeRange = (
  previousIndex: PreviewBlockIndex,
  previousMarkdown: string,
  nextMarkdown: string,
  changeRange: TextChangeRange | null,
): PreviewBlockIndex | null => {
  if (!changeRange) {
    return previousIndex;
  }
  if (previousIndex.blocks.length === 0) {
    return null;
  }

  const previousLines = splitMarkdownLines(previousMarkdown);
  const nextLines = splitMarkdownLines(nextMarkdown);
  const previousChangedLineSpan = getChangedLineSpan(
    previousLines,
    changeRange.previousStartOffset,
    changeRange.previousEndOffset,
  );
  const nextChangedLineSpan = getChangedLineSpan(
    nextLines,
    changeRange.nextStartOffset,
    changeRange.nextEndOffset,
  );
  const changedLineCount = Math.max(
    previousChangedLineSpan.endLine - previousChangedLineSpan.startLine + 1,
    nextChangedLineSpan.endLine - nextChangedLineSpan.startLine + 1,
  );
  if (changedLineCount > OPTIMISTIC_INDEX_MAX_CHANGED_LINES) {
    return null;
  }
  if (
    hasUnsafeOptimisticChangedLines(previousLines, previousChangedLineSpan) ||
    hasUnsafeOptimisticChangedLines(nextLines, nextChangedLineSpan, { blankIsUnsafe: false })
  ) {
    return null;
  }

  const firstChangedBlockIndex = findFirstPreviewBlockIndexAtLine(
    previousIndex.blocks,
    previousChangedLineSpan.startLine,
  );
  const lastChangedBlockIndex = findLastPreviewBlockIndexAtLine(
    previousIndex.blocks,
    previousChangedLineSpan.endLine,
  );
  if (firstChangedBlockIndex === -1 || lastChangedBlockIndex === -1) {
    return null;
  }

  const replaceStartBlockIndex = Math.max(
    0,
    firstChangedBlockIndex - OPTIMISTIC_INDEX_CONTEXT_BLOCK_COUNT,
  );
  const replaceEndBlockIndex = Math.min(
    previousIndex.blocks.length - 1,
    lastChangedBlockIndex + OPTIMISTIC_INDEX_CONTEXT_BLOCK_COUNT,
  );
  const replaceStartBlock = previousIndex.blocks[replaceStartBlockIndex];
  const replaceEndBlock = previousIndex.blocks[replaceEndBlockIndex];
  const lineDelta = nextLines.length - previousLines.length;
  const charDelta = nextMarkdown.length - previousMarkdown.length;
  const nextReplaceStartLine = Math.max(1, Math.min(nextLines.length, replaceStartBlock.startLine));
  const nextReplaceEndLine = Math.max(
    nextReplaceStartLine,
    Math.min(nextLines.length, replaceEndBlock.endLine + lineDelta),
  );
  const sliceStartOffset = getLineStartOffsetFromLines(nextLines, nextReplaceStartLine);
  const sliceEndOffset = getLineEndOffsetFromLines(nextLines, nextReplaceEndLine);
  const replacementIndex = createPreviewBlockIndex(nextMarkdown.slice(sliceStartOffset, sliceEndOffset));
  const replacementBlocks = replacementIndex.blocks.map((block) =>
    rebasePreviewBlock(block, {
      lineOffset: nextReplaceStartLine - 1,
      offsetBase: sliceStartOffset,
    }),
  );
  const suffixBlocks = previousIndex.blocks
    .slice(replaceEndBlockIndex + 1)
    .map((block) => shiftPreviewBlock(block, { charDelta, lineDelta }));
  const blocks = reflowPreviewBlockTops([
    ...previousIndex.blocks.slice(0, replaceStartBlockIndex),
    ...replacementBlocks,
    ...suffixBlocks,
  ]);
  const totalEstimatedHeight = blocks.reduce((total, block) => total + block.estimatedHeight, 0);

  return {
    blocks,
    lineCount: nextLines.length,
    totalEstimatedHeight,
  };
};

export const createOptimisticPreviewBlockIndex = (
  previousIndex: PreviewBlockIndex,
  previousMarkdown: string,
  nextMarkdown: string,
): PreviewBlockIndex | null =>
  createOptimisticPreviewBlockIndexForChangeRange(
    previousIndex,
    previousMarkdown,
    nextMarkdown,
    getTextChangeRange(previousMarkdown, nextMarkdown),
  );

export const createOptimisticPreviewBlockIndexFromPatches = (
  previousIndex: PreviewBlockIndex,
  previousMarkdown: string,
  nextMarkdown: string,
  patches: readonly TextPatch[],
): PreviewBlockIndex | null => {
  const changeRange = getTextChangeRangeFromPatches(previousMarkdown, nextMarkdown, patches);
  return changeRange === undefined
    ? null
    : createOptimisticPreviewBlockIndexForChangeRange(
        previousIndex,
        previousMarkdown,
        nextMarkdown,
        changeRange,
      );
};

export const applyPreviewBlockMeasurements = (
  index: PreviewBlockIndex,
  measurements: PreviewBlockMeasurements,
): PreviewBlockIndex => {
  let estimatedTop = 0;
  const blocks = index.blocks.map((block) => {
    const measuredHeight = measurements[block.id];
    const estimatedHeight =
      Number.isFinite(measuredHeight) && measuredHeight >= 0
        ? measuredHeight
        : block.estimatedHeight;
    const measuredBlock =
      block.estimatedTop === estimatedTop && block.estimatedHeight === estimatedHeight
        ? block
        : {
            ...block,
            estimatedTop,
            estimatedHeight,
          };
    estimatedTop += estimatedHeight;
    return measuredBlock;
  });

  return {
    ...index,
    blocks,
    totalEstimatedHeight: estimatedTop,
  };
};

export const choosePreviewRenderableAnchor = <TAnchor extends PreviewRenderableAnchor>(
  anchors: readonly TAnchor[],
  sourceLineNumber: number,
): TAnchor | null => {
  const targetLine = Math.max(1, Math.floor(sourceLineNumber));
  const measuredAnchors = anchors
    .filter((anchor) => Number.isFinite(anchor.startLine) && Number.isFinite(anchor.endLine))
    .map((anchor) => ({
      ...anchor,
      endLine: Math.max(anchor.startLine, anchor.endLine),
      startLine: anchor.startLine,
    }));
  const targetLineHasUnrenderedAnchor = measuredAnchors.some(
    (anchor) => anchor.startLine <= targetLine && anchor.endLine >= targetLine && !anchor.rendered,
  );
  const renderableAnchors = measuredAnchors.filter((anchor) => anchor.rendered);

  if (renderableAnchors.length === 0) {
    return null;
  }

  const scoreAnchor = (anchor: TAnchor) => {
    const containsTarget = anchor.startLine <= targetLine && anchor.endLine >= targetLine;
    const sourceElementScore = anchor.sourceElement ? 0 : 1;

    if (containsTarget) {
      return [0, sourceElementScore, Math.abs(anchor.startLine - targetLine)];
    }

    if (anchor.endLine < targetLine) {
      return [
        targetLineHasUnrenderedAnchor ? 2 : 1,
        targetLine - anchor.endLine,
        sourceElementScore,
      ];
    }

    return [
      targetLineHasUnrenderedAnchor ? 1 : 2,
      anchor.startLine - targetLine,
      sourceElementScore,
    ];
  };

  return [...renderableAnchors].sort((first, second) => {
    const firstScore = scoreAnchor(first);
    const secondScore = scoreAnchor(second);
    for (let index = 0; index < firstScore.length; index += 1) {
      const difference = firstScore[index] - secondScore[index];
      if (difference !== 0) {
        return difference;
      }
    }

    return first.startLine - second.startLine;
  })[0] ?? null;
};

const isPreviewBlockRenderableForScrollMap = (block: PreviewBlock) =>
  block.kind !== "blank" && block.estimatedHeight > 0;

const clampPreviewScrollTop = (scrollTop: number, totalHeight: number, viewportHeight: number) =>
  Math.max(0, Math.min(Math.max(0, totalHeight - viewportHeight), scrollTop));

export const getPreviewScrollTopForSourceLine = (
  index: PreviewBlockIndex,
  anchor: PreviewScrollMapAnchor,
  options: PreviewScrollMapOptions,
) => {
  const viewportHeight = Math.max(1, options.viewportHeight);
  const edgePadding = options.edgePadding ?? 32;

  if (anchor.align === "end") {
    return clampPreviewScrollTop(index.totalEstimatedHeight, index.totalEstimatedHeight, viewportHeight);
  }

  const targetLine = Math.max(1, Math.floor(anchor.lineNumber));
  const lineOffsetRatio = Math.max(0, Math.min(1, anchor.lineOffsetRatio ?? 0));
  const sourceBlock = mapPreviewLineToBlock(index, targetLine);
  const renderableBlocks = index.blocks.filter(isPreviewBlockRenderableForScrollMap);
  if (renderableBlocks.length === 0) {
    return 0;
  }

  if (sourceBlock && isPreviewBlockRenderableForScrollMap(sourceBlock)) {
    const blockLineCount = Math.max(1, sourceBlock.endLine - sourceBlock.startLine + 1);
    const blockLineOffset = Math.max(
      0,
      Math.min(blockLineCount, targetLine - sourceBlock.startLine + lineOffsetRatio),
    );
    const blockRatio = blockLineOffset / blockLineCount;
    return clampPreviewScrollTop(
      sourceBlock.estimatedTop + sourceBlock.estimatedHeight * blockRatio - edgePadding,
      index.totalEstimatedHeight,
      viewportHeight,
    );
  }

  const fallbackBlock = choosePreviewRenderableAnchor(
    index.blocks.map((block) => ({
      ...block,
      rendered: isPreviewBlockRenderableForScrollMap(block),
    })),
    targetLine,
  );
  if (!fallbackBlock) {
    return 0;
  }

  const fallbackTop =
    fallbackBlock.endLine < targetLine
      ? fallbackBlock.estimatedTop + fallbackBlock.estimatedHeight
      : fallbackBlock.estimatedTop;
  return clampPreviewScrollTop(fallbackTop - edgePadding, index.totalEstimatedHeight, viewportHeight);
};

export const getPreviewWindow = (
  index: PreviewBlockIndex,
  scrollTop: number,
  viewportHeight: number,
  overscan = 1_200,
): PreviewWindow => {
  if (index.blocks.length === 0) {
    return {
      blocks: [],
      startIndex: 0,
      endIndex: 0,
    };
  }

  const leadingOverscan = Math.min(overscan, PREVIEW_WINDOW_MAX_LEADING_OVERSCAN);
  const trailingOverscan = overscan + (overscan - leadingOverscan);
  const windowTop = Math.max(0, scrollTop - leadingOverscan);
  const windowBottom = Math.max(windowTop, scrollTop + viewportHeight + trailingOverscan);
  const firstVisibleIndex = index.blocks.findIndex(
    (block) => block.estimatedTop + block.estimatedHeight >= windowTop,
  );
  const startIndex = firstVisibleIndex === -1 ? index.blocks.length - 1 : Math.max(0, firstVisibleIndex);
  let endIndex = startIndex;

  while (
    endIndex < index.blocks.length &&
    index.blocks[endIndex].estimatedTop <= windowBottom
  ) {
    endIndex += 1;
  }

  const scrollRatio =
    index.totalEstimatedHeight <= 0 ? 0 : Math.max(0, Math.min(1, scrollTop / index.totalEstimatedHeight));
  const leadingBlockPadding =
    scrollRatio >= PREVIEW_WINDOW_END_SCROLL_RATIO
      ? PREVIEW_WINDOW_END_LEADING_BLOCK_PADDING
      : PREVIEW_WINDOW_LEADING_BLOCK_PADDING;
  const trailingBlockPadding =
    scrollRatio >= PREVIEW_WINDOW_END_SCROLL_RATIO
      ? PREVIEW_WINDOW_END_TRAILING_BLOCK_PADDING
      : PREVIEW_WINDOW_TRAILING_BLOCK_PADDING;
  const paddedStartIndex = Math.max(0, startIndex - leadingBlockPadding);
  const paddedEndIndex = Math.min(index.blocks.length, endIndex + trailingBlockPadding);

  return {
    blocks: index.blocks.slice(paddedStartIndex, paddedEndIndex),
    startIndex: paddedStartIndex,
    endIndex: paddedEndIndex,
  };
};

export const mapPreviewLineToBlock = (index: PreviewBlockIndex, lineNumber: number) =>
  index.blocks.find((block) => block.startLine <= lineNumber && block.endLine >= lineNumber) ?? null;
