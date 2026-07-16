import {
  createWorkspaceRoomBootstrap,
  type WorkspaceRoomComment,
} from "@tabula-md/tabula";

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
  const { update } = createWorkspaceRoomBootstrap({
    roomId,
    documents: documents.map((document) => ({
      ...document,
      markdown: document.text,
    })),
    folders,
    commentsByFileId,
  });
  return {
    generation: 0,
    checkpointUpdate: update,
  };
};
