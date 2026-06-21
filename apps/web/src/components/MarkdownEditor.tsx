import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo as redoEditor,
  redoDepth,
  undo as undoEditor,
  undoDepth,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState, type Extension, Transaction } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  drawSelection,
  dropCursor,
  gutter,
  GutterMarker,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers as codeMirrorLineNumbers,
  placeholder,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { LiveSelection } from "../collab";
import { getMarkdownEnterEdit, getMarkdownIndentEdit, getMarkdownPasteEdit } from "../markdownEditing";
import { applyMarkdownFormat, type MarkdownFormatCommand } from "../markdownFormatting";
import { getScrollRatio, scrollElementToRatio } from "../scroll";

export type MarkdownEditorHandle = {
  canRedo: () => boolean;
  canUndo: () => boolean;
  format: (command: MarkdownFormatCommand) => boolean;
  focus: () => void;
  getScrollRatio: () => number;
  getSelectionRange: () => { from: number; to: number };
  getSelectedText: () => string;
  scrollToRatio: (ratio: number) => void;
  setSelectionRange: (from: number, to?: number) => void;
  undo: () => boolean;
  redo: () => boolean;
};

export type MarkdownCommentAnchor = {
  id: string;
  start: number;
  end: number;
};

export type MarkdownBookmark = {
  id: string;
  position: number;
  createdAt?: string;
};

export type MarkdownLineActionRequest = {
  action: "bookmark" | "comment";
  lineNumber: number;
  start: number;
  end: number;
  hasBookmark: boolean;
  hasComment: boolean;
};

export type MarkdownSelectionActionPosition = {
  clientX: number;
  clientY: number;
};

type MarkdownEditorProps = {
  fileId: string;
  value: string;
  lineWrapping: boolean;
  lineNumbers: boolean;
  bookmarks?: MarkdownBookmark[];
  commentAnchors?: MarkdownCommentAnchor[];
  activeCommentId?: string | null;
  onChange: (nextValue: string) => void;
  onBookmarksChange?: (bookmarks: MarkdownBookmark[]) => void;
  onHistoryStateChange?: (historyState: { canUndo: boolean; canRedo: boolean }) => void;
  onOpenLineActions?: (request: MarkdownLineActionRequest) => void;
  onOpenComment?: (commentId: string) => void;
  onSelectionChange?: (selection: LiveSelection) => void;
  onSelectionActionPositionChange?: (position: MarkdownSelectionActionPosition | null) => void;
  onScrollRatioChange?: (ratio: number) => void;
};

const markdownEditorHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "#1f1f1f", fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading1, color: "#1f1f1f", fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading2, color: "#1f1f1f", fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading3, color: "#1f1f1f", fontWeight: "600", textDecoration: "none" },
  { tag: tags.strong, color: "#1f1f1f", fontWeight: "600" },
  { tag: tags.emphasis, color: "#1f1f1f", fontStyle: "italic" },
  { tag: tags.strikethrough, color: "#777777", textDecoration: "line-through" },
  { tag: tags.link, color: "#555555", textDecoration: "underline", textUnderlineOffset: "2px" },
  { tag: tags.url, color: "#555555" },
  { tag: tags.monospace, color: "#555555" },
  { tag: tags.quote, color: "#7f7f82" },
  { tag: tags.list, color: "#555555" },
  { tag: tags.keyword, color: "#777777" },
  { tag: tags.atom, color: "#777777" },
  { tag: tags.bool, color: "#777777" },
  { tag: tags.number, color: "#777777" },
  { tag: tags.string, color: "#555555" },
  { tag: tags.meta, color: "#9a9a9d", textDecoration: "none" },
  { tag: tags.comment, color: "#9a9a9d", textDecoration: "none" },
  { tag: tags.processingInstruction, color: "#9a9a9d", textDecoration: "none" },
  { tag: tags.punctuation, color: "#adadb0", textDecoration: "none" },
]);

