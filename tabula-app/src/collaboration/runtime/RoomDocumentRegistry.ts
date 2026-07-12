import type { Extension } from "@codemirror/state";
import * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import { yCollab } from "y-codemirror.next";

const DEFAULT_MAX_UNDO_MANAGERS = 8;
const DEFAULT_MAX_UNDO_STACK_ITEMS = 100;

export type RoomDocumentResource = {
  documentId: string;
  extension: Extension;
  yText: Y.Text;
  undoManager: Y.UndoManager;
};

export type RoomDocumentLease = {
  resource: RoomDocumentResource;
  release(): void;
};

type RoomDocumentEntry = {
  resource: RoomDocumentResource;
  references: number;
  lastUsed: number;
};

type RoomDocumentRegistryOptions = {
  awareness: Awareness;
  documents: Y.Map<Y.Text>;
  maxUndoManagers?: number;
  maxUndoStackItems?: number;
};

const createBoundedUndoManager = (text: Y.Text, maxStackItems: number) => {
  const undoManager = new Y.UndoManager(text);
  const trimHistory = () => {
    if (undoManager.undoStack.length > maxStackItems) {
      undoManager.undoStack.splice(0, undoManager.undoStack.length - maxStackItems);
    }
    if (undoManager.redoStack.length > maxStackItems) {
      undoManager.redoStack.splice(0, undoManager.redoStack.length - maxStackItems);
    }
  };
  undoManager.on("stack-item-added", trimHistory);
  return undoManager;
};

export const createRoomDocumentRegistry = ({
  awareness,
  documents,
  maxUndoManagers = DEFAULT_MAX_UNDO_MANAGERS,
  maxUndoStackItems = DEFAULT_MAX_UNDO_STACK_ITEMS,
}: RoomDocumentRegistryOptions) => {
  const entries = new Map<string, RoomDocumentEntry>();
  let useSequence = 0;
  let activeLeases = 0;
  let disposed = false;

  const disposeEntry = (documentId: string) => {
    const entry = entries.get(documentId);
    if (!entry) return;
    entry.resource.undoManager.destroy();
    entries.delete(documentId);
  };

  const prune = () => {
    while (entries.size > maxUndoManagers) {
      const candidate = [...entries.entries()]
        .filter(([, entry]) => entry.references === 0)
        .sort((first, second) => first[1].lastUsed - second[1].lastUsed)[0];
      if (!candidate) return;
      disposeEntry(candidate[0]);
    }
  };

  const sync = () => {
    for (const [documentId, entry] of entries) {
      if (documents.get(documentId) !== entry.resource.yText) {
        activeLeases -= entry.references;
        disposeEntry(documentId);
      }
    }
    prune();
  };

  return {
    acquire(documentId: string): RoomDocumentLease | null {
      if (disposed) return null;
      const yText = documents.get(documentId);
      if (!yText) return null;
      let entry = entries.get(documentId);
      if (entry && entry.resource.yText !== yText) {
        activeLeases -= entry.references;
        disposeEntry(documentId);
        entry = undefined;
      }
      if (!entry) {
        const undoManager = createBoundedUndoManager(yText, maxUndoStackItems);
        entry = {
          resource: {
            documentId,
            extension: yCollab(yText, awareness, { undoManager }),
            yText,
            undoManager,
          },
          references: 0,
          lastUsed: ++useSequence,
        };
        entries.set(documentId, entry);
      }
      entry.references += 1;
      entry.lastUsed = ++useSequence;
      activeLeases += 1;
      let released = false;
      return {
        resource: entry.resource,
        release() {
          if (released) return;
          released = true;
          activeLeases -= 1;
          const current = entries.get(documentId);
          if (current?.resource === entry?.resource) {
            current.references = Math.max(0, current.references - 1);
            current.lastUsed = ++useSequence;
          }
          prune();
        },
      };
    },

    sync,

    getResourceCounts() {
      return {
        activeLeases,
        documentHandles: entries.size,
        undoManagers: entries.size,
      };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      activeLeases = 0;
      for (const documentId of [...entries.keys()]) disposeEntry(documentId);
    },
  };
};

export type RoomDocumentRegistry = ReturnType<typeof createRoomDocumentRegistry>;
