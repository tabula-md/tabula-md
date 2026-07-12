import {
  getWorkspaceRoomDocumentComments,
  type WorkspaceRoomComment,
  type WorkspaceRoomCrdt,
} from "@tabula-md/tabula";

const EMPTY_COMMENTS: readonly WorkspaceRoomComment[] = Object.freeze([]);

const sameReply = (
  first: WorkspaceRoomComment["replies"][number],
  second: WorkspaceRoomComment["replies"][number],
) =>
  first.id === second.id &&
  first.body === second.body &&
  first.authorId === second.authorId &&
  first.authorName === second.authorName &&
  first.authorColor === second.authorColor &&
  first.createdAt === second.createdAt;

const sameComment = (first: WorkspaceRoomComment, second: WorkspaceRoomComment) =>
  first.id === second.id &&
  first.fileId === second.fileId &&
  first.body === second.body &&
  first.authorId === second.authorId &&
  first.authorName === second.authorName &&
  first.authorColor === second.authorColor &&
  first.quote === second.quote &&
  first.sourceQuote === second.sourceQuote &&
  first.selectionStart === second.selectionStart &&
  first.selectionEnd === second.selectionEnd &&
  first.resolved === second.resolved &&
  first.createdAt === second.createdAt &&
  first.replies.length === second.replies.length &&
  first.replies.every((reply, index) => sameReply(reply, second.replies[index]));

const sameComments = (
  first: readonly WorkspaceRoomComment[],
  second: readonly WorkspaceRoomComment[],
) => first.length === second.length && first.every((comment, index) => sameComment(comment, second[index]));

type CommentsEntry = {
  listeners: Set<() => void>;
  snapshot: readonly WorkspaceRoomComment[];
};

export const createRoomCommentsStore = (room: WorkspaceRoomCrdt) => {
  const entries = new Map<string, CommentsEntry>();
  let disposed = false;

  const readComments = (documentId: string) =>
    getWorkspaceRoomDocumentComments(room, documentId);

  const getEntry = (documentId: string) => {
    let entry = entries.get(documentId);
    if (!entry) {
      entry = { listeners: new Set(), snapshot: readComments(documentId) };
      entries.set(documentId, entry);
    }
    return entry;
  };

  const hasSubscribers = (documentId?: string) => {
    if (documentId) return (entries.get(documentId)?.listeners.size ?? 0) > 0;
    return [...entries.values()].some((entry) => entry.listeners.size > 0);
  };

  return {
    subscribe(documentId: string, listener: () => void) {
      if (disposed) return () => undefined;
      const entry = getEntry(documentId);
      const current = readComments(documentId);
      if (!sameComments(entry.snapshot, current)) entry.snapshot = current;
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
        if (entry.listeners.size === 0 && entries.get(documentId) === entry) {
          entries.delete(documentId);
        }
      };
    },

    getSnapshot(documentId: string) {
      if (disposed) return EMPTY_COMMENTS;
      return getEntry(documentId).snapshot;
    },

    materialize(documentId: string) {
      return readComments(documentId);
    },

    hasSubscribers,

    refresh() {
      if (disposed || !hasSubscribers()) return false;
      let changed = false;
      for (const [documentId, entry] of entries) {
        if (entry.listeners.size === 0) continue;
        const next = readComments(documentId);
        if (sameComments(entry.snapshot, next)) continue;
        entry.snapshot = next;
        entry.listeners.forEach((listener) => listener());
        changed = true;
      }
      return changed;
    },

    getResourceCounts() {
      let subscriptions = 0;
      for (const entry of entries.values()) subscriptions += entry.listeners.size;
      return {
        commentDocuments: [...entries.values()].filter((entry) => entry.listeners.size > 0).length,
        commentSnapshots: entries.size,
        commentSubscriptions: subscriptions,
      };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of entries.values()) entry.listeners.clear();
      entries.clear();
    },
  };
};

export type RoomCommentsStore = ReturnType<typeof createRoomCommentsStore>;
