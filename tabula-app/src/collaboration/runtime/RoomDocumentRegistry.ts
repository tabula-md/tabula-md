import type { Extension } from "@codemirror/state";
import * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import { yCollab } from "y-codemirror.next";

const DEFAULT_MAX_UNDO_MANAGERS = 8;
const DEFAULT_MAX_UNDO_STACK_ITEMS = 100;

export type RoomDocumentHandle = {
  documentId: string;
  extension: Extension;
  yText: Y.Text;
  undoManager: Y.UndoManager;
};

export type RoomDocumentLease = {
  handle: RoomDocumentHandle;
  release(): void;
};

type RoomDocumentEntry = {
  handle: RoomDocumentHandle;
  references: number;
  lastUsed: number;
  retired: boolean;
  destroyed: boolean;
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
  const allEntries = new Set<RoomDocumentEntry>();
  let useSequence = 0;
  let activeLeases = 0;
  let disposed = false;

  const destroyEntry = (entry: RoomDocumentEntry) => {
    if (entry.destroyed) return;
    entry.destroyed = true;
    entry.handle.undoManager.destroy();
    allEntries.delete(entry);
  };

  const retireEntry = (documentId: string, entry: RoomDocumentEntry) => {
    if (entries.get(documentId) === entry) entries.delete(documentId);
    entry.retired = true;
    if (entry.references === 0) destroyEntry(entry);
  };

  const prune = () => {
    while (entries.size > maxUndoManagers) {
      const candidate = [...entries.entries()]
        .filter(([, entry]) => entry.references === 0)
        .sort((first, second) => first[1].lastUsed - second[1].lastUsed)[0];
      if (!candidate) return;
      retireEntry(candidate[0], candidate[1]);
    }
  };

  const sync = () => {
    for (const [documentId, entry] of entries) {
      if (documents.get(documentId) !== entry.handle.yText) {
        retireEntry(documentId, entry);
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
      if (entry && entry.handle.yText !== yText) {
        retireEntry(documentId, entry);
        entry = undefined;
      }
      if (!entry) {
        const undoManager = createBoundedUndoManager(yText, maxUndoStackItems);
        entry = {
          handle: {
            documentId,
            extension: yCollab(yText, awareness, { undoManager }),
            yText,
            undoManager,
          },
          references: 0,
          lastUsed: ++useSequence,
          retired: false,
          destroyed: false,
        };
        entries.set(documentId, entry);
        allEntries.add(entry);
      }
      entry.references += 1;
      entry.lastUsed = ++useSequence;
      activeLeases += 1;
      prune();
      let released = false;
      return {
        handle: entry.handle,
        release() {
          if (released) return;
          released = true;
          activeLeases -= 1;
          entry.references = Math.max(0, entry.references - 1);
          entry.lastUsed = ++useSequence;
          if (entry.retired && entry.references === 0) destroyEntry(entry);
          prune();
        },
      };
    },

    sync,

    getResourceCounts() {
      return {
        activeLeases,
        documentHandles: entries.size,
        undoManagers: allEntries.size,
      };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      activeLeases = 0;
      entries.clear();
      for (const entry of allEntries) destroyEntry(entry);
    },
  };
};

export type RoomDocumentRegistry = ReturnType<typeof createRoomDocumentRegistry>;
