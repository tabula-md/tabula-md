import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from "react";
import type { LiveSelection } from "../collaboration";
import type { MarkdownEditorHandle, MarkdownSelectionActionPosition } from "../components/MarkdownEditor";
import type { FileViewMode } from "../workspaceStorage";
import { useAnimationFrameTask } from "./useAnimationFrameTask";

type PreviewSelectionState = {
  from: number;
  to: number;
  text: string;
};

type PreviewSelectionEvent =
  | ReactKeyboardEvent<HTMLElement>
  | ReactMouseEvent<HTMLElement>
  | ReactTouchEvent<HTMLElement>;

export type SelectedMarkdownAnchor = {
  start: number;
  end: number;
  sourceQuote: string;
};

const getTextOffsetWithinElement = (element: HTMLElement, container: Node, offset: number) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.setEnd(container, offset);
  const textOffset = range.toString().length;
  range.detach();
  return Math.max(0, Math.min(textOffset, element.textContent?.length ?? 0));
};

export const readPreviewSelection = (
  surface: HTMLElement | null,
  previewBodyStartOffset: number,
): PreviewSelectionState | null => {
  if (!surface) {
    return null;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !selection.anchorNode || !selection.focusNode) {
    return null;
  }

  if (!surface.contains(selection.anchorNode) || !surface.contains(selection.focusNode)) {
    return null;
  }

  const selectedText = selection.toString().replace(/\s+/g, " ").trim();
  if (!selectedText) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const segments = Array.from(surface.querySelectorAll<HTMLElement>(".preview-source-text"))
    .map((element) => {
      if (!range.intersectsNode(element)) {
        return null;
      }

      const sourceStart = Number(element.dataset.sourceStart);
      const sourceEnd = Number(element.dataset.sourceEnd);
      if (!Number.isFinite(sourceStart) || !Number.isFinite(sourceEnd) || sourceEnd <= sourceStart) {
        return null;
      }

      const textLength = element.textContent?.length ?? 0;
      let localStart = 0;
      let localEnd = textLength;

      if (element.contains(range.startContainer)) {
        localStart = getTextOffsetWithinElement(element, range.startContainer, range.startOffset);
      }
      if (element.contains(range.endContainer)) {
        localEnd = getTextOffsetWithinElement(element, range.endContainer, range.endOffset);
      }

      if (localEnd <= localStart) {
        return null;
      }

      return {
        from: previewBodyStartOffset + sourceStart + localStart,
        to: previewBodyStartOffset + sourceStart + localEnd,
      };
    })
    .filter((segment): segment is { from: number; to: number } => Boolean(segment));

  if (segments.length === 0) {
    return null;
  }

  return {
    from: Math.min(...segments.map((segment) => segment.from)),
    to: Math.max(...segments.map((segment) => segment.to)),
    text: selectedText,
  };
};

export const readSelectionActionPosition = (): MarkdownSelectionActionPosition | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }

  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top,
  };
};

export const getCursorPositionLabel = (
  sourceText: string,
  offset: number,
  selection?: Pick<LiveSelection, "columnNumber" | "lineNumber">,
) => {
  const lineNumberFromSelection = selection?.lineNumber;
  const columnNumberFromSelection = selection?.columnNumber;
  if (
    Number.isFinite(lineNumberFromSelection) &&
    Number.isFinite(columnNumberFromSelection) &&
    (lineNumberFromSelection ?? 0) > 0 &&
    (columnNumberFromSelection ?? 0) > 0
  ) {
    return `${lineNumberFromSelection}:${columnNumberFromSelection}`;
  }

  const safeOffset = Math.max(0, Math.min(offset, sourceText.length));
  const textBeforeCursor = sourceText.slice(0, safeOffset);
  const lineNumber = textBeforeCursor.split("\n").length;
  const previousLineBreak = safeOffset === 0 ? -1 : sourceText.lastIndexOf("\n", safeOffset - 1);
  const columnNumber = safeOffset - previousLineBreak;
  return `${lineNumber}:${columnNumber}`;
};

export const getSelectionLineCount = (
  sourceText: string,
  from: number,
  to: number,
  selection?: Pick<LiveSelection, "fromLineNumber" | "selectionEndsWithLineBreak" | "toLineNumber">,
) => {
  const selectionFromOffset = Math.min(from, to);
  const selectionToOffset = Math.max(from, to);
  if (selectionFromOffset === selectionToOffset) {
    return 0;
  }

  const fromLineNumber = selection?.fromLineNumber;
  const toLineNumber = selection?.toLineNumber;
  if (
    Number.isFinite(fromLineNumber) &&
    Number.isFinite(toLineNumber) &&
    (fromLineNumber ?? 0) > 0 &&
    (toLineNumber ?? 0) > 0
  ) {
    const fallbackEndsWithLineBreak =
      selection?.selectionEndsWithLineBreak ??
      (selectionToOffset <= sourceText.length && selectionToOffset > selectionFromOffset
        ? sourceText[selectionToOffset - 1] === "\n"
        : false);
    const adjustedToLineNumber =
      fallbackEndsWithLineBreak
        ? Math.max(fromLineNumber ?? 1, (toLineNumber ?? 1) - 1)
        : (toLineNumber ?? 1);
    return Math.max(1, Math.abs(adjustedToLineNumber - (fromLineNumber ?? 1)) + 1);
  }

  const selectionFrom = Math.max(0, Math.min(selectionFromOffset, sourceText.length));
  const selectionTo = Math.max(0, Math.min(selectionToOffset, sourceText.length));
  const adjustedSelectionTo = selectionTo > selectionFrom && sourceText[selectionTo - 1] === "\n" ? selectionTo - 1 : selectionTo;
  const startLine = sourceText.slice(0, selectionFrom).split("\n").length;
  const endLine = sourceText.slice(0, adjustedSelectionTo).split("\n").length;
  return Math.max(1, endLine - startLine + 1);
};