const getEditorHistoryState = (state: EditorState) => ({
  canUndo: undoDepth(state) > 0,
  canRedo: redoDepth(state) > 0,
});

const getMinimalTextChange = (currentText: string, nextText: string) => {
  let from = 0;
  while (from < currentText.length && from < nextText.length && currentText[from] === nextText[from]) {
    from += 1;
  }

  let currentTo = currentText.length;
  let nextTo = nextText.length;
  while (currentTo > from && nextTo > from && currentText[currentTo - 1] === nextText[nextTo - 1]) {
    currentTo -= 1;
    nextTo -= 1;
  }

  return {
    from,
    to: currentTo,
    insert: nextText.slice(from, nextTo),
  };
};

const runMarkdownFormatCommand = (view: EditorView, command: MarkdownFormatCommand) => {
  const currentText = view.state.doc.toString();
  const selection = view.state.selection.main;
  const result = applyMarkdownFormat(currentText, { from: selection.from, to: selection.to }, command);
  const selectionRange = { anchor: result.selection.from, head: result.selection.to };

  if (result.text === currentText) {
    view.dispatch({
      selection: selectionRange,
      scrollIntoView: true,
    });
    view.focus();
    return true;
  }

  const change = getMinimalTextChange(currentText, result.text);
  view.dispatch({
    changes: change,
    selection: selectionRange,
    scrollIntoView: true,
  });
  view.focus();
  return true;
};

const createMarkdownFormatKeyCommand = (command: MarkdownFormatCommand) => (view: EditorView) =>
  runMarkdownFormatCommand(view, command);

const runMarkdownEnterCommand = (view: EditorView) => {
  const selection = view.state.selection.main;
  if (!selection.empty) {
    return false;
  }

  const edit = getMarkdownEnterEdit(view.state.doc.toString(), selection.head);
  if (!edit) {
    return false;
  }

  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: { anchor: edit.selection, head: edit.selection },
    scrollIntoView: true,
  });
  return true;
};

const createMarkdownIndentCommand = (direction: "indent" | "outdent") => (view: EditorView) => {
  const selection = view.state.selection.main;
  const edit = getMarkdownIndentEdit(
    view.state.doc.toString(),
    { from: selection.from, to: selection.to },
    direction,
  );
  if (!edit) {
    return false;
  }

  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: { anchor: edit.selection.from, head: edit.selection.to },
    scrollIntoView: true,
  });
  return true;
};

const runMarkdownPasteCommand = (view: EditorView, event: ClipboardEvent) => {
  const clipboardText = event.clipboardData?.getData("text/plain") ?? "";
  if (!clipboardText) {
    return false;
  }

  const selection = view.state.selection.main;
  const edit = getMarkdownPasteEdit(
    view.state.doc.toString(),
    { from: selection.from, to: selection.to },
    clipboardText,
  );
  if (!edit) {
    return false;
  }

  event.preventDefault();
  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: { anchor: edit.selection.from, head: edit.selection.to },
    scrollIntoView: true,
  });
  return true;
};

const createCommentAnchorExtension = (
  commentAnchors: MarkdownCommentAnchor[] = [],
  activeCommentId?: string | null,
  onOpenComment?: (commentId: string) => void,
): Extension => [
  EditorView.decorations.of((view) => {
    const docLength = view.state.doc.length;
    const ranges = commentAnchors
      .map((anchor) => ({
        ...anchor,
        start: Math.max(0, Math.min(anchor.start, docLength)),
        end: Math.max(0, Math.min(anchor.end, docLength)),
      }))
      .filter((anchor) => anchor.end > anchor.start)
      .sort((a, b) => a.start - b.start || a.end - b.end)
      .map((anchor) =>
        Decoration.mark({
          class: anchor.id === activeCommentId ? "cm-comment-mark active" : "cm-comment-mark",
          attributes: {
            "data-comment-id": anchor.id,
            title: anchor.id === activeCommentId ? "Active comment" : "Open comment",
          },
        }).range(anchor.start, anchor.end),
      );

    return Decoration.set(ranges, true);
  }),
  EditorView.domEventHandlers({
    click(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      const commentMark = target.closest<HTMLElement>(".cm-comment-mark");
      const commentId = commentMark?.dataset.commentId;
      if (!commentId || !onOpenComment) {
        return false;
      }

      event.preventDefault();
      onOpenComment(commentId);
      return true;
    },
  }),
];

