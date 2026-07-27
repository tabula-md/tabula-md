import type { EditorState } from "@codemirror/state";
import {
  isEditorVisualNavigableReplacement,
  type EditorVisualBlockRange,
  type EditorVisualReplacement,
  type EditorVisualSourceMap,
} from "./editorVisualModeModel";

export type EditorVisualPointerGeometry = {
  clientX: number;
  clientY: number;
  height: number;
  left: number;
  top: number;
  width: number;
};

export type EditorVisualPointerTextPoint = {
  renderedOffset: number;
  renderedText: string;
  sourceRange?: EditorVisualBlockRange;
};

type CaretPositionDocument = Document & {
  caretPositionFromPoint?: (
    x: number,
    y: number,
  ) => { offset: number; offsetNode: Node } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

const readElementSourceRange = (
  element: HTMLElement,
): EditorVisualBlockRange | undefined => {
  const from = Number(element.dataset.visualContentFrom);
  const to = Number(element.dataset.visualContentTo);
  return Number.isSafeInteger(from) &&
      Number.isSafeInteger(to) &&
      from >= 0 &&
      to >= from
    ? { from, to }
    : undefined;
};

const readCaretPoint = (
  ownerDocument: Document,
  clientX: number,
  clientY: number,
) => {
  const caretDocument = ownerDocument as CaretPositionDocument;
  const position = caretDocument.caretPositionFromPoint?.(clientX, clientY);
  if (position) {
    return {
      node: position.offsetNode,
      offset: position.offset,
    };
  }
  const range = caretDocument.caretRangeFromPoint?.(clientX, clientY);
  return range
    ? {
        node: range.startContainer,
        offset: range.startOffset,
      }
    : null;
};

export const readEditorVisualPointerTextPoint = (
  container: HTMLElement,
  clientX: number,
  clientY: number,
): EditorVisualPointerTextPoint | null => {
  const caret = readCaretPoint(container.ownerDocument, clientX, clientY);
  if (!caret || !container.contains(caret.node)) return null;
  const caretElement = caret.node instanceof Element
    ? caret.node
    : caret.node.parentElement;
  const content = caretElement?.closest<HTMLElement>(
    "[data-visual-content-from][data-visual-content-to]",
  ) ?? container;
  if (!container.contains(content) || !content.contains(caret.node)) return null;

  const prefix = container.ownerDocument.createRange();
  prefix.selectNodeContents(content);
  try {
    prefix.setEnd(caret.node, caret.offset);
  } catch {
    return null;
  }
  return {
    renderedOffset: prefix.toString().length,
    renderedText: content.textContent ?? "",
    sourceRange: readElementSourceRange(content),
  };
};

const findNextSourceCharacter = (
  source: string,
  character: string,
  from: number,
) => {
  if (/\s/u.test(character)) {
    for (let index = from; index < source.length; index += 1) {
      if (/\s/u.test(source[index] ?? "")) return index;
    }
    return -1;
  }
  return source.indexOf(character, from);
};

export const mapEditorVisualRenderedOffsetToSource = (
  source: string,
  renderedText: string,
  renderedOffset: number,
) => {
  const targetOffset = Math.max(0, Math.min(renderedText.length, renderedOffset));
  let sourceCursor = 0;
  let targetBoundary: number | null = targetOffset === renderedText.length
    ? source.length
    : null;

  for (let renderedCursor = 0; renderedCursor < renderedText.length; renderedCursor += 1) {
    const character = renderedText[renderedCursor] ?? "";
    const sourceIndex = findNextSourceCharacter(source, character, sourceCursor);
    if (sourceIndex < 0) return null;
    if (renderedCursor === targetOffset) targetBoundary = sourceIndex;
    sourceCursor = sourceIndex + 1;
  }
  return targetBoundary ?? sourceCursor;
};

export const getEditorVisualSourceMap = (
  replacement: Pick<EditorVisualReplacement, "from" | "sourceMap" | "to">,
): EditorVisualSourceMap => replacement.sourceMap ?? {
  range: {
    from: replacement.from,
    to: replacement.to,
  },
};

export const findEditorVisualMappedBlockAt = (
  replacements: readonly EditorVisualReplacement[],
  position: number,
) => replacements.find((replacement) =>
  isEditorVisualNavigableReplacement(replacement) &&
  position >= replacement.from &&
  position <= replacement.to);

export const findEditorVisualMappedBlockOnLine = (
  state: EditorState,
  replacements: readonly EditorVisualReplacement[],
  lineNumber: number,
) => replacements.find((replacement) => {
  if (!isEditorVisualNavigableReplacement(replacement)) return false;
  const sourceMap = getEditorVisualSourceMap(replacement);
  const firstLine = state.doc.lineAt(sourceMap.range.from).number;
  const lastLine = state.doc.lineAt(
    Math.max(sourceMap.range.from, sourceMap.range.to - 1),
  ).number;
  return lineNumber >= firstLine && lineNumber <= lastLine;
});

export const getEditorVisualBlockEntryPosition = (
  state: EditorState,
  block: Pick<EditorVisualReplacement, "from" | "sourceMap" | "to">,
  forward: boolean,
  goalColumn = 0,
) => {
  const sourceMap = getEditorVisualSourceMap(block);
  const position = forward
    ? sourceMap.range.from
    : Math.max(sourceMap.range.from, sourceMap.range.to - 1);
  const line = state.doc.lineAt(position);
  return Math.min(line.to, line.from + Math.max(0, goalColumn));
};

export const getEditorVisualPointerPosition = (
  state: EditorState,
  block: Pick<EditorVisualReplacement, "from" | "sourceMap" | "to">,
  geometry: EditorVisualPointerGeometry,
  textPoint?: EditorVisualPointerTextPoint | null,
) => {
  const sourceMap = getEditorVisualSourceMap(block);
  const pointerRange = sourceMap.contentRange ?? sourceMap.range;
  const textRange = textPoint?.sourceRange ?? pointerRange;
  if (
    textPoint &&
    textRange.from >= pointerRange.from &&
    textRange.to <= pointerRange.to
  ) {
    const sourceOffset = mapEditorVisualRenderedOffsetToSource(
      state.doc.sliceString(textRange.from, textRange.to),
      textPoint.renderedText,
      textPoint.renderedOffset,
    );
    if (sourceOffset !== null) {
      return Math.min(textRange.to, textRange.from + sourceOffset);
    }
  }
  const firstLine = state.doc.lineAt(pointerRange.from).number;
  const lastLine = state.doc.lineAt(
    Math.max(pointerRange.from, pointerRange.to - 1),
  ).number;
  const verticalRatio = geometry.height <= 0
    ? 0
    : Math.max(
        0,
        Math.min(0.999_999, (geometry.clientY - geometry.top) / geometry.height),
      );
  const lineNumber = firstLine +
    Math.floor(verticalRatio * (lastLine - firstLine + 1));
  const line = state.doc.line(lineNumber);
  const horizontalRatio = geometry.width <= 0
    ? 0
    : Math.max(
        0,
        Math.min(1, (geometry.clientX - geometry.left) / geometry.width),
      );
  const lineFrom = Math.max(line.from, pointerRange.from);
  const lineTo = Math.min(line.to, pointerRange.to);
  return Math.round(lineFrom + (lineTo - lineFrom) * horizontalRatio);
};

export const readEditorVisualBlockRange = (
  target: EventTarget | null,
): EditorVisualBlockRange | null => {
  if (!(target instanceof Element)) return null;
  const block = target.closest<HTMLElement>("[data-visual-from][data-visual-to]");
  if (!block) return null;
  const from = Number(block.dataset.visualFrom);
  const to = Number(block.dataset.visualTo);
  return Number.isSafeInteger(from) &&
    Number.isSafeInteger(to) &&
    from >= 0 &&
    to >= from
    ? { from, to }
    : null;
};
