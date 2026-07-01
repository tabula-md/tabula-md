import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  history,
  redo as redoEditor,
  redoDepth,
  undo as undoEditor,
  undoDepth,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { type ChangeSet, Compartment, EditorState, type Extension, Transaction } from "@codemirror/state";
import {
  EditorView,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers as codeMirrorLineNumbers,
  placeholder,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { createCommentAnchorExtension } from "../editorExtensions/commentAnchors";
import { createLineAnnotationGutterExtension, createLineCommentActionExtension } from "../editorExtensions/lineAnnotations";
import { createMarkdownCommandExtensions, runMarkdownFormatCommand } from "../editorExtensions/markdownCommands";
import { createRemotePresenceExtension } from "../editorExtensions/remotePresence";
import { createSearchHighlightExtension } from "../editorExtensions/searchHighlight";
import { createTextSelectionHighlightExtension } from "../editorExtensions/selectionLayer";
import type { MarkdownBookmark, MarkdownEditorHandle, MarkdownEditorProps } from "../markdownEditorTypes";
import { getScrollRatio, scrollElementToRatio } from "../scroll";
import { getTextPatchesForChange, type TextPatch } from "@tabula-md/tabula";

export type {
  MarkdownBookmark,
  MarkdownCommentAnchor,
  MarkdownEditorHandle,
  MarkdownLineActionRequest,
  MarkdownSelectionActionPosition,
} from "../markdownEditorTypes";

const markdownEditorHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "var(--editor-syntax-heading)", fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading1, color: "var(--editor-syntax-heading)", fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading2, color: "var(--editor-syntax-heading)", fontWeight: "600", textDecoration: "none" },
  { tag: tags.heading3, color: "var(--editor-syntax-heading)", fontWeight: "600", textDecoration: "none" },
  { tag: tags.strong, color: "var(--editor-syntax-heading)", fontWeight: "600" },
  { tag: tags.emphasis, color: "var(--editor-syntax-heading)", fontStyle: "italic" },
  { tag: tags.strikethrough, color: "var(--editor-syntax-muted)", textDecoration: "line-through" },
  { tag: tags.link, color: "var(--editor-syntax-soft)", textDecoration: "underline", textUnderlineOffset: "2px" },
  { tag: tags.url, color: "var(--editor-syntax-soft)" },
  { tag: tags.monospace, color: "var(--editor-syntax-soft)" },
  { tag: tags.quote, color: "var(--editor-syntax-muted)" },
  { tag: tags.list, color: "var(--editor-syntax-soft)" },
  { tag: tags.keyword, color: "var(--editor-syntax-muted)" },
  { tag: tags.atom, color: "var(--editor-syntax-muted)" },
  { tag: tags.bool, color: "var(--editor-syntax-muted)" },
  { tag: tags.number, color: "var(--editor-syntax-muted)" },
  { tag: tags.string, color: "var(--editor-syntax-soft)" },
  { tag: tags.meta, color: "var(--editor-syntax-faint)", textDecoration: "none" },
  { tag: tags.comment, color: "var(--editor-syntax-faint)", textDecoration: "none" },
  { tag: tags.processingInstruction, color: "var(--editor-syntax-faint)", textDecoration: "none" },
  { tag: tags.punctuation, color: "var(--editor-syntax-punctuation)", textDecoration: "none" },
]);

const getEditorHistoryState = (state: EditorState) => ({
  canUndo: undoDepth(state) > 0,
  canRedo: redoDepth(state) > 0,
});

const clampPosition = (position: number, docLength: number) => Math.max(0, Math.min(position, docLength));

const getEditorTextChangePatches = (changes: ChangeSet): TextPatch[] => {
  const patches: TextPatch[] = [];

  changes.iterChanges((from, to, _insertFrom, _insertTo, insert) => {
    const insertText = insert.toString();
    if (from !== to || insertText) {
      patches.push({ from, to, insert: insertText });
    }
  });

  return patches;
};