type LineAnnotationState = {
  hasBookmark: boolean;
};

type LineCommentActionState = {
  lineNumber: number;
  start: number;
  end: number;
  hasComment: boolean;
};

type EditorLineActionIcon = "bookmark" | "message-square";

const LUCIDE_ICON_PATHS: Record<EditorLineActionIcon, string[]> = {
  bookmark: ["m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"],
  "message-square": ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
};

const createLucideSvgIcon = (icon: EditorLineActionIcon) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "cm-annotation-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  LUCIDE_ICON_PATHS[icon].forEach((pathData) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    svg.append(path);
  });

  return svg;
};

class LineAnnotationGutterMarker extends GutterMarker {
  constructor(private readonly annotationState: LineAnnotationState) {
    super();
  }

  eq(other: GutterMarker) {
    return (
      other instanceof LineAnnotationGutterMarker &&
      other.annotationState.hasBookmark === this.annotationState.hasBookmark
    );
  }

  toDOM() {
    const marker = document.createElement("span");
    marker.className = [
      "cm-annotation-marker",
      this.annotationState.hasBookmark ? "has-bookmark" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const bookmarkAction = document.createElement("span");
    bookmarkAction.className = "cm-annotation-action bookmark";
    bookmarkAction.dataset.lineAction = "bookmark";
    bookmarkAction.role = "button";
    bookmarkAction.ariaLabel = this.annotationState.hasBookmark ? "Remove line bookmark" : "Bookmark line";
    bookmarkAction.title = this.annotationState.hasBookmark ? "Remove bookmark" : "Bookmark line";
    bookmarkAction.append(createLucideSvgIcon("bookmark"));

    marker.append(bookmarkAction);
    return marker;
  }
}

const lineAnnotationMarkers = {
  empty: new LineAnnotationGutterMarker({ hasBookmark: false }),
  bookmark: new LineAnnotationGutterMarker({ hasBookmark: true }),
};

const clampPosition = (position: number, docLength: number) => Math.max(0, Math.min(position, docLength));

const getBookmarkLineNumbers = (view: EditorView, bookmarks: MarkdownBookmark[]) => {
  const docLength = view.state.doc.length;
  return new Set(
    bookmarks.map((bookmark) => view.state.doc.lineAt(clampPosition(bookmark.position, docLength)).number),
  );
};

const getCommentLineNumbers = (view: EditorView, commentAnchors: MarkdownCommentAnchor[]) => {
  const docLength = view.state.doc.length;
  const lineNumbers = new Set<number>();

  commentAnchors.forEach((anchor) => {
    const start = clampPosition(anchor.start, docLength);
    const end = clampPosition(anchor.end, docLength);
    if (end <= start) {
      return;
    }

    const startLine = view.state.doc.lineAt(start).number;
    const endLine = view.state.doc.lineAt(Math.max(start, end - 1)).number;
    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      lineNumbers.add(lineNumber);
    }
  });

  return lineNumbers;
};

const getLineAnnotationKind = (lineNumber: number, bookmarkLineNumbers: Set<number>): keyof typeof lineAnnotationMarkers =>
  bookmarkLineNumbers.has(lineNumber) ? "bookmark" : "empty";

