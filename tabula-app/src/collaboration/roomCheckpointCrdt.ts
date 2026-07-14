import {
  ROOM_WIRE_MAX_CRDT_STATE_BYTES,
  WORKSPACE_ROOM_ROOT_ID,
  createWorkspaceRoomCrdt,
  getWorkspaceRoomSnapshot,
  initializeWorkspaceRoomCrdt,
  validateWorkspaceRoomLimits,
  validateWorkspaceRoomStructure,
  type WorkspaceRoomComment,
} from "@tabula-md/tabula";
import * as Y from "yjs";
import {
  createDefaultRoomCheckpointStore,
  encryptWorkspaceRoomCheckpoint,
  ROOM_CHECKPOINT_RETENTION_MS,
  type RoomCheckpointStore,
} from "./roomCheckpointStore";

export type InitialWorkspaceRoomCheckpointInput = {
  roomId: string;
  roomKey: string;
  documents: readonly {
    id: string;
    title: string;
    text: string;
    parentId?: string | null;
    order?: number;
  }[];
  folders: readonly {
    id: string;
    title: string;
    parentId: string | null;
    order?: number;
  }[];
  commentsByFileId?: Record<string, WorkspaceRoomComment[]>;
};

export const persistInitialWorkspaceRoomCheckpoint = async (
  {
    roomId,
    roomKey,
    documents,
    folders,
    commentsByFileId = {},
  }: InitialWorkspaceRoomCheckpointInput,
  store: RoomCheckpointStore = createDefaultRoomCheckpointStore(),
) => {
  if (!store.enabled) throw new Error("Live room persistence is unavailable.");

  const doc = new Y.Doc();
  const room = createWorkspaceRoomCrdt({ roomId, doc });
  try {
    initializeWorkspaceRoomCrdt(room, {
      nodes: [
        ...folders
          .filter((folder) => folder.id !== WORKSPACE_ROOM_ROOT_ID)
          .map((folder) => ({
            ...folder,
            type: "folder" as const,
            parentId: folder.parentId ?? WORKSPACE_ROOM_ROOT_ID,
          })),
        ...documents.map((document) => ({
          id: document.id,
          type: "document" as const,
          parentId: document.parentId ?? WORKSPACE_ROOM_ROOT_ID,
          title: document.title,
          order: document.order,
          markdown: document.text,
        })),
      ],
      comments: Object.values(commentsByFileId).flat(),
    });

    const structure = validateWorkspaceRoomStructure(room, roomId);
    if (!structure.ok) throw new Error(structure.message);
    const limits = validateWorkspaceRoomLimits(getWorkspaceRoomSnapshot(room));
    if (!limits.ok) throw new Error(limits.message);

    const update = Y.encodeStateAsUpdate(doc);
    if (update.byteLength > ROOM_WIRE_MAX_CRDT_STATE_BYTES) {
      throw new Error("The collaboration state exceeds the supported size.");
    }
    const encryptedCheckpoint = await encryptWorkspaceRoomCheckpoint({ roomId, update, roomKey });
    const expiresAt = Date.now() + ROOM_CHECKPOINT_RETENTION_MS;
    const result = await store.saveEncryptedCheckpoint(roomId, {
      expectedGeneration: 0,
      encryptedCheckpoint,
      expiresAt,
    });
    if (!result.ok) throw new Error("The live room already exists.");
    return {
      generation: result.generation,
      expiresAt,
      checkpointUpdate: update,
    };
  } finally {
    doc.destroy();
  }
};
