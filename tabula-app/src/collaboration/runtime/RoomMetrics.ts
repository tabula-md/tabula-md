import * as Y from "yjs";
import {
  getWorkspaceRoomComments,
  WORKSPACE_ROOM_MAX_COMMENT_LENGTH,
  WORKSPACE_ROOM_MAX_COMMENTS,
  WORKSPACE_ROOM_MAX_CONTENT_BYTES,
  WORKSPACE_ROOM_MAX_REPLIES,
  type WorkspaceRoomCrdt,
} from "@tabula-md/tabula";
import { Utf8TextSizeTracker } from "../utf8TextSizeTracker";

const encoder = new TextEncoder();

export type RoomDocumentMetricsChange = {
  changedDocumentIds: readonly string[];
  removedDocumentIds: readonly string[];
  structureChanged: boolean;
};

export const createRoomMetrics = (room: WorkspaceRoomCrdt) => {
  const documentByteLengths = new Map<string, number>();
  const documentSizeTrackers = new Map<string, Utf8TextSizeTracker>();
  const indexedDocumentTexts = new Map<string, Y.Text>();
  let documentIdsByText = new WeakMap<Y.Text, string>();
  let commentByteLength = 0;
  let commentsWithinLimits = true;
  let roomContentByteLength = 0;

  const refreshTotal = () => {
    roomContentByteLength = commentByteLength;
    for (const byteLength of documentByteLengths.values()) {
      roomContentByteLength += byteLength;
    }
  };

  const syncDocuments = () => {
    const currentDocumentIds = new Set<string>();
    const removedDocumentIds: string[] = [];
    room.documents.forEach((text, id) => {
      currentDocumentIds.add(id);
      documentIdsByText.set(text, id);
      if (indexedDocumentTexts.get(id) === text && documentSizeTrackers.has(id)) return;
      indexedDocumentTexts.set(id, text);
      const tracker = new Utf8TextSizeTracker(text.toString());
      documentSizeTrackers.set(id, tracker);
      documentByteLengths.set(id, tracker.byteLength);
    });
    for (const id of indexedDocumentTexts.keys()) {
      if (currentDocumentIds.has(id)) continue;
      removedDocumentIds.push(id);
      indexedDocumentTexts.delete(id);
      documentSizeTrackers.delete(id);
      documentByteLengths.delete(id);
    }
    refreshTotal();
    return removedDocumentIds;
  };

  const refreshComments = () => {
    const comments = Object.values(getWorkspaceRoomComments(room)).flat();
    commentsWithinLimits =
      comments.length <= WORKSPACE_ROOM_MAX_COMMENTS &&
      comments.every((comment) =>
        comment.body.length <= WORKSPACE_ROOM_MAX_COMMENT_LENGTH &&
        comment.replies.length <= WORKSPACE_ROOM_MAX_REPLIES &&
        comment.replies.every((reply) => reply.body.length <= WORKSPACE_ROOM_MAX_COMMENT_LENGTH),
      );
    commentByteLength = comments.reduce(
      (total, comment) => total + encoder.encode(comment.body).byteLength +
        comment.replies.reduce(
          (replyTotal, reply) => replyTotal + encoder.encode(reply.body).byteLength,
          0,
        ),
      0,
    );
    refreshTotal();
  };

  const applyDocumentEvents = (
    events: readonly Y.YEvent<Y.AbstractType<unknown>>[],
  ): RoomDocumentMetricsChange => {
    const structureChanged = events.some((event) => event.target === room.documents);
    const removedDocumentIds = structureChanged ? syncDocuments() : [];
    const changedDocumentIds = new Set<string>();
    for (const event of events) {
      if (!(event instanceof Y.YTextEvent)) continue;
      const text = event.target;
      const id = documentIdsByText.get(text);
      if (!id) continue;
      const tracker = documentSizeTrackers.get(id) ?? new Utf8TextSizeTracker(text.toString());
      documentSizeTrackers.set(id, tracker);
      documentByteLengths.set(id, tracker.applyDelta(event.delta));
      changedDocumentIds.add(id);
    }
    refreshTotal();
    return {
      changedDocumentIds: [...changedDocumentIds],
      removedDocumentIds,
      structureChanged,
    };
  };

  syncDocuments();
  refreshComments();

  return {
    applyDocumentEvents,
    canApplyTextByteDelta(byteDelta: number) {
      return Number.isFinite(byteDelta) &&
        roomContentByteLength + byteDelta >= 0 &&
        roomContentByteLength + byteDelta <= WORKSPACE_ROOM_MAX_CONTENT_BYTES;
    },
    dispose() {
      documentByteLengths.clear();
      documentSizeTrackers.clear();
      indexedDocumentTexts.clear();
      documentIdsByText = new WeakMap();
      commentByteLength = 0;
      roomContentByteLength = 0;
    },
    getDocumentByteLength(documentId: string) {
      return documentByteLengths.get(documentId);
    },
    getSnapshot() {
      return {
        commentsWithinLimits,
        roomContentByteLength,
      };
    },
    refreshComments,
    syncDocuments,
  };
};

export type RoomMetrics = ReturnType<typeof createRoomMetrics>;
