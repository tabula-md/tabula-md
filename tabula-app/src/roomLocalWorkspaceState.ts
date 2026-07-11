import {
  WORKSPACE_ROOT_FOLDER_ID,
  createWorkspaceRootFolder,
  type FileComment,
  type WorkspaceFile,
  type WorkspaceFolder,
  type WorkspaceState,
} from "./workspaceStorage";

export const ROOM_LOCAL_WORKSPACE_SCHEMA = "tabula.room-local";
export const ROOM_LOCAL_WORKSPACE_VERSION = 1;

export type RoomLocalWorkspaceState = {
  schema: typeof ROOM_LOCAL_WORKSPACE_SCHEMA;
  version: typeof ROOM_LOCAL_WORKSPACE_VERSION;
  roomId: string;
  ownerId: string;
  savedAt: string;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  openFileIds: string[];
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
};

const clearFileCollaboration = (file: WorkspaceFile): WorkspaceFile => ({
  ...file,
  roomId: undefined,
  shareUrl: undefined,
  connectionStatus: "idle",
  lastRecoveryType: undefined,
  lastRecoveryMessage: undefined,
  lastRecoveryAt: undefined,
});

const clearFolderCollaboration = (folder: WorkspaceFolder): WorkspaceFolder => ({
  ...folder,
  roomId: undefined,
});

export const createRoomLocalWorkspaceState = (
  roomId: string,
  workspace: WorkspaceState,
  ownerId = "browser",
): RoomLocalWorkspaceState => {
  const files = workspace.files
    .filter((file) => !file.roomId)
    .map(clearFileCollaboration);
  const localFileIds = new Set(files.map((file) => file.id));
  const folders = workspace.folders
    .filter((folder) => folder.id === WORKSPACE_ROOT_FOLDER_ID || !folder.roomId)
    .map(clearFolderCollaboration);

  return {
    schema: ROOM_LOCAL_WORKSPACE_SCHEMA,
    version: ROOM_LOCAL_WORKSPACE_VERSION,
    roomId,
    ownerId,
    savedAt: new Date().toISOString(),
    files,
    folders,
    openFileIds: workspace.openFileIds.filter(
      (fileId, index, fileIds) => fileIds.indexOf(fileId) === index,
    ),
    activeFileId: workspace.activeFileId,
    commentsByFileId: Object.fromEntries(
      Object.entries(workspace.commentsByFileId).filter(([fileId]) => localFileIds.has(fileId)),
    ),
  };
};

export const isRoomLocalWorkspaceState = (
  value: unknown,
  roomId?: string,
  ownerId?: string,
): value is RoomLocalWorkspaceState => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Partial<RoomLocalWorkspaceState>;
  return state.schema === ROOM_LOCAL_WORKSPACE_SCHEMA &&
    state.version === ROOM_LOCAL_WORKSPACE_VERSION &&
    typeof state.roomId === "string" &&
    (!roomId || state.roomId === roomId) &&
    typeof state.ownerId === "string" &&
    state.ownerId.length > 0 &&
    (!ownerId || state.ownerId === ownerId) &&
    typeof state.savedAt === "string" &&
    Array.isArray(state.files) &&
    state.files.every((file) =>
      Boolean(file && typeof file === "object" && typeof file.id === "string" &&
        typeof file.title === "string" && typeof file.text === "string" && !file.roomId && !file.shareUrl),
    ) &&
    Array.isArray(state.folders) &&
    state.folders.every((folder) =>
      Boolean(folder && typeof folder === "object" && typeof folder.id === "string" &&
        typeof folder.title === "string" && !folder.roomId),
    ) &&
    Array.isArray(state.openFileIds) &&
    state.openFileIds.every((fileId) => typeof fileId === "string") &&
    typeof state.activeFileId === "string" &&
    Boolean(state.commentsByFileId && typeof state.commentsByFileId === "object" && !Array.isArray(state.commentsByFileId));
};

export const mergeRoomLocalWorkspaceState = (
  workspace: Pick<WorkspaceState, "activeFileId" | "files" | "folders" | "openFileIds">,
  localState: RoomLocalWorkspaceState,
) => {
  const filesById = new Map(localState.files.map((file) => [file.id, clearFileCollaboration(file)]));
  for (const file of workspace.files) filesById.set(file.id, file);
  const files = [...filesById.values()];

  const foldersById = new Map<string, WorkspaceFolder>([
    [WORKSPACE_ROOT_FOLDER_ID, createWorkspaceRootFolder()],
  ]);
  for (const folder of localState.folders) {
    if (folder.id !== WORKSPACE_ROOT_FOLDER_ID) foldersById.set(folder.id, clearFolderCollaboration(folder));
  }
  for (const folder of workspace.folders) foldersById.set(folder.id, folder);

  return applyRoomLocalViewState({
    ...workspace,
    files,
    folders: [...foldersById.values()],
  }, localState);
};

export const applyRoomLocalViewState = (
  workspace: Pick<WorkspaceState, "activeFileId" | "files" | "folders" | "openFileIds">,
  localState: Pick<RoomLocalWorkspaceState, "activeFileId" | "openFileIds">,
) => {
  const existingFileIds = new Set(workspace.files.map((file) => file.id));
  const openFileIds = localState.openFileIds.filter(
    (fileId, index, preferredFileIds) =>
      preferredFileIds.indexOf(fileId) === index && existingFileIds.has(fileId),
  );
  const activeFileId = existingFileIds.has(localState.activeFileId)
    ? localState.activeFileId
    : openFileIds[0] ?? workspace.activeFileId;

  return {
    ...workspace,
    openFileIds: activeFileId && !openFileIds.includes(activeFileId)
      ? [...openFileIds, activeFileId]
      : openFileIds,
    activeFileId,
  };
};
