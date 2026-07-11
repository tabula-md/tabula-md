import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorSelection, EditorState, type Transaction } from "@codemirror/state";
import { EditorView, placeholder as createEditorPlaceholderExtension } from "@codemirror/view";
import {
  canRedoEditor,
  canUndoEditor,
  EMPTY_EDITOR_HISTORY_STATE,
  getEditorHistoryState,
  redoEditor,
  undoEditor,
} from "../editor/editorHistory";
import {
  createEditorLineNumbersExtension,
  createEditorLineWrappingExtension,
  dispatchEditorSelectionRange,
  getEditorSelectionActionPosition,
} from "../editor/editorLayout";
import { createEditorSearchExtension } from "../editor/editorSearch";
import {
  createEditorAnnotationGutterExtension,
  createEditorCollaborationExtensions,
  createEditorCommentAnchorExtension,
  getCollaborationEditorHistoryState,
  createMarkdownEditorCompartments,
  createMarkdownEditorExtensions,
  redoCollaborationHistory,
  undoCollaborationHistory,
} from "../editor/editorState";
import {
  clampEditorPosition,
  dispatchLocalTextPatches,
  dispatchRemoteTextChange,
  getEditorTextChangePatches,
  isRemoteEditorUpdate,
  mapBookmarksThroughTransactions,
} from "../editor/editorTransactions";
import { runMarkdownFormatCommand } from "../editor/editorInputRules";
import { getActiveMarkdownFormats } from "../editor/editorFormattingState";
import type {
  MarkdownBookmark,
  MarkdownCommentAnchor,
  MarkdownEditorHandle,
  MarkdownEditorProps,
} from "../markdownEditorTypes";
import type { EditorViewportAnchor } from "../preview/previewSyncTypes";
import { getScrollRatio, scrollElementToRatio } from "../scroll";

const MAX_CACHED_LOCAL_EDITOR_STATES = 20;

const getEditorViewportLineAnchor = (view: EditorView): EditorViewportAnchor => {
  const viewportTop = Math.max(0, view.scrollDOM.scrollTop);
  const topLineBlock = view.lineBlockAtHeight(viewportTop);
  const topLine = view.state.doc.lineAt(topLineBlock.from);
  const lineOffsetRatio =
    topLineBlock.height <= 0
      ? 0
      : Math.max(0, Math.min(1, (viewportTop - topLineBlock.top) / topLineBlock.height));
  const atDocumentEnd =
    view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight - view.scrollDOM.scrollTop <= 1;

  return {
    atDocumentEnd,
    lineNumber: topLine.number,
    lineOffsetRatio,
  };
};