const dispatchRemoteTextChange = (
  view: EditorView,
  nextValue: string,
  preferredPatches?: readonly TextPatch[],
) => {
  const currentValue = view.state.doc.toString();
  if (currentValue === nextValue) {
    return;
  }

  const patches = getTextPatchesForChange(currentValue, nextValue, preferredPatches);
  if (patches.length === 0) {
    return;
  }

  view.dispatch({
    changes: patches.map((patch) => ({
      from: patch.from,
      to: patch.to,
      insert: patch.insert,
    })),
    annotations: [Transaction.remote.of(true), Transaction.addToHistory.of(false)],
  });
};

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  (
    {
      fileId,
      fileTitle,
      roomId,
      value,
      lineWrapping,
      lineNumbers,
      bookmarks = [],
      commentAnchors = [],
      commentsEnabled = true,
      collaborators = [],
      activeCommentId,
      searchMatches = [],
      activeSearchMatchIndex = -1,
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
    const remotePresenceCompartmentRef = useRef(new Compartment());
    const searchHighlightCompartmentRef = useRef(new Compartment());
    const stateByFileIdRef = useRef(new Map<string, EditorState>());
    const lastHistoryStateRef = useRef({ canUndo: false, canRedo: false });
    const localEchoValuesRef = useRef(new Set<string>());

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
      focus: (options?: FocusOptions) => {
        const view = viewRef.current;
        if (!view) {
          return;
        }

        if (options?.preventScroll) {
          view.contentDOM.focus(options);
          return;
        }

        view.focus();
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
      applyRemoteTextChange: (nextValue, patches) => {
        const view = viewRef.current;
        if (view) {
          dispatchRemoteTextChange(view, nextValue, patches);
        }
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
      revealRange: (from: number, to = from) => {
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
      },
      undo: () => (viewRef.current ? undoEditor(viewRef.current) : false),
      redo: () => (viewRef.current ? redoEditor(viewRef.current) : false),
    }));

    useEffect(() => {
      if (!containerRef.current) {
        return;
      }
      localEchoValuesRef.current.clear();

      const updateExtension = EditorView.updateListener.of((update) => {
        emitHistoryState(update.view);
        const isExternalUpdate = update.transactions.some((transaction) => transaction.annotation(Transaction.remote));

        if (update.selectionSet || update.docChanged) {
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

        if (!isExternalUpdate) {
          const nextValue = update.state.doc.toString();
          localEchoValuesRef.current.add(nextValue);
          if (localEchoValuesRef.current.size > 40) {
            const oldestValue = localEchoValuesRef.current.values().next().value as string | undefined;
            if (oldestValue !== undefined) {
              localEchoValuesRef.current.delete(oldestValue);
            }
          }

          onChangeRef.current(nextValue, {
            patches: getEditorTextChangePatches(update.changes),
          });
        }
      });
      const extensions: Extension[] = [
        history(),
        dropCursor(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        markdown(),
        syntaxHighlighting(markdownEditorHighlightStyle, { fallback: true }),
        placeholder("Start writing..."),
        annotationGutterCompartmentRef.current.of(
          createLineAnnotationGutterExtension(bookmarks, (request) => onOpenLineActionsRef.current?.(request)),
        ),
        lineCommentActionCompartmentRef.current.of(
          createLineCommentActionExtension(
            bookmarks,
            commentsEnabled ? commentAnchors : [],
            commentsEnabled ? (request) => onOpenLineActionsRef.current?.(request) : undefined,
            commentsEnabled,
          ),
        ),
        lineNumbersCompartmentRef.current.of(lineNumbers ? [codeMirrorLineNumbers()] : []),
        wrappingCompartmentRef.current.of(lineWrapping ? EditorView.lineWrapping : []),
        commentAnchorCompartmentRef.current.of(
          commentsEnabled
            ? createCommentAnchorExtension(commentAnchors, activeCommentId, (commentId) => onOpenCommentRef.current?.(commentId))
            : [],
        ),
        remotePresenceCompartmentRef.current.of(createRemotePresenceExtension(collaborators, fileTitle, roomId)),
        createTextSelectionHighlightExtension(),
        searchHighlightCompartmentRef.current.of(createSearchHighlightExtension(searchMatches, activeSearchMatchIndex)),
        ...createMarkdownCommandExtensions(),
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
        lastHistoryStateRef.current = { canUndo: false, canRedo: false };
        onHistoryStateChangeRef.current?.(lastHistoryStateRef.current);
        view.destroy();
        viewRef.current = null;
      };
    }, [fileId]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) {
        return;
      }

      if (localEchoValuesRef.current.delete(value)) {
        return;
      }

      dispatchRemoteTextChange(view, value);
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
          commentsEnabled
            ? createCommentAnchorExtension(commentAnchors, activeCommentId, (commentId) => onOpenCommentRef.current?.(commentId))
            : [],
        ),
      });
    }, [activeCommentId, commentAnchors, commentsEnabled]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: remotePresenceCompartmentRef.current.reconfigure(
          createRemotePresenceExtension(collaborators, fileTitle, roomId),
        ),
      });
    }, [collaborators, fileTitle, roomId]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: searchHighlightCompartmentRef.current.reconfigure(
          createSearchHighlightExtension(searchMatches, activeSearchMatchIndex),
        ),
      });
    }, [activeSearchMatchIndex, searchMatches]);

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
          createLineCommentActionExtension(
            bookmarks,
            commentsEnabled ? commentAnchors : [],
            commentsEnabled ? (request) => onOpenLineActionsRef.current?.(request) : undefined,
            commentsEnabled,
          ),
        ),
      });
    }, [bookmarks, commentAnchors, commentsEnabled]);

    return <div ref={containerRef} className="markdown-editor" aria-label="Editor" />;
  },
);
