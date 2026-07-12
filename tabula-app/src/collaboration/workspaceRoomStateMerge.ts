import type { WorkspaceRoomStructureSnapshot } from "@tabula-md/tabula";
import {
  WORKSPACE_ROOT_FOLDER_ID,
  createWorkspaceRootFolder,
  type WorkspaceFile,
  type WorkspaceFolder,
  type WorkspaceState,
} from "../workspaceStorage";

type WorkspaceModelSnapshot = Pick<WorkspaceState, "activeFileId" | "files" | "folders" | "openFileIds">;

type ReconcileWorkspaceRoomStructureOptions = {
  createFile: (index: number, overrides?: Partial<WorkspaceFile>) => WorkspaceFile;
  materializeExistingDocuments?: boolean;
  readDocumentText: (documentId: string) => string | null;
  snapshot: WorkspaceRoomStructureSnapshot;
  workspaceSnapshot: WorkspaceModelSnapshot;
};

export const reconcileWorkspaceRoomStructure = ({
  createFile,
  materializeExistingDocuments = false,
  readDocumentText,
  snapshot,
  workspaceSnapshot,
}: ReconcileWorkspaceRoomStructureOptions): WorkspaceModelSnapshot => {
  const documentNodes = snapshot.nodes.filter((node) => node.type === "document");
  const existingFilesById = new Map(workspaceSnapshot.files.map((file) => [file.id, file]));
  const sharedFiles = documentNodes.map((node, index) => {
    const existing = existingFilesById.get(node.id);
    return existing
      ? {
          ...existing,
          title: node.title,
          text: materializeExistingDocuments
            ? readDocumentText(node.id) ?? existing.text
            : existing.text,
          parentId: node.parentId ?? WORKSPACE_ROOT_FOLDER_ID,
          order: node.order,
        }
      : createFile(workspaceSnapshot.files.length + index + 1, {
          id: node.id,
          title: node.title,
          text: readDocumentText(node.id) ?? "",
          parentId: node.parentId ?? WORKSPACE_ROOT_FOLDER_ID,
          order: node.order,
        });
  });
  const nextFiles = sharedFiles;
  const nextFileIds = new Set(nextFiles.map((file) => file.id));
  const retainedOpenFileIds = workspaceSnapshot.openFileIds.filter((fileId) => nextFileIds.has(fileId));
  const activeFileId = nextFileIds.has(workspaceSnapshot.activeFileId)
    ? workspaceSnapshot.activeFileId
    : retainedOpenFileIds[0] ?? sharedFiles[0]?.id ?? "";
  const openFileIds = activeFileId && !retainedOpenFileIds.includes(activeFileId)
    ? [...retainedOpenFileIds, activeFileId]
    : retainedOpenFileIds;

  const incomingFolders: WorkspaceFolder[] = snapshot.nodes
    .filter((node) => node.type === "folder")
    .map((node) => ({
      id: node.id,
      title: node.title,
      parentId: node.id === snapshot.rootId ? null : node.parentId,
      order: node.order,
    }));
  if (!incomingFolders.some((folder) => folder.id === WORKSPACE_ROOT_FOLDER_ID)) {
    incomingFolders.unshift(createWorkspaceRootFolder());
  }
  return {
    files: nextFiles,
    folders: incomingFolders,
    openFileIds,
    activeFileId,
  };
};
