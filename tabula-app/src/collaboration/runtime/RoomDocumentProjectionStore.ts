import * as Y from "yjs";

export type RoomDocumentProjectionStore = ReturnType<typeof createRoomDocumentProjectionStore>;

export const createRoomDocumentProjectionStore = (
  documents: Y.Map<Y.Text>,
) => {
  const listenersByDocument = new Map<string, Set<() => void>>();
  const snapshots = new Map<string, string | null>();

  const read = (documentId: string) => documents.get(documentId)?.toString() ?? null;

  const getSnapshot = (documentId: string) => {
    if (!snapshots.has(documentId)) snapshots.set(documentId, read(documentId));
    return snapshots.get(documentId) ?? null;
  };

  const refresh = (documentId: string) => {
    const listeners = listenersByDocument.get(documentId);
    if (!listeners?.size) return;
    const next = read(documentId);
    if (snapshots.get(documentId) === next) return;
    snapshots.set(documentId, next);
    for (const listener of listeners) listener();
  };

  return {
    subscribe(documentId: string, listener: () => void) {
      const listeners = listenersByDocument.get(documentId) ?? new Set<() => void>();
      listeners.add(listener);
      listenersByDocument.set(documentId, listeners);
      getSnapshot(documentId);
      return () => {
        const current = listenersByDocument.get(documentId);
        current?.delete(listener);
        if (current?.size) return;
        listenersByDocument.delete(documentId);
        snapshots.delete(documentId);
      };
    },
    getSnapshot,
    hasSubscribers(documentId: string) {
      return Boolean(listenersByDocument.get(documentId)?.size);
    },
    refresh,
    clear() {
      listenersByDocument.clear();
      snapshots.clear();
    },
    getResourceCounts() {
      return {
        documentProjectionListeners: [...listenersByDocument.values()].reduce(
          (total, listeners) => total + listeners.size,
          0,
        ),
        documentProjectionSnapshots: snapshots.size,
      };
    },
  };
};
