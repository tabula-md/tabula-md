import Dexie, { type Table } from "dexie";
import {
  PROJECT_STORAGE_KEY,
  createStoredWorkspace,
  migrateWorkspacePayload,
  type StoredProjectV5,
  type WorkspaceState,
} from "./workspaceStorage";

export type StoredWorkspaceRecord = {
  key: string;
  payload: StoredProjectV5;
  savedAt: string;
};

export type WorkspaceRecordStore = {
  get: (key: string) => Promise<StoredWorkspaceRecord | undefined>;
  put: (record: StoredWorkspaceRecord) => Promise<unknown>;
  delete: (key: string) => Promise<unknown>;
};

class TabulaWorkspaceDb extends Dexie {
  workspaces!: Table<StoredWorkspaceRecord, string>;

  constructor() {
    super("tabula-workspace");

    this.version(1).stores({
      workspaces: "key, savedAt",
    });
  }
}

export const workspaceIndexedDb = new TabulaWorkspaceDb();

const getWorkspaceStore = (): WorkspaceRecordStore => workspaceIndexedDb.workspaces;

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
    const record = await store.get(PROJECT_STORAGE_KEY);
    return migrateWorkspacePayload(record?.payload ?? null);
  } catch {
    return null;
  }
};

export const deleteIndexedDbWorkspace = async (store: WorkspaceRecordStore = getWorkspaceStore()) => {
  await store.delete(PROJECT_STORAGE_KEY);
};
