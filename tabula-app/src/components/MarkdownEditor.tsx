import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from "react";
import { EditorState, type Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  isSafeMarkdownLinkUrl,
  updateMarkdownLinkUrl,
  type MarkdownLink,
} from "@tabula-md/tabula";
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
import { updateEditorPresenceEffect } from "../editor/editorPresence";
import { createEditorSearchExtension } from "../editor/editorSearch";
import {
  createEditorAnnotationGutterExtension,
  createEditorCommentAnchorExtension,
  createEditorLineCommentActionExtension,
  createMarkdownEditorCompartments,
  createMarkdownEditorExtensions,
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
import type {
  MarkdownBookmark,
  MarkdownCommentAnchor,
  MarkdownEditorHandle,
  MarkdownEditorProps,
} from "../markdownEditorTypes";
import { getScrollRatio, scrollElementToRatio } from "../scroll";

type EditorLinkPopoverState = {
  link: MarkdownLink;
  draftUrl: string;
  clientX: number;
  clientY: number;
};

const getLinkPopoverStyle = ({ clientX, clientY }: EditorLinkPopoverState): CSSProperties => {
  const width = 320;
  const height = 128;
  const viewportWidth = window.innerWidth || 1024;
  const viewportHeight = window.innerHeight || 768;

  return {
    left: Math.max(12, Math.min(clientX, viewportWidth - width - 12)),
    top: Math.max(72, Math.min(clientY + 12, viewportHeight - height - 12)),
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
    const commentsEnabledRef = useRef(commentsEnabled);
    const compartmentsRef = useRef(createMarkdownEditorCompartments());
    const stateByFileIdRef = useRef(new Map<string, EditorState>());
    const lastHistoryStateRef = useRef(EMPTY_EDITOR_HISTORY_STATE);
    const [linkPopover, setLinkPopover] = useState<EditorLinkPopoverState | null>(null);

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
                  (commentId) => onOpenCommentRef.current?.(commentId),
                )
              : [],
          ),
          compartmentsRef.current.lineCommentAction.reconfigure(
            createEditorLineCommentActionExtension(
              bookmarksRef.current,
              nextCommentAnchors,
              commentsEnabledRef.current,
              (request) => onOpenLineActionsRef.current?.(request),
            ),
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
        return canRedoEditor(viewRef.current);
      },
      canUndo: () => {
        return canUndoEditor(viewRef.current);
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
      getValue: () => viewRef.current?.state.doc.toString() ?? value,
      applyLocalTextPatches: (patches, selection, options) => {
        const view = viewRef.current;
        return view ? dispatchLocalTextPatches(view, patches, selection, options) : false;
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

        dispatchEditorSelectionRange(view, from, to, { focus: true });
      },
      revealRange: (from: number, to = from) => {
        const view = viewRef.current;
        if (!view) {
          return;
        }

        dispatchEditorSelectionRange(view, from, to);
      },
      undo: () => undoEditor(viewRef.current),
      redo: () => redoEditor(viewRef.current),
    }));

    useEffect(() => {
      if (!containerRef.current) {
        return;
      }

      const updateExtension = EditorView.updateListener.of((update) => {
        emitHistoryState(update.view);
        const isExternalUpdate = isRemoteEditorUpdate(update.transactions);

        if (update.selectionSet || update.docChanged) {
          const selection = update.state.selection.main;
          const cursorLine = update.state.doc.lineAt(selection.to);
          const fromLine = selection.from === selection.to ? cursorLine : update.state.doc.lineAt(selection.from);
          onSelectionChangeRef.current?.({
            from: selection.from,
            to: selection.to,
            columnNumber: selection.to - cursorLine.from + 1,
            fromLineNumber: fromLine.number,
            lineNumber: cursorLine.number,
            selectionEndsWithLineBreak:
              selection.to > selection.from && update.state.doc.sliceString(selection.to - 1, selection.to) === "\n",
            toLineNumber: cursorLine.number,
          });
        }

        if (update.selectionSet || update.docChanged) {
          const selection = update.state.selection.main;
          onSelectionActionPositionChangeRef.current?.(
            selection.empty ? null : getEditorSelectionActionPosition(update.view),
          );
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
        collaborators,
        fileTitle,
        roomId,
        searchMatches,
        activeSearchMatchIndex,
        updateExtension,
        onOpenLineActions: (request) => onOpenLineActionsRef.current?.(request),
        onOpenComment: (commentId) => onOpenCommentRef.current?.(commentId),
        onOpenLinkPopover: (request) =>
          setLinkPopover({
            ...request,
            draftUrl: request.link.url,
          }),
      });
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
        lastHistoryStateRef.current = EMPTY_EDITOR_HISTORY_STATE;
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

      dispatchRemoteTextChange(view, value);
    }, [fileId, value]);

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
            ? createEditorCommentAnchorExtension(commentAnchors, activeCommentId, (commentId) => onOpenCommentRef.current?.(commentId))
            : [],
        ),
      });
    }, [activeCommentId, commentAnchors, commentsEnabled]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: updateEditorPresenceEffect.of({
          collaborators,
          currentFileTitle: fileTitle,
          currentRoomId: roomId,
        }),
      });
    }, [collaborators, fileTitle, roomId]);

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
          createEditorAnnotationGutterExtension(bookmarks, (request) => onOpenLineActionsRef.current?.(request)),
        ),
      });
    }, [bookmarks]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: compartmentsRef.current.lineCommentAction.reconfigure(
          createEditorLineCommentActionExtension(
            bookmarks,
            commentAnchors,
            commentsEnabled,
            (request) => onOpenLineActionsRef.current?.(request),
          ),
        ),
      });
    }, [bookmarks, commentAnchors, commentsEnabled]);

    const linkPopoverUrlSafe = linkPopover ? isSafeMarkdownLinkUrl(linkPopover.draftUrl) : false;

    const handleOpenLink = () => {
      if (!linkPopover || !isSafeMarkdownLinkUrl(linkPopover.draftUrl)) {
        return;
      }

      window.open(linkPopover.draftUrl, "_blank", "noopener,noreferrer");
    };

    const handleCopyLink = () => {
      if (!linkPopover) {
        return;
      }

      void navigator.clipboard?.writeText(linkPopover.draftUrl);
    };

    const handleSaveLink = () => {
      const view = viewRef.current;
      if (!view || !linkPopover) {
        return;
      }

      const edit = updateMarkdownLinkUrl(
        view.state.doc.toString(),
        linkPopover.link.from,
        linkPopover.draftUrl,
      );
      if (!edit) {
        setLinkPopover(null);
        return;
      }

      dispatchLocalTextPatches(view, [edit.patch], edit.selection);
      setLinkPopover(null);
    };

    return (
      <div className="markdown-editor-shell">
        <div ref={containerRef} className="markdown-editor" aria-label="Editor" />
        {linkPopover && (
          <div className="editor-link-popover" style={getLinkPopoverStyle(linkPopover)}>
            <input
              type="url"
              value={linkPopover.draftUrl}
              spellCheck={false}
              aria-label="Link URL"
              onChange={(event) =>
                setLinkPopover((current) =>
                  current
                    ? {
                        ...current,
                        draftUrl: event.target.value,
                      }
                    : current,
                )
              }
            />
            <div className="editor-link-popover-actions">
              <button type="button" disabled={!linkPopoverUrlSafe} onClick={handleOpenLink}>
                Open
              </button>
              <button type="button" onClick={handleCopyLink}>
                Copy
              </button>
              <button type="button" onClick={handleSaveLink}>
                Save
              </button>
              <button type="button" onClick={() => setLinkPopover(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  },
);
