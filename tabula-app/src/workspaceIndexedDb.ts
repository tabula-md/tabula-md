import Dexie, { type Table } from "dexie";
import {
  PROJECT_STORAGE_KEY,
  LEGACY_PROJECT_STORAGE_KEY,
  createStoredWorkspace,
  migrateWorkspacePayload,
  type StoredProjectV5,
  type StoredProjectV6,
  type WorkspaceState,
} from "./workspaceStorage";
import {
  isRoomLocalWorkspaceState,
  type RoomLocalWorkspaceState,
} from "./roomLocalWorkspaceState";

export type StoredWorkspaceRecord = {
  key: string;
  payload: StoredProjectV5 | StoredProjectV6;
  savedAt: string;
};

export type WorkspaceRecordStore = {
  get: (key: string) => Promise<StoredWorkspaceRecord | undefined>;
  put: (record: StoredWorkspaceRecord) => Promise<unknown>;
  delete: (key: string) => Promise<unknown>;
};

export type StoredRoomLocalWorkspaceRecord = {
  key: string;
  roomId: string;
  ownerId: string;
  payload: RoomLocalWorkspaceState;
  savedAt: string;
};

export type RoomLocalWorkspaceRecordStore = {
  get: (key: string) => Promise<StoredRoomLocalWorkspaceRecord | undefined>;
  put: (record: StoredRoomLocalWorkspaceRecord) => Promise<unknown>;
  delete: (key: string) => Promise<unknown>;
};

class TabulaWorkspaceDb extends Dexie {
  workspaces!: Table<StoredWorkspaceRecord, string>;
  roomLocalWorkspaces!: Table<StoredRoomLocalWorkspaceRecord, string>;

  constructor() {
    super("tabula-workspace");

    this.version(1).stores({
      workspaces: "key, savedAt",
    });
    this.version(2).stores({
      workspaces: "key, savedAt",
      roomLocalWorkspaces: "roomId, savedAt",
    });
    this.version(3).stores({
      workspaces: "key, savedAt",
      roomLocalWorkspaces: "key, roomId, ownerId, savedAt",
    });
  }
}

export const workspaceIndexedDb = new TabulaWorkspaceDb();

const getWorkspaceStore = (): WorkspaceRecordStore => workspaceIndexedDb.workspaces;
const getRoomLocalWorkspaceStore = (): RoomLocalWorkspaceRecordStore => workspaceIndexedDb.roomLocalWorkspaces;

export const writeIndexedDbWorkspace = async (
  workspace: WorkspaceState,
  store: WorkspaceRecordStore = getWorkspaceStore(),
) => {
  const payload = createStoredWorkspace(workspace);
  await store.put({
    key: PROJECT_STORAGE_KEY,
    payload,
    savedAt: payload.savedAt,
  });
};

export const readIndexedDbWorkspace = async (store: WorkspaceRecordStore = getWorkspaceStore()) => {
  try {
    const record = await store.get(PROJECT_STORAGE_KEY) ?? await store.get(LEGACY_PROJECT_STORAGE_KEY);
    return migrateWorkspacePayload(record?.payload ?? null);
  } catch {
    return null;
  }
};

export const deleteIndexedDbWorkspace = async (store: WorkspaceRecordStore = getWorkspaceStore()) => {
  await store.delete(PROJECT_STORAGE_KEY);
};

export const writeIndexedDbRoomLocalWorkspace = async (
  state: RoomLocalWorkspaceState,
  store: RoomLocalWorkspaceRecordStore = getRoomLocalWorkspaceStore(),
) => {
  await store.put({
    key: `${state.roomId}:${state.ownerId}`,
    roomId: state.roomId,
    ownerId: state.ownerId,
    payload: state,
    savedAt: state.savedAt,
  });
};

export const readIndexedDbRoomLocalWorkspace = async (
  roomId: string,
  ownerId: string,
  store: RoomLocalWorkspaceRecordStore = getRoomLocalWorkspaceStore(),
) => {
  try {
    const payload = (await store.get(`${roomId}:${ownerId}`))?.payload;
    return isRoomLocalWorkspaceState(payload, roomId, ownerId) ? payload : null;
  } catch {
    return null;
  }
};

export const deleteIndexedDbRoomLocalWorkspace = async (
  roomId: string,
  ownerId: string,
  store: RoomLocalWorkspaceRecordStore = getRoomLocalWorkspaceStore(),
) => {
  await store.delete(`${roomId}:${ownerId}`);
};
