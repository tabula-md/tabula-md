import * as Y from "yjs";
import { ROOM_WIRE_MAX_CRDT_STATE_BYTES } from "./roomBinaryProtocol";
import {
  createWorkspaceRoomCrdt,
  getWorkspaceRoomSnapshot,
  initializeWorkspaceRoomCrdt,
  renameWorkspaceRoomNode,
  validateWorkspaceRoomStructure,
} from "./workspaceRoomCrdt";
import { WORKSPACE_ROOM_ROOT_ID, validateWorkspaceRoomLimits, type WorkspaceRoomComment } from "./workspaceRoomModel";

export type WorkspaceRoomBootstrapInput = {
  roomId: string;
  workspaceName?: string;
  documents: readonly {
    id: string;
    title: string;
    markdown: string;
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

/**
 * Creates the validated initial Yjs state for a Room Workspace. The update is
 * transport-agnostic: a browser or local MCP client may send it to live peers
 * immediately and optionally persist it as an encrypted checkpoint.
 */
export const createWorkspaceRoomBootstrap = ({
  roomId,
  workspaceName,
  documents,
  folders,
  commentsByFileId = {},
}: WorkspaceRoomBootstrapInput) => {
  const doc = new Y.Doc();
  const room = createWorkspaceRoomCrdt({ roomId, doc });
  try {
    if (workspaceName) {
      renameWorkspaceRoomNode(
        room,
        WORKSPACE_ROOM_ROOT_ID,
        workspaceName,
        new Date(0).toISOString(),
      );
    }
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
          ...document,
          type: "document" as const,
          parentId: document.parentId ?? WORKSPACE_ROOM_ROOT_ID,
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
    return { update };
  } finally {
    doc.destroy();
  }
};
