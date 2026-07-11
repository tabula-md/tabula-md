import type { RightPanelView } from "../uiTypes";

export const ROOM_VIEW_STATE_KEY_PREFIX = "tabula.room-view.v1";

export type RoomViewState = {
  activeDocumentId?: string;
  openDocumentIds: string[];
  rightPanelOpen: boolean;
  rightPanelView: RightPanelView;
};

type RoomWorkspaceView = {
  activeFileId: string;
  openFileIds: string[];
  files: readonly { id: string }[];
};

const isRightPanelView = (value: unknown): value is RightPanelView =>
  value === "files" || value === "outline" || value === "comments";

const getStorageKey = (roomId: string) => `${ROOM_VIEW_STATE_KEY_PREFIX}:${roomId}`;

export const parseRoomViewState = (value: unknown): RoomViewState | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<RoomViewState>;
  if (!Array.isArray(candidate.openDocumentIds) || !isRightPanelView(candidate.rightPanelView)) {
    return null;
  }

  return {
    activeDocumentId:
      typeof candidate.activeDocumentId === "string" && candidate.activeDocumentId.trim()
        ? candidate.activeDocumentId
        : undefined,
    openDocumentIds: candidate.openDocumentIds.filter(
      (id, index, ids): id is string => typeof id === "string" && Boolean(id.trim()) && ids.indexOf(id) === index,
    ),
    rightPanelOpen: candidate.rightPanelOpen === true,
    rightPanelView: candidate.rightPanelView,
  };
};

export const readRoomViewState = (
  roomId: string,
  storage: Pick<Storage, "getItem"> = window.sessionStorage,
) => {
  try {
    const value = storage.getItem(getStorageKey(roomId));
    return value ? parseRoomViewState(JSON.parse(value)) : null;
  } catch {
    return null;
  }
};

export const writeRoomViewState = (
  roomId: string,
  viewState: RoomViewState,
  storage: Pick<Storage, "setItem"> = window.sessionStorage,
) => {
  try {
    storage.setItem(getStorageKey(roomId), JSON.stringify(viewState));
  } catch {
    // Room content remains authoritative even when tab-local view state cannot be saved.
  }
};

export const restoreRoomWorkspaceView = <Workspace extends RoomWorkspaceView>(
  workspace: Workspace,
  viewState: RoomViewState | null,
): Workspace => {
  if (!viewState) return workspace;
  const documentIds = new Set(workspace.files.map((file) => file.id));
  const openFileIds = viewState.openDocumentIds.filter((id) => documentIds.has(id));
  const activeFileId = viewState.activeDocumentId && documentIds.has(viewState.activeDocumentId)
    ? viewState.activeDocumentId
    : workspace.activeFileId;
  const nextActiveFileId = documentIds.has(activeFileId)
    ? activeFileId
    : openFileIds[0] ?? workspace.files[0]?.id ?? "";

  return {
    ...workspace,
    activeFileId: nextActiveFileId,
    openFileIds: nextActiveFileId && !openFileIds.includes(nextActiveFileId)
      ? [...openFileIds, nextActiveFileId]
      : openFileIds,
  };
};
