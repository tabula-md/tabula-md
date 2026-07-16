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

export type InitialWorkspaceRoomBootstrapInput = {
  roomId: string;
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

export const createInitialWorkspaceRoomBootstrap = (
  {
    roomId,
    documents,
    folders,
    commentsByFileId = {},
  }: InitialWorkspaceRoomBootstrapInput,
) => {
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
    return {
      generation: 0,
      checkpointUpdate: update,
    };
  } finally {
    doc.destroy();
  }
};