const shouldIgnorePreviewSelectionEvent = (event?: PreviewSelectionEvent) => {
  const target = event?.target;
  return (
    target instanceof Element &&
    Boolean(target.closest("button, a, .preview-code-block"))
  );
};

const arePreviewSelectionsEqual = (
  currentSelection: PreviewSelectionState | null,
  nextSelection: PreviewSelectionState | null,
) =>
  currentSelection?.from === nextSelection?.from &&
  currentSelection?.to === nextSelection?.to &&
  currentSelection?.text === nextSelection?.text;

const areLiveSelectionsEqual = (
  currentSelection: LiveSelection | undefined,
  nextSelection: LiveSelection | undefined,
) =>
  currentSelection?.from === nextSelection?.from &&
  currentSelection?.to === nextSelection?.to &&
  currentSelection?.lineNumber === nextSelection?.lineNumber &&
  currentSelection?.columnNumber === nextSelection?.columnNumber &&
  currentSelection?.fromLineNumber === nextSelection?.fromLineNumber &&
  currentSelection?.selectionEndsWithLineBreak === nextSelection?.selectionEndsWithLineBreak &&
  currentSelection?.toLineNumber === nextSelection?.toLineNumber;

const areSelectionActionPositionsEqual = (
  currentPosition: MarkdownSelectionActionPosition | null,
  nextPosition: MarkdownSelectionActionPosition | null,
) =>
  currentPosition === nextPosition ||
  (Boolean(currentPosition) &&
    Boolean(nextPosition) &&
    Math.abs((currentPosition?.clientX ?? 0) - (nextPosition?.clientX ?? 0)) < 0.5 &&
    Math.abs((currentPosition?.clientY ?? 0) - (nextPosition?.clientY ?? 0)) < 0.5);

type UseSelectionCommentControllerOptions = {
  activeFileId?: string;
  activeViewMode: FileViewMode;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  previewBodyStartOffset: number;
  previewSurfaceRef: RefObject<HTMLElement | null>;
  text: string;
};

