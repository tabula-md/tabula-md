import type {
  WorkspaceRoomSnapshot,
  WorkspaceRoomStructureSnapshot,
} from "@tabula-md/tabula";
import {
  WORKSPACE_ROOT_FOLDER_ID,
  createWorkspaceRootFolder,
  type FileComment,
  type WorkspaceFile,
  type WorkspaceFolder,
  type WorkspaceState,
} from "../workspaceStorage";

type WorkspaceModelSnapshot = Pick<
  WorkspaceState,
  "activeFileId" | "files" | "folders" | "openFileIds"
>;

type ProjectWorkspaceRoomOptions = {
  createFile: (index: number, overrides?: Partial<WorkspaceFile>) => WorkspaceFile;
  snapshot: WorkspaceRoomStructureSnapshot;
  workspaceSnapshot: WorkspaceModelSnapshot;
};

export const clearWorkspaceDocumentBodies = (
  workspaceSnapshot: WorkspaceModelSnapshot,
): WorkspaceModelSnapshot => ({
  ...workspaceSnapshot,
  files: workspaceSnapshot.files.map((file) => file.text ? { ...file, text: "" } : file),
});

const projectWorkspaceRoom = ({
  createFile,
  documentText,
  snapshot,
  workspaceSnapshot,
}: ProjectWorkspaceRoomOptions & {
  documentText: (documentId: string) => string;
}): WorkspaceModelSnapshot => {
  const documentNodes = snapshot.nodes.filter((node) => node.type === "document");
  const existingFilesById = new Map(workspaceSnapshot.files.map((file) => [file.id, file]));
  const files = documentNodes.map((node, index) => {
    const existing = existingFilesById.get(node.id);
    const text = documentText(node.id);
    return existing
      ? {
          ...existing,
          title: node.title,
          text,
          parentId: node.parentId ?? WORKSPACE_ROOT_FOLDER_ID,
          order: node.order,
        }
      : createFile(workspaceSnapshot.files.length + index + 1, {
          id: node.id,
          title: node.title,
          text,
          parentId: node.parentId ?? WORKSPACE_ROOT_FOLDER_ID,
          order: node.order,
        });
  });
  const fileIds = new Set(files.map((file) => file.id));
  const retainedOpenFileIds = workspaceSnapshot.openFileIds.filter((fileId) => fileIds.has(fileId));
  const activeFileId = fileIds.has(workspaceSnapshot.activeFileId)
    ? workspaceSnapshot.activeFileId
    : retainedOpenFileIds[0] ?? files[0]?.id ?? "";
  const openFileIds = activeFileId && !retainedOpenFileIds.includes(activeFileId)
    ? [...retainedOpenFileIds, activeFileId]
    : retainedOpenFileIds;
  const folders: WorkspaceFolder[] = snapshot.nodes
    .filter((node) => node.type === "folder")
    .map((node) => ({
      id: node.id,
      title: node.title,
      parentId: node.id === snapshot.rootId ? null : node.parentId,
      order: node.order,
    }));
  if (!folders.some((folder) => folder.id === WORKSPACE_ROOT_FOLDER_ID)) {
    folders.unshift(createWorkspaceRootFolder());
  }

  return { files, folders, openFileIds, activeFileId };
};

export const projectWorkspaceRoomStructure = (
  options: ProjectWorkspaceRoomOptions,
): WorkspaceModelSnapshot => projectWorkspaceRoom({
  ...options,
  documentText: () => "",
});

export const materializeWorkspaceRoomSnapshot = ({
  snapshot,
  ...options
}: Omit<ProjectWorkspaceRoomOptions, "snapshot"> & {
  snapshot: WorkspaceRoomSnapshot;
}): WorkspaceModelSnapshot => projectWorkspaceRoom({
  ...options,
  snapshot,
  documentText: (documentId) => snapshot.documents[documentId] ?? "",
});

export const projectWorkspaceRoomComments = (
  commentsByFileId: WorkspaceRoomSnapshot["commentsByFileId"],
): Record<string, FileComment[]> => Object.fromEntries(
  Object.entries(commentsByFileId).map(([fileId, comments]) => [
    fileId,
    comments.map(({ fileId: _fileId, authorId: _authorId, ...comment }) => {
      const anchorDetached =
        typeof comment.selectionStart !== "number" ||
        typeof comment.selectionEnd !== "number" ||
        comment.selectionEnd <= comment.selectionStart;
      return {
        ...comment,
        anchorDetached,
        replies: comment.replies.map(({ authorId: _replyAuthorId, ...reply }) => reply),
        selectionStart: anchorDetached ? undefined : comment.selectionStart,
        selectionEnd: anchorDetached ? undefined : comment.selectionEnd,
      };
    }),
  ]),
);
