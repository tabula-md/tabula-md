import {
  isRoomLocalWorkspaceState,
  type RoomLocalWorkspaceState,
} from "./roomLocalWorkspaceState";

const ROOM_LOCAL_STORAGE_PREFIX = "tabula.room-local.v1:";
const ROOM_LOCAL_STORAGE_INDEX_KEY = "tabula.room-local.index.v1";
const ROOM_LOCAL_STORAGE_MAX_ROOMS = 8;

type RoomLocalFallbackStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const getRoomLocalWorkspaceStorageKey = (roomId: string, ownerId: string) =>
  `${ROOM_LOCAL_STORAGE_PREFIX}${roomId}:${ownerId}`;

export const readRoomLocalWorkspaceFallback = (
  roomId: string,
  ownerId: string,
  storage: Pick<Storage, "getItem"> = window.localStorage,
) => {
  try {
    const raw = storage.getItem(getRoomLocalWorkspaceStorageKey(roomId, ownerId));
    if (!raw) return null;
    const state: unknown = JSON.parse(raw);
    return isRoomLocalWorkspaceState(state, roomId, ownerId) ? state : null;
  } catch {
    return null;
  }
};

export const writeRoomLocalWorkspaceFallback = (
  state: RoomLocalWorkspaceState,
  storage: RoomLocalFallbackStorage = window.localStorage,
) => {
  try {
    storage.setItem(getRoomLocalWorkspaceStorageKey(state.roomId, state.ownerId), JSON.stringify(state));
    const storedIndex = storage.getItem(ROOM_LOCAL_STORAGE_INDEX_KEY);
    const parsedIndex: unknown = storedIndex ? JSON.parse(storedIndex) : [];
    const entries = Array.isArray(parsedIndex)
      ? parsedIndex.filter((entry): entry is { roomId: string; ownerId: string; savedAt: string } =>
          Boolean(entry && typeof entry === "object" && typeof entry.roomId === "string" &&
            typeof entry.ownerId === "string" && typeof entry.savedAt === "string"),
        )
      : [];
    const nextEntries = [
      { roomId: state.roomId, ownerId: state.ownerId, savedAt: state.savedAt },
      ...entries.filter((entry) => entry.roomId !== state.roomId || entry.ownerId !== state.ownerId),
    ].sort((first, second) => second.savedAt.localeCompare(first.savedAt));
    for (const staleEntry of nextEntries.slice(ROOM_LOCAL_STORAGE_MAX_ROOMS)) {
      storage.removeItem(getRoomLocalWorkspaceStorageKey(staleEntry.roomId, staleEntry.ownerId));
    }
    storage.setItem(
      ROOM_LOCAL_STORAGE_INDEX_KEY,
      JSON.stringify(nextEntries.slice(0, ROOM_LOCAL_STORAGE_MAX_ROOMS)),
    );
    return true;
  } catch {
    return false;
  }
};

export const selectLatestRoomLocalWorkspaceState = (
  first: RoomLocalWorkspaceState | null,
  second: RoomLocalWorkspaceState | null,
) => {
  if (!first) return second;
  if (!second) return first;
  return Date.parse(first.savedAt) >= Date.parse(second.savedAt) ? first : second;
};
