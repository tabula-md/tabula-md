import type { WorkspaceRoomState } from "@tabula-md/tabula";
import type { WorkspaceFile, WorkspaceState } from "../workspaceStorage";

type WorkspaceModelSnapshot = Pick<WorkspaceState, "activeFileId" | "files" | "openFileIds">;

type ReconcileWorkspaceRoomStateOptions = {
  activeFile?: WorkspaceFile;
  createFile: (index: number, overrides?: Partial<WorkspaceFile>) => WorkspaceFile;
  workspace: WorkspaceRoomState;
  workspaceSnapshot: WorkspaceModelSnapshot;
};

const getRoomDocumentNodes = (workspace: WorkspaceRoomState) =>
  workspace.nodes
    .filter((node) => node.type === "document" && node.id !== `live-${workspace.roomId}`)
    .sort((first, second) => {
      const firstOrder = first.order ?? Number.MAX_SAFE_INTEGER;
      const secondOrder = second.order ?? Number.MAX_SAFE_INTEGER;
      return firstOrder - secondOrder || first.title.localeCompare(second.title);
    });

export const reconcileWorkspaceRoomState = ({
  activeFile,
  createFile,
  workspace,
  workspaceSnapshot,
}: ReconcileWorkspaceRoomStateOptions): WorkspaceModelSnapshot | null => {
  const documentNodes = getRoomDocumentNodes(workspace);
  if (documentNodes.length === 0) {
    return null;
  }

  const documentNodeIds = new Set(documentNodes.map((node) => node.id));
  const existingFilesById = new Map(workspaceSnapshot.files.map((file) => [file.id, file]));
  const firstSharedIndex = workspaceSnapshot.files.findIndex(
    (file) => file.roomId === workspace.roomId || documentNodeIds.has(file.id),
  );
  const insertionIndex = firstSharedIndex < 0 ? workspaceSnapshot.files.length : firstSharedIndex;
  const activeRoomShareUrl = activeFile?.roomId === workspace.roomId ? activeFile.shareUrl : undefined;
  const localOnlyFiles = workspaceSnapshot.files.filter(
    (file) => file.roomId !== workspace.roomId && !documentNodeIds.has(file.id),
  );
  const localFilesBeforeRoom = localOnlyFiles.filter((file) => workspaceSnapshot.files.indexOf(file) < insertionIndex);
  const localFilesAfterRoom = localOnlyFiles.filter((file) => workspaceSnapshot.files.indexOf(file) >= insertionIndex);
  const sharedFiles = documentNodes.map((node, index) => {
    const existingFile = existingFilesById.get(node.id);
    const shareUrl = activeRoomShareUrl ?? existingFile?.shareUrl;
    const collaborationFields = {
      roomId: workspace.roomId,
      ...(shareUrl ? { shareUrl } : {}),
      connectionStatus: existingFile?.id === activeFile?.id ? existingFile?.connectionStatus : "idle",
      collaboratorCount: existingFile?.collaboratorCount ?? 0,
    } satisfies Partial<WorkspaceFile>;

    return existingFile
      ? {
          ...existingFile,
          ...collaborationFields,
          title: node.title,
          parentId: node.parentId,
          order: node.order,
        }
      : createFile(workspaceSnapshot.files.length + index + 1, {
          ...collaborationFields,
          id: node.id,
          title: node.title,
          text: "",
          parentId: node.parentId,
          order: node.order,
        });
  });
  const nextFiles = [...localFilesBeforeRoom, ...sharedFiles, ...localFilesAfterRoom];
  const nextFileIds = new Set(nextFiles.map((file) => file.id));
  const retainedOpenFileIds = workspaceSnapshot.openFileIds.filter((fileId) => nextFileIds.has(fileId));
  const openedWorkspaceFileIds = sharedFiles
    .map((file) => file.id)
    .filter((fileId) => !retainedOpenFileIds.includes(fileId));
  const nextActiveFileId = nextFileIds.has(workspaceSnapshot.activeFileId)
    ? workspaceSnapshot.activeFileId
    : workspace.activeDocumentId && nextFileIds.has(workspace.activeDocumentId)
      ? workspace.activeDocumentId
      : sharedFiles[0]?.id ?? nextFiles[0]?.id ?? workspaceSnapshot.activeFileId;

  return {
    files: nextFiles,
    openFileIds: [...retainedOpenFileIds, ...openedWorkspaceFileIds],
    activeFileId: nextActiveFileId,
  };
};