export function useSelectionCommentController({
  activeFileId,
  activeViewMode,
  editorRef,
  previewBodyStartOffset,
  previewSurfaceRef,
  text,
}: UseSelectionCommentControllerOptions) {
  const [activeSelection, setActiveSelection] = useState<LiveSelection | undefined>(undefined);
  const [previewSelection, setPreviewSelection] = useState<PreviewSelectionState | null>(null);
  const [selectionActionPosition, setSelectionActionPosition] = useState<MarkdownSelectionActionPosition | null>(null);
  const activeSelectionRef = useRef<LiveSelection | undefined>(undefined);
  const pendingEditorSelectionRef = useRef<LiveSelection | undefined>(undefined);
  const editorSelectionFrameRef = useRef<number | null>(null);
  const previewSelectionRef = useRef<PreviewSelectionState | null>(null);
  const selectionActionPositionRef = useRef<MarkdownSelectionActionPosition | null>(null);
  const suppressSelectionActionPositionRef = useRef(false);
  const queueAnimationFrameTask = useAnimationFrameTask();

  const selectedCharacterCount =
    activeSelection && activeSelection.from !== activeSelection.to ? Math.abs(activeSelection.to - activeSelection.from) : 0;
  const selectedLineCount =
    activeSelection && activeSelection.from !== activeSelection.to
      ? getSelectionLineCount(text, activeSelection.from, activeSelection.to, activeSelection)
      : 0;
  const cursorPositionLabel = getCursorPositionLabel(text, activeSelection?.to ?? 0, activeSelection);

  useEffect(() => {
    activeSelectionRef.current = activeSelection;
  }, [activeSelection]);

  useEffect(() => {
    previewSelectionRef.current = previewSelection;
  }, [previewSelection]);

  useEffect(() => {
    selectionActionPositionRef.current = selectionActionPosition;
  }, [selectionActionPosition]);

  const commitSelectionActionPosition = useCallback((position: MarkdownSelectionActionPosition | null) => {
    if (areSelectionActionPositionsEqual(selectionActionPositionRef.current, position)) {
      return;
    }
    selectionActionPositionRef.current = position;
    setSelectionActionPosition(position);
  }, []);

  useEffect(() => () => {
    if (editorSelectionFrameRef.current !== null) {
      window.cancelAnimationFrame(editorSelectionFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (activeViewMode !== "preview") {
      previewSelectionRef.current = null;
      setPreviewSelection(null);
    }
  }, [activeFileId, activeViewMode]);

  const handleEditorSelectionChange = (selection?: LiveSelection) => {
    if (previewSelectionRef.current !== null) {
      previewSelectionRef.current = null;
      setPreviewSelection(null);
    }
    pendingEditorSelectionRef.current = selection;
    if (editorSelectionFrameRef.current !== null) {
      return;
    }

    editorSelectionFrameRef.current = window.requestAnimationFrame(() => {
      editorSelectionFrameRef.current = null;
      const nextSelection = pendingEditorSelectionRef.current;
      if (areLiveSelectionsEqual(activeSelectionRef.current, nextSelection)) {
        return;
      }
      activeSelectionRef.current = nextSelection;
      setActiveSelection(nextSelection);
    });
  };

  const handleEditorSelectionActionPositionChange = (position: MarkdownSelectionActionPosition | null) => {
    if (suppressSelectionActionPositionRef.current) {
      commitSelectionActionPosition(null);
      return;
    }

    commitSelectionActionPosition(position);
  };

  const clearPreviewSelection = () => {
    previewSelectionRef.current = null;
    setPreviewSelection(null);
  };

  const syncPreviewSelection = useCallback((event?: PreviewSelectionEvent) => {
    if (activeViewMode !== "preview") {
      return;
    }

    if (shouldIgnorePreviewSelectionEvent(event)) {
      return;
    }

    queueAnimationFrameTask(() => {
      const nextPreviewSelection = readPreviewSelection(previewSurfaceRef.current, previewBodyStartOffset);
      if (!nextPreviewSelection && (previewSelectionRef.current || selectionActionPositionRef.current)) {
        return;
      }

      const nextActiveSelection = nextPreviewSelection
        ? { from: nextPreviewSelection.from, to: nextPreviewSelection.to }
        : undefined;
      const nextSelectionActionPosition = nextPreviewSelection ? readSelectionActionPosition() : null;
      setPreviewSelection((currentSelection) => {
        const committedSelection = arePreviewSelectionsEqual(currentSelection, nextPreviewSelection)
          ? currentSelection
          : nextPreviewSelection;
        previewSelectionRef.current = committedSelection;
        return committedSelection;
      });
      setActiveSelection((currentSelection) => {
        const committedSelection = areLiveSelectionsEqual(currentSelection, nextActiveSelection)
          ? currentSelection
          : nextActiveSelection;
        activeSelectionRef.current = committedSelection;
        return committedSelection;
      });
      setSelectionActionPosition((currentPosition) => {
        const committedPosition = areSelectionActionPositionsEqual(currentPosition, nextSelectionActionPosition)
          ? currentPosition
          : nextSelectionActionPosition;
        selectionActionPositionRef.current = committedPosition;
        return committedPosition;
      });
    });
  }, [activeViewMode, previewBodyStartOffset, previewSurfaceRef, queueAnimationFrameTask]);

  useEffect(() => {
    if (activeViewMode !== "preview") {
      return undefined;
    }

    const handleSelectionChange = () => syncPreviewSelection();
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [activeViewMode, syncPreviewSelection]);

  const getSelectedMarkdownExcerpt = () => {
    const selectedText = activeViewMode === "preview" ? (previewSelection?.text ?? "") : (editorRef.current?.getSelectedText() ?? "");
    if (!selectedText) {
      return "";
    }

    return selectedText
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 180);
  };

  const getSelectedMarkdownRange = () => {
    if (activeViewMode === "preview") {
      if (!previewSelection || previewSelection.from === previewSelection.to) {
        return null;
      }

      return {
        start: Math.min(previewSelection.from, previewSelection.to),
        end: Math.max(previewSelection.from, previewSelection.to),
      };
    }

    if (!activeSelection || activeSelection.from === activeSelection.to) {
      return null;
    }

    return {
      start: Math.min(activeSelection.from, activeSelection.to),
      end: Math.max(activeSelection.from, activeSelection.to),
    };
  };

  const getSelectedMarkdownAnchor = (): SelectedMarkdownAnchor | null => {
    const selectionRange = getSelectedMarkdownRange();
    if (!selectionRange) {
      return null;
    }
    const sourceText = activeViewMode === "preview" ? text : (editorRef.current?.getValue() ?? text);

    return {
      ...selectionRange,
      sourceQuote: sourceText.slice(selectionRange.start, selectionRange.end),
    };
  };

  return {
    activeSelection,
    selectedCharacterCount,
    selectedLineCount,
    cursorPositionLabel,
    selectionActionPosition,
    setActiveSelection,
    setSelectionActionPosition: commitSelectionActionPosition,
    suppressSelectionActionPositionRef,
    handleEditorSelectionChange,
    handleEditorSelectionActionPositionChange,
    clearPreviewSelection,
    syncPreviewSelection,
    getSelectedMarkdownExcerpt,
    getSelectedMarkdownAnchor,
  };
}
