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
import { Decoration, EditorView, drawSelection, dropCursor, keymap, placeholder } from "@codemirror/view";
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

type MarkdownEditorProps = {
  fileId: string;
  value: string;
  lineWrapping: boolean;
  commentAnchors?: MarkdownCommentAnchor[];
  activeCommentId?: string | null;
  onChange: (nextValue: string) => void;
  onHistoryStateChange?: (historyState: { canUndo: boolean; canRedo: boolean }) => void;
  onOpenComment?: (commentId: string) => void;
  onSelectionChange?: (selection: LiveSelection) => void;
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
  { tag: tags.quote, color: "#777777" },
  { tag: tags.list, color: "#777777" },
  { tag: tags.keyword, color: "#777777" },
  { tag: tags.atom, color: "#777777" },
  { tag: tags.bool, color: "#777777" },
  { tag: tags.number, color: "#777777" },
  { tag: tags.string, color: "#555555" },
  { tag: tags.meta, color: "#8a8a8a", textDecoration: "none" },
  { tag: tags.comment, color: "#8a8a8a", textDecoration: "none" },
  { tag: tags.processingInstruction, color: "#8a8a8a", textDecoration: "none" },
  { tag: tags.punctuation, color: "#999999", textDecoration: "none" },
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

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  (
    {
      fileId,
      value,
      lineWrapping,
      commentAnchors = [],
      activeCommentId,
      onChange,
      onHistoryStateChange,
      onOpenComment,
      onSelectionChange,
      onScrollRatioChange,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onHistoryStateChangeRef = useRef(onHistoryStateChange);
    const onOpenCommentRef = useRef(onOpenComment);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const onScrollRatioChangeRef = useRef(onScrollRatioChange);
    const wrappingCompartmentRef = useRef(new Compartment());
    const commentAnchorCompartmentRef = useRef(new Compartment());
    const stateByFileIdRef = useRef(new Map<string, EditorState>());
    const lastHistoryStateRef = useRef({ canUndo: false, canRedo: false });

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      onHistoryStateChangeRef.current = onHistoryStateChange;
    }, [onHistoryStateChange]);

    useEffect(() => {
      onOpenCommentRef.current = onOpenComment;
    }, [onOpenComment]);

    useEffect(() => {
      onSelectionChangeRef.current = onSelectionChange;
    }, [onSelectionChange]);

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

        if (!update.docChanged) {
          return;
        }

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
        markdown(),
        syntaxHighlighting(markdownEditorHighlightStyle, { fallback: true }),
        placeholder("Start writing Markdown..."),
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
        effects: commentAnchorCompartmentRef.current.reconfigure(
          createCommentAnchorExtension(commentAnchors, activeCommentId, (commentId) => onOpenCommentRef.current?.(commentId)),
        ),
      });
    }, [activeCommentId, commentAnchors]);

    return <div ref={containerRef} className="markdown-editor" aria-label="Markdown editor" />;
  },
);
