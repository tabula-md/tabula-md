import * as Y from "yjs";
import {
  createRoomActor,
  parseRoomActor,
  type RoomActor,
  type WorkspaceRoomCrdt,
} from "@tabula-md/tabula";
import type { Collaborator, LiveSelection } from "./workspaceRoomRuntimeTypes";

export const createWorkspaceRoomActor = (identity: Collaborator): RoomActor =>
  createRoomActor({
    id: identity.id,
    kind: identity.kind ?? "human",
    name: identity.name,
    color: identity.color,
    client: identity.client ?? "tabula-md",
    capabilities: identity.capabilities,
    joinedAt: identity.joinedAt,
  });

export const isWorkspaceRoomActor = (value: unknown): value is RoomActor =>
  parseRoomActor(value) !== null;

export const getSelectionFromAwarenessState = (
  room: WorkspaceRoomCrdt,
  state: Record<string, unknown>,
): LiveSelection | undefined => {
  const cursor = state.cursor;
  if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return undefined;
  const raw = cursor as { anchor?: Y.RelativePosition; head?: Y.RelativePosition };
  if (!raw.anchor || !raw.head) return undefined;

  try {
    const anchor = Y.createAbsolutePositionFromRelativePosition(raw.anchor, room.doc);
    const head = Y.createAbsolutePositionFromRelativePosition(raw.head, room.doc);
    if (!anchor || !head || anchor.type !== head.type) return undefined;
    let documentId: string | undefined;
    room.documents.forEach((text, id) => {
      if (text === anchor.type) documentId = id;
    });
    return documentId
      ? {
          documentId,
          from: Math.min(anchor.index, head.index),
          to: Math.max(anchor.index, head.index),
        }
      : undefined;
  } catch {
    return undefined;
  }
};