const createLineAnnotationGutterExtension = (
  bookmarks: MarkdownBookmark[] = [],
  onOpenLineActions?: (request: MarkdownLineActionRequest) => void,
): Extension =>
  gutter({
    class: "cm-annotationGutter",
    renderEmptyElements: true,
    lineMarker(view, line) {
      const lineNumber = view.state.doc.lineAt(line.from).number;
      const bookmarkLineNumbers = getBookmarkLineNumbers(view, bookmarks);
      return lineAnnotationMarkers[getLineAnnotationKind(lineNumber, bookmarkLineNumbers)];
    },
    lineMarkerChange(update) {
      return update.docChanged || update.viewportChanged || update.selectionSet;
    },
    initialSpacer: () => lineAnnotationMarkers.empty,
    domEventHandlers: {
      click(view, line, event) {
        if (!onOpenLineActions) {
          return false;
        }

        const target = event.target;
        if (!(target instanceof Element)) {
          return false;
        }

        const actionElement = target.closest<HTMLElement>("[data-line-action]");
        const action = actionElement?.dataset.lineAction;
        if (action !== "bookmark") {
          return false;
        }

        const docLine = view.state.doc.lineAt(line.from);
        const bookmarkLineNumbers = getBookmarkLineNumbers(view, bookmarks);
        event.preventDefault();
        onOpenLineActions({
          action,
          lineNumber: docLine.number,
          start: docLine.from,
          end: docLine.to,
          hasBookmark: bookmarkLineNumbers.has(docLine.number),
          hasComment: false,
        });
        return true;
      },
    },
  });

class LineCommentGutterMarker extends GutterMarker {
  constructor(private readonly actionState: LineCommentActionState) {
    super();
  }

  eq(other: GutterMarker) {
    return (
      other instanceof LineCommentGutterMarker &&
      other.actionState.lineNumber === this.actionState.lineNumber &&
      other.actionState.start === this.actionState.start &&
      other.actionState.end === this.actionState.end &&
      other.actionState.hasComment === this.actionState.hasComment
    );
  }

  toDOM() {
    const marker = document.createElement("span");
    marker.className = [
      "cm-line-comment-marker",
      this.actionState.hasComment ? "has-comment" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const action = document.createElement("span");
    action.className = "cm-annotation-action cm-line-comment-action comment";
    action.dataset.lineAction = "comment";
    action.dataset.lineNumber = String(this.actionState.lineNumber);
    action.dataset.lineStart = String(this.actionState.start);
    action.dataset.lineEnd = String(this.actionState.end);
    action.role = "button";
    action.ariaLabel = this.actionState.hasComment ? "Open line comments" : "Comment on line";
    action.title = this.actionState.hasComment ? "Open comments" : "Comment on line";
    action.append(createLucideSvgIcon("message-square"));

    marker.append(action);
    return marker;
  }
}

const emptyLineCommentMarker = new LineCommentGutterMarker({
  lineNumber: 0,
  start: 0,
  end: 0,
  hasComment: false,
});

const createLineCommentActionExtension = (
  bookmarks: MarkdownBookmark[] = [],
  commentAnchors: MarkdownCommentAnchor[] = [],
  onOpenLineActions?: (request: MarkdownLineActionRequest) => void,
): Extension =>
  gutter({
    class: "cm-commentGutter",
    renderEmptyElements: true,
    side: "after",
    lineMarker(view, line) {
      const docLine = view.state.doc.lineAt(line.from);
      const commentLineNumbers = getCommentLineNumbers(view, commentAnchors);
      return new LineCommentGutterMarker({
        lineNumber: docLine.number,
        start: docLine.from,
        end: docLine.to,
        hasComment: commentLineNumbers.has(docLine.number),
      });
    },
    lineMarkerChange(update) {
      return update.docChanged || update.viewportChanged || update.selectionSet;
    },
    initialSpacer: () => emptyLineCommentMarker,
    domEventHandlers: {
      click(view, line, event) {
        if (!onOpenLineActions) {
          return false;
        }

        const target = event.target;
        if (!(target instanceof Element)) {
          return false;
        }

        const actionElement = target.closest<HTMLElement>(".cm-line-comment-action[data-line-action='comment']");
        if (!actionElement) {
          return false;
        }

        const docLine = view.state.doc.lineAt(line.from);
        const bookmarkLineNumbers = getBookmarkLineNumbers(view, bookmarks);
        const commentLineNumbers = getCommentLineNumbers(view, commentAnchors);
        event.preventDefault();
        onOpenLineActions({
          action: "comment",
          lineNumber: docLine.number,
          start: docLine.from,
          end: docLine.to,
          hasBookmark: bookmarkLineNumbers.has(docLine.number),
          hasComment: commentLineNumbers.has(docLine.number),
        });
        return true;
      },
    },
  });

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  (
    {
      fileId,
      value,
      lineWrapping,
      lineNumbers,
      bookmarks = [],
      commentAnchors = [],
      activeCommentId,
      onChange,
      onBookmarksChange,
      onHistoryStateChange,
      onOpenLineActions,
      onOpenComment,
      onSelectionChange,
      onSelectionActionPositionChange,
      onScrollRatioChange,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const bookmarksRef = useRef<MarkdownBookmark[]>(bookmarks);
    const onChangeRef = useRef(onChange);
    const onBookmarksChangeRef = useRef(onBookmarksChange);
    const onHistoryStateChangeRef = useRef(onHistoryStateChange);
    const onOpenLineActionsRef = useRef(onOpenLineActions);
    const onOpenCommentRef = useRef(onOpenComment);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const onSelectionActionPositionChangeRef = useRef(onSelectionActionPositionChange);
    const onScrollRatioChangeRef = useRef(onScrollRatioChange);
    const wrappingCompartmentRef = useRef(new Compartment());
    const annotationGutterCompartmentRef = useRef(new Compartment());
    const lineCommentActionCompartmentRef = useRef(new Compartment());
    const lineNumbersCompartmentRef = useRef(new Compartment());
    const commentAnchorCompartmentRef = useRef(new Compartment());
    const stateByFileIdRef = useRef(new Map<string, EditorState>());
    const lastHistoryStateRef = useRef({ canUndo: false, canRedo: false });

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      bookmarksRef.current = bookmarks;
    }, [bookmarks]);

