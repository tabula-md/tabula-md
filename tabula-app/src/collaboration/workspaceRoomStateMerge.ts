import {
  getAvailableWorkspaceFileTitle,
  type WorkspaceRoomState,
} from "@tabula-md/tabula";
import type { WorkspaceFile, WorkspaceState } from "../workspaceStorage";

type WorkspaceModelSnapshot = Pick<WorkspaceState, "activeFileId" | "files" | "openFileIds">;

type ReconcileWorkspaceRoomStateOptions = {
  activeFile?: WorkspaceFile;
  createFile: (index: number, overrides?: Partial<WorkspaceFile>) => WorkspaceFile;
  roomShareUrl?: string;
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
  roomShareUrl,
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
  const activeRoomShareUrl = activeFile?.roomId === workspace.roomId ? activeFile.shareUrl : roomShareUrl;
  const localOnlyFiles = workspaceSnapshot.files.filter(
    (file) => file.roomId !== workspace.roomId && !documentNodeIds.has(file.id),
  );
  const localFilesBeforeRoom = localOnlyFiles.filter((file) => workspaceSnapshot.files.indexOf(file) < insertionIndex);
  const localFilesAfterRoom = localOnlyFiles.filter((file) => workspaceSnapshot.files.indexOf(file) >= insertionIndex);
  const titleRegistry: WorkspaceFile[] = [];
  const sharedFiles = documentNodes.map((node, index) => {
    const existingFile = existingFilesById.get(node.id);
    const shareUrl = activeRoomShareUrl ?? existingFile?.shareUrl;
    const title = getAvailableWorkspaceFileTitle(titleRegistry, node.title);
    const collaborationFields = {
      roomId: workspace.roomId,
      ...(shareUrl ? { shareUrl } : {}),
      connectionStatus: existingFile?.id === activeFile?.id ? existingFile?.connectionStatus : "idle",
      collaboratorCount: existingFile?.collaboratorCount ?? 0,
    } satisfies Partial<WorkspaceFile>;

    const nextFile = existingFile
      ? ({
          ...existingFile,
          ...collaborationFields,
          title,
          parentId: node.parentId,
          order: node.order,
        } satisfies WorkspaceFile)
      : createFile(workspaceSnapshot.files.length + index + 1, {
          ...collaborationFields,
          id: node.id,
          title,
          text: "",
          parentId: node.parentId,
          order: node.order,
        });
    titleRegistry.push(nextFile);
    return nextFile;
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