export type {
  MarkdownBookmark,
  MarkdownCommentAnchor,
  MarkdownEditorHandle,
  MarkdownLineActionRequest,
  MarkdownSelectionActionPosition,
} from "../markdownEditorTypes";

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  (
  {
    ariaLabel = "Editor",
      interfaceCopy,
    fileId,
      value,
      lineWrapping,
      lineNumbers,
      bookmarks = [],
      commentAnchors = [],
      commentsEnabled = true,
      collaborationBinding,
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
    const commentAnchorsRef = useRef<MarkdownCommentAnchor[]>(commentAnchors);
    const onChangeRef = useRef(onChange);
    const onBookmarksChangeRef = useRef(onBookmarksChange);
    const onHistoryStateChangeRef = useRef(onHistoryStateChange);
    const onOpenLineActionsRef = useRef(onOpenLineActions);
    const onOpenCommentRef = useRef(onOpenComment);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const onSelectionActionPositionChangeRef = useRef(onSelectionActionPositionChange);
    const onScrollRatioChangeRef = useRef(onScrollRatioChange);
    const activeCommentIdRef = useRef(activeCommentId);
    const collaborationBindingRef = useRef(collaborationBinding);
    const appliedCollaborationBindingRef = useRef(collaborationBinding);
    const commentsEnabledRef = useRef(commentsEnabled);
    const interfaceCopyRef = useRef(interfaceCopy);
    const compartmentsRef = useRef(createMarkdownEditorCompartments());
    const stateByFileIdRef = useRef(new Map<string, EditorState>());
    const lastHistoryStateRef = useRef(EMPTY_EDITOR_HISTORY_STATE);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      bookmarksRef.current = bookmarks;
    }, [bookmarks]);

    useEffect(() => {
      commentAnchorsRef.current = commentAnchors;
    }, [commentAnchors]);

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

    useEffect(() => {
      activeCommentIdRef.current = activeCommentId;
    }, [activeCommentId]);

    useEffect(() => {
      commentsEnabledRef.current = commentsEnabled;
    }, [commentsEnabled]);

    useEffect(() => {
      interfaceCopyRef.current = interfaceCopy;
    }, [interfaceCopy]);

    useEffect(() => {
      collaborationBindingRef.current = collaborationBinding;
    }, [collaborationBinding]);

    const emitHistoryState = (view: EditorView) => {
      const binding = collaborationBindingRef.current;
      const nextHistoryState = binding
        ? getCollaborationEditorHistoryState(view.state, binding)
        : getEditorHistoryState(view.state);
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

    const mapBookmarksThroughDocumentChange = (view: EditorView, transactions: readonly Transaction[]) => {
      const currentBookmarks = bookmarksRef.current;
      if (currentBookmarks.length === 0) {
        return;
      }

      const { bookmarks: nextBookmarks, changed } = mapBookmarksThroughTransactions(
        currentBookmarks,
        transactions,
        view.state.doc.length,
      );

      if (changed) {
        bookmarksRef.current = nextBookmarks;
        onBookmarksChangeRef.current?.(nextBookmarks);
      }
    };

    const reconfigureCommentDecorations = (view: EditorView, nextCommentAnchors: MarkdownCommentAnchor[]) => {
      view.dispatch({
        effects: [
          compartmentsRef.current.commentAnchor.reconfigure(
            commentsEnabledRef.current
              ? createEditorCommentAnchorExtension(
                  nextCommentAnchors,
                  activeCommentIdRef.current,
                  interfaceCopyRef.current,
                  (commentId) => onOpenCommentRef.current?.(commentId),
                )
              : [],
          ),
        ],
      });
    };

    const mapCommentAnchorsThroughDocumentChange = (view: EditorView, transactions: readonly Transaction[]) => {
      const currentCommentAnchors = commentAnchorsRef.current;
      if (currentCommentAnchors.length === 0) {
        return;
      }

      const docLength = view.state.doc.length;
      let changed = false;
      const nextCommentAnchors = currentCommentAnchors
        .map((anchor) => {
          const start = clampEditorPosition(
            transactions.reduce(
              (mappedPosition, transaction) => transaction.changes.mapPos(mappedPosition, 1),
              anchor.start,
            ),
            docLength,
          );
          const end = clampEditorPosition(
            transactions.reduce(
              (mappedPosition, transaction) => transaction.changes.mapPos(mappedPosition, -1),
              anchor.end,
            ),
            docLength,
          );
          changed = changed || start !== anchor.start || end !== anchor.end;
          return { ...anchor, start, end };
        })
        .filter((anchor) => anchor.end > anchor.start);

      if (!changed) {
        return;
      }

      commentAnchorsRef.current = nextCommentAnchors;
      queueMicrotask(() => {
        if (viewRef.current === view) {
          reconfigureCommentDecorations(view, nextCommentAnchors);
        }
      });
    };

    useImperativeHandle(ref, () => ({
      canRedo: () => {
        const view = viewRef.current;
        const binding = collaborationBindingRef.current;
        return view && binding
          ? getCollaborationEditorHistoryState(view.state, binding).canRedo
          : canRedoEditor(view);
      },
      canUndo: () => {
        const view = viewRef.current;
        const binding = collaborationBindingRef.current;
        return view && binding
          ? getCollaborationEditorHistoryState(view.state, binding).canUndo
          : canUndoEditor(view);
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
      getActiveFormats: () => {
        const view = viewRef.current;
        return view ? getActiveMarkdownFormats(view.state) : [];
      },
      getLineCount: () => viewRef.current?.state.doc.lines ?? value.split("\n").length,
      getScrollRatio: () => {
        const scrollElement = viewRef.current?.scrollDOM;
        return scrollElement ? getScrollRatio(scrollElement) : 0;
      },
      getViewportLineAnchor: () => {
        const view = viewRef.current;
        return view ? getEditorViewportLineAnchor(view) : null;
      },
      isScrolledToBottom: () => {
        const scrollElement = viewRef.current?.scrollDOM;
        if (!scrollElement) {
          return false;
        }

        return scrollElement.scrollHeight - scrollElement.clientHeight - scrollElement.scrollTop <= 1;
      },
      getSelectionRange: () => {
        const selection = viewRef.current?.state.selection.main;
        return selection ? { from: selection.from, to: selection.to } : { from: value.length, to: value.length };
      },
      getSearchDocument: () => viewRef.current?.state.doc ?? null,
      getSelectedText: () => {
        const view = viewRef.current;
        const selection = view?.state.selection.main;
        return view && selection ? view.state.sliceDoc(selection.from, selection.to) : "";
      },
      getViewportLineNumber: () => {
        const view = viewRef.current;
        if (!view) {
          return null;
        }

        return getEditorViewportLineAnchor(view).lineNumber;
      },
      getValue: () => viewRef.current?.state.doc.toString() ?? value,
      applyLocalTextPatches: (patches, selection, options) => {
        const view = viewRef.current;
        if (!view) {
          return false;
        }
        const undoManager = options?.isolateHistory
          ? collaborationBindingRef.current?.undoManager
          : undefined;
        undoManager?.stopCapturing();
        const applied = dispatchLocalTextPatches(view, patches, selection, options);
        undoManager?.stopCapturing();
        return applied;
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
      setSelectionRanges: (ranges) => {
        const view = viewRef.current;
        if (!view || ranges.length === 0) {
          return;
        }

        const docLength = view.state.doc.length;
        const selectionRanges = ranges
          .map((range) => ({
            from: clampEditorPosition(Math.min(range.from, range.to), docLength),
            to: clampEditorPosition(Math.max(range.from, range.to), docLength),
          }))
          .filter((range) => range.to > range.from)
          .map((range) => EditorSelection.range(range.from, range.to));
        if (selectionRanges.length === 0) {
          return;
        }

        view.dispatch({
          selection: EditorSelection.create(selectionRanges),
          scrollIntoView: true,
        });
        view.focus();
      },
      setSelectionRange: (from: number, to = from) => {
        const view = viewRef.current;
        if (!view) {
          return;
        }

        dispatchEditorSelectionRange(view, from, to, { focus: true });
      },
      revealRange: (from: number, to = from) => {
        const view = viewRef.current;
        if (!view) {
          return;
        }

        dispatchEditorSelectionRange(view, from, to);
      },
      undo: () => {
        const view = viewRef.current;
        if (!view) return false;
        const binding = collaborationBindingRef.current;
        return binding
          ? undoCollaborationHistory(view, binding)
          : undoEditor(view);
      },
      redo: () => {
        const view = viewRef.current;
        if (!view) return false;
        const binding = collaborationBindingRef.current;
        return binding
          ? redoCollaborationHistory(view, binding)
          : redoEditor(view);
      },
    }));

    useEffect(() => {
      if (!containerRef.current) {
        return;
      }

      const emitCurrentSelection = (view: EditorView) => {
        const selection = view.state.selection.main;
        const cursorLine = view.state.doc.lineAt(selection.to);
        const fromLine = selection.from === selection.to ? cursorLine : view.state.doc.lineAt(selection.from);
        onSelectionChangeRef.current?.({
          from: selection.from,
          to: selection.to,
          columnNumber: selection.to - cursorLine.from + 1,
          fromLineNumber: fromLine.number,
          lineNumber: cursorLine.number,
          selectionEndsWithLineBreak:
            selection.to > selection.from && view.state.doc.sliceString(selection.to - 1, selection.to) === "\n",
          toLineNumber: cursorLine.number,
        });
      };

      const updateExtension = EditorView.updateListener.of((update) => {
        emitHistoryState(update.view);
        const isExternalUpdate = isRemoteEditorUpdate(update.transactions);

        if (update.focusChanged && !update.view.hasFocus) {
          onSelectionChangeRef.current?.(undefined);
        }

        if ((update.selectionSet || update.docChanged || update.focusChanged) && update.view.hasFocus) {
          emitCurrentSelection(update.view);
        }

        if ((update.selectionSet || update.docChanged || update.focusChanged) && update.view.hasFocus) {
          const selection = update.state.selection.main;
          onSelectionActionPositionChangeRef.current?.(
            selection.empty ? null : getEditorSelectionActionPosition(update.view),
          );
        } else if (update.focusChanged && !update.view.hasFocus) {
          onSelectionActionPositionChangeRef.current?.(null);
        }

        if (!update.docChanged) {
          return;
        }

        mapBookmarksThroughDocumentChange(update.view, update.transactions);
        mapCommentAnchorsThroughDocumentChange(update.view, update.transactions);

        if (!isExternalUpdate) {
          const patches = getEditorTextChangePatches(update.changes);
          onChangeRef.current(null, {
            docLength: update.state.doc.length,
            lineCount: update.state.doc.lines,
            patches,
          });
        }
      });
      const extensions = createMarkdownEditorExtensions({
        compartments: compartmentsRef.current,
        lineWrapping,
        lineNumbers,
        bookmarks,
        commentAnchors,
        commentsEnabled,
        activeCommentId,
        collaborationBinding,
        searchMatches,
        activeSearchMatchIndex,
        copy: interfaceCopy,
        updateExtension,
        onOpenLineActions: (request) => onOpenLineActionsRef.current?.(request),
        onOpenComment: (commentId) => onOpenCommentRef.current?.(commentId),
      });
      const cachedState = collaborationBinding ? undefined : stateByFileIdRef.current.get(fileId);
      const state =
        cachedState ??
        EditorState.create({
          doc: collaborationBinding?.yText.toString() ?? value,
          extensions,
        });
      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;
      appliedCollaborationBindingRef.current = collaborationBinding;
      emitHistoryState(view);
      const handleScroll = () => {
        onScrollRatioChangeRef.current?.(getScrollRatio(view.scrollDOM));
      };
      view.scrollDOM.addEventListener("scroll", handleScroll, { passive: true });

      return () => {
        onSelectionChangeRef.current?.(undefined);
        onSelectionActionPositionChangeRef.current?.(null);
        view.scrollDOM.removeEventListener("scroll", handleScroll);
        if (collaborationBindingRef.current) {
          stateByFileIdRef.current.delete(fileId);
        } else {
          stateByFileIdRef.current.set(fileId, view.state);
          while (stateByFileIdRef.current.size > MAX_CACHED_LOCAL_EDITOR_STATES) {
            const oldestFileId = stateByFileIdRef.current.keys().next().value;
            if (typeof oldestFileId !== "string") break;
            stateByFileIdRef.current.delete(oldestFileId);
          }
        }
        lastHistoryStateRef.current = EMPTY_EDITOR_HISTORY_STATE;
        onHistoryStateChangeRef.current?.(lastHistoryStateRef.current);
        view.destroy();
        viewRef.current = null;
      };
    }, [fileId]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view || appliedCollaborationBindingRef.current === collaborationBinding) return;

      // Detach the previous Y.Text before projecting the next document. Otherwise a
      // tab switch can write the new document's text into the previous Y.Text.
      view.dispatch({
        effects: [
          compartmentsRef.current.collaboration.reconfigure([]),
        ],
      });
      dispatchRemoteTextChange(
        view,
        collaborationBinding?.yText.toString() ?? value,
      );
      view.dispatch({
        effects: [
          compartmentsRef.current.collaboration.reconfigure(
            collaborationBinding
              ? createEditorCollaborationExtensions(collaborationBinding)
              : [],
          ),
        ],
      });
      appliedCollaborationBindingRef.current = collaborationBinding;
      emitHistoryState(view);
    }, [collaborationBinding, fileId]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view || collaborationBinding) {
        return;
      }

      dispatchRemoteTextChange(view, value);
    }, [collaborationBinding, fileId, value]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: compartmentsRef.current.wrapping.reconfigure(
          createEditorLineWrappingExtension(lineWrapping),
        ),
      });
    }, [lineWrapping]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: compartmentsRef.current.lineNumbers.reconfigure(
          createEditorLineNumbersExtension(lineNumbers),
        ),
      });
    }, [lineNumbers]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: compartmentsRef.current.commentAnchor.reconfigure(
          commentsEnabled
            ? createEditorCommentAnchorExtension(
                commentAnchors,
                activeCommentId,
                interfaceCopy,
                (commentId) => onOpenCommentRef.current?.(commentId),
              )
            : [],
        ),
      });
    }, [activeCommentId, commentAnchors, commentsEnabled, interfaceCopy]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: compartmentsRef.current.placeholder.reconfigure(
          createEditorPlaceholderExtension(interfaceCopy.startWriting),
        ),
      });
    }, [interfaceCopy.startWriting]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: compartmentsRef.current.searchHighlight.reconfigure(
          createEditorSearchExtension(searchMatches, activeSearchMatchIndex),
        ),
      });
    }, [activeSearchMatchIndex, searchMatches]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: compartmentsRef.current.annotationGutter.reconfigure(
          createEditorAnnotationGutterExtension(
            bookmarks,
            interfaceCopy,
            (request) => onOpenLineActionsRef.current?.(request),
          ),
        ),
      });
    }, [bookmarks, interfaceCopy]);

    return (
      <div className={`markdown-editor-shell ${collaborationBinding ? "collaboration-bound" : ""}`}>
        <div ref={containerRef} className="markdown-editor" aria-label={ariaLabel} />
      </div>
    );
  },
);