    useEffect(() => {
      onBookmarksChangeRef.current = onBookmarksChange;
    }, [onBookmarksChange]);

    useEffect(() => {
      onHistoryStateChangeRef.current = onHistoryStateChange;
    }, [onHistoryStateChange]);

    useEffect(() => {
      onOpenLineActionsRef.current = onOpenLineActions;
    }, [onOpenLineActions]);

    useEffect(() => {
      onOpenCommentRef.current = onOpenComment;
    }, [onOpenComment]);

    useEffect(() => {
      onSelectionChangeRef.current = onSelectionChange;
    }, [onSelectionChange]);

    useEffect(() => {
      onSelectionActionPositionChangeRef.current = onSelectionActionPositionChange;
    }, [onSelectionActionPositionChange]);

    useEffect(() => {
      onScrollRatioChangeRef.current = onScrollRatioChange;
    }, [onScrollRatioChange]);

    const emitHistoryState = (view: EditorView) => {
      const nextHistoryState = getEditorHistoryState(view.state);
      const previousHistoryState = lastHistoryStateRef.current;
      if (
        previousHistoryState.canUndo === nextHistoryState.canUndo &&
        previousHistoryState.canRedo === nextHistoryState.canRedo
      ) {
        return;
      }

      lastHistoryStateRef.current = nextHistoryState;
      onHistoryStateChangeRef.current?.(nextHistoryState);
    };

    const emitSelectionActionPosition = (view: EditorView) => {
      const selection = view.state.selection.main;
      if (selection.empty) {
        onSelectionActionPositionChangeRef.current?.(null);
        return;
      }

      const coordinates = view.coordsAtPos(selection.to);
      if (!coordinates) {
        onSelectionActionPositionChangeRef.current?.(null);
        return;
      }

      onSelectionActionPositionChangeRef.current?.({
        clientX: (coordinates.left + coordinates.right) / 2,
        clientY: coordinates.top,
      });
    };

