import * as Y from "yjs";
import type { TextPatch } from "@tabula-md/tabula";

const MAX_UNDO_STACK_ITEMS = 100;

export const createBoundedWorkspaceUndoManager = (text: Y.Text) => {
  const undoManager = new Y.UndoManager(text);
  const trimHistory = () => {
    if (undoManager.undoStack.length > MAX_UNDO_STACK_ITEMS) {
      undoManager.undoStack.splice(0, undoManager.undoStack.length - MAX_UNDO_STACK_ITEMS);
    }
    if (undoManager.redoStack.length > MAX_UNDO_STACK_ITEMS) {
      undoManager.redoStack.splice(0, undoManager.redoStack.length - MAX_UNDO_STACK_ITEMS);
    }
  };
  undoManager.on("stack-item-added", trimHistory);
  return undoManager;
};

export const applyWorkspaceTextPatches = (text: Y.Text, patches: readonly TextPatch[]) => {
  for (const patch of [...patches].sort((first, second) => second.from - first.from)) {
    const from = Math.max(0, Math.min(patch.from, text.length));
    const to = Math.max(from, Math.min(patch.to, text.length));
    if (to > from) text.delete(from, to - from);
    if (patch.insert) text.insert(from, patch.insert);
  }
};
