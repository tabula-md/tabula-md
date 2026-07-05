import {
  redo,
  redoDepth,
  undo,
  undoDepth,
} from "@codemirror/commands";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export type EditorHistoryState = {
  canUndo: boolean;
  canRedo: boolean;
};

export const EMPTY_EDITOR_HISTORY_STATE: EditorHistoryState = {
  canUndo: false,
  canRedo: false,
};

export const getEditorHistoryState = (state: EditorState): EditorHistoryState => ({
  canUndo: undoDepth(state) > 0,
  canRedo: redoDepth(state) > 0,
});

export const canUndoEditor = (view: EditorView | null) =>
  view ? undoDepth(view.state) > 0 : false;

export const canRedoEditor = (view: EditorView | null) =>
  view ? redoDepth(view.state) > 0 : false;

export const undoEditor = (view: EditorView | null) =>
  view ? undo(view) : false;

export const redoEditor = (view: EditorView | null) =>
  view ? redo(view) : false;