    const mapBookmarksThroughDocumentChange = (view: EditorView, transactions: readonly Transaction[]) => {
      const currentBookmarks = bookmarksRef.current;
      if (currentBookmarks.length === 0) {
        return;
      }

      const docLength = view.state.doc.length;
      const seenPositions = new Set<number>();
      let changed = false;
      const nextBookmarks = currentBookmarks
        .map((bookmark) => {
          const position = clampPosition(
            transactions.reduce((mappedPosition, transaction) => transaction.changes.mapPos(mappedPosition, 1), bookmark.position),
            docLength,
          );
          changed = changed || position !== bookmark.position;
          return { ...bookmark, position };
        })
        .filter((bookmark) => {
          if (seenPositions.has(bookmark.position)) {
            changed = true;
            return false;
          }

          seenPositions.add(bookmark.position);
          return true;
        });

      if (changed) {
        bookmarksRef.current = nextBookmarks;
        onBookmarksChangeRef.current?.(nextBookmarks);
      }
    };

    useImperativeHandle(ref, () => ({
      canRedo: () => {
        const view = viewRef.current;
        return view ? redoDepth(view.state) > 0 : false;
      },
      canUndo: () => {
        const view = viewRef.current;
        return view ? undoDepth(view.state) > 0 : false;
      },
      format: (command) => {
        const view = viewRef.current;
        return view ? runMarkdownFormatCommand(view, command) : false;
      },
      focus: () => {
        viewRef.current?.focus();
      },
      getScrollRatio: () => {
        const scrollElement = viewRef.current?.scrollDOM;
        return scrollElement ? getScrollRatio(scrollElement) : 0;
      },
      getSelectionRange: () => {
        const selection = viewRef.current?.state.selection.main;
        return selection ? { from: selection.from, to: selection.to } : { from: value.length, to: value.length };
      },
      getSelectedText: () => {
        const view = viewRef.current;
        const selection = view?.state.selection.main;
        return view && selection ? view.state.sliceDoc(selection.from, selection.to) : "";
      },
      scrollToRatio: (ratio: number) => {
        const scrollElement = viewRef.current?.scrollDOM;
        if (scrollElement) {
          scrollElementToRatio(scrollElement, ratio);
        }
      },
      setSelectionRange: (from: number, to = from) => {
        const view = viewRef.current;
        if (!view) {
          return;
        }

        const docLength = view.state.doc.length;
        const selectionFrom = Math.max(0, Math.min(from, docLength));
        const selectionTo = Math.max(0, Math.min(to, docLength));
        view.dispatch({
          selection: { anchor: selectionFrom, head: selectionTo },
          scrollIntoView: true,
        });
        view.focus();
      },
      undo: () => (viewRef.current ? undoEditor(viewRef.current) : false),
      redo: () => (viewRef.current ? redoEditor(viewRef.current) : false),
    }));

    useEffect(() => {
      if (!containerRef.current) {
        return;
      }

      const updateExtension = EditorView.updateListener.of((update) => {
        emitHistoryState(update.view);

        if (update.selectionSet) {
          const selection = update.state.selection.main;
          onSelectionChangeRef.current?.({ from: selection.from, to: selection.to });
        }

        if (update.selectionSet || update.docChanged) {
          emitSelectionActionPosition(update.view);
        }

        if (!update.docChanged) {
          return;
        }

        mapBookmarksThroughDocumentChange(update.view, update.transactions);

        const isExternalUpdate = update.transactions.some((transaction) => transaction.annotation(Transaction.remote));
        if (!isExternalUpdate) {
          onChangeRef.current(update.state.doc.toString());
        }
      });
      const editorKeymap = keymap.of([
        { key: "Enter", run: runMarkdownEnterCommand },
        { key: "Tab", run: createMarkdownIndentCommand("indent") },
        { key: "Shift-Tab", run: createMarkdownIndentCommand("outdent") },
        indentWithTab,
        { key: "Mod-b", run: createMarkdownFormatKeyCommand("bold") },
        { key: "Mod-i", run: createMarkdownFormatKeyCommand("italic") },
        { key: "Mod-k", run: createMarkdownFormatKeyCommand("link") },
        { key: "Mod-Shift-7", run: createMarkdownFormatKeyCommand("numbered-list") },
        { key: "Mod-Shift-8", run: createMarkdownFormatKeyCommand("bullet-list") },
        { key: "Mod-Shift-9", run: createMarkdownFormatKeyCommand("quote") },
        ...defaultKeymap,
        ...historyKeymap,
      ]);
      const pasteExtension = EditorView.domEventHandlers({
        paste(event, view) {
          return runMarkdownPasteCommand(view, event);
        },
      });
      const extensions: Extension[] = [
        history(),
        drawSelection(),
        dropCursor(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        markdown(),
        syntaxHighlighting(markdownEditorHighlightStyle, { fallback: true }),
        placeholder("Start writing Markdown..."),
        annotationGutterCompartmentRef.current.of(
          createLineAnnotationGutterExtension(bookmarks, (request) => onOpenLineActionsRef.current?.(request)),
        ),
        lineCommentActionCompartmentRef.current.of(
          createLineCommentActionExtension(bookmarks, commentAnchors, (request) =>
            onOpenLineActionsRef.current?.(request),
          ),
        ),
        lineNumbersCompartmentRef.current.of(lineNumbers ? [codeMirrorLineNumbers()] : []),
        wrappingCompartmentRef.current.of(lineWrapping ? EditorView.lineWrapping : []),
        commentAnchorCompartmentRef.current.of(
          createCommentAnchorExtension(commentAnchors, activeCommentId, (commentId) => onOpenCommentRef.current?.(commentId)),
        ),
        pasteExtension,
        editorKeymap,
        updateExtension,
      ];
      const cachedState = stateByFileIdRef.current.get(fileId);
      const state =
        cachedState ??
        EditorState.create({
          doc: value,
          extensions,
        });
      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;
      emitHistoryState(view);
      const handleScroll = () => {
        onScrollRatioChangeRef.current?.(getScrollRatio(view.scrollDOM));
      };
      view.scrollDOM.addEventListener("scroll", handleScroll, { passive: true });

      return () => {
        view.scrollDOM.removeEventListener("scroll", handleScroll);
        stateByFileIdRef.current.set(fileId, view.state);
        view.destroy();
        viewRef.current = null;
      };
    }, [fileId]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      const currentValue = view.state.doc.toString();
      if (currentValue === value) {
        return;
      }

      const selection = view.state.selection.main;
      const nextLength = value.length;
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value },
        selection: {
          anchor: Math.min(selection.from, nextLength),
          head: Math.min(selection.to, nextLength),
        },
        annotations: Transaction.remote.of(true),
      });
    }, [fileId, value]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: wrappingCompartmentRef.current.reconfigure(lineWrapping ? EditorView.lineWrapping : []),
      });
    }, [lineWrapping]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: lineNumbersCompartmentRef.current.reconfigure(
          lineNumbers ? [codeMirrorLineNumbers()] : [],
        ),
      });
    }, [lineNumbers]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: commentAnchorCompartmentRef.current.reconfigure(
          createCommentAnchorExtension(commentAnchors, activeCommentId, (commentId) => onOpenCommentRef.current?.(commentId)),
        ),
      });
    }, [activeCommentId, commentAnchors]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: annotationGutterCompartmentRef.current.reconfigure(
          createLineAnnotationGutterExtension(bookmarks, (request) => onOpenLineActionsRef.current?.(request)),
        ),
      });
    }, [bookmarks]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: lineCommentActionCompartmentRef.current.reconfigure(
          createLineCommentActionExtension(bookmarks, commentAnchors, (request) =>
            onOpenLineActionsRef.current?.(request),
          ),
        ),
      });
    }, [bookmarks, commentAnchors]);

    return <div ref={containerRef} className="markdown-editor" aria-label="Markdown editor" />;
  },
);
