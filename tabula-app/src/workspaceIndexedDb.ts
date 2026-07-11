import Dexie, { type Table } from "dexie";
import {
  PROJECT_STORAGE_VERSION,
  createStoredWorkspace,
  finalizeWorkspaceState,
  serializeFile,
  type FileComment,
  type StoredWorkspaceFile,
  type WorkspaceFile,
  type WorkspaceFolder,
  type WorkspaceState,
} from "./workspaceStorage";
import {
  ROOM_LOCAL_WORKSPACE_SCHEMA,
  ROOM_LOCAL_WORKSPACE_VERSION,
  isRoomLocalWorkspaceState,
  type RoomLocalWorkspaceState,
} from "./roomLocalWorkspaceState";

const WORKSPACE_DATABASE_NAME = "tabula-workspace-v7";
const LOCAL_WORKSPACE_KEY = "current";

export type WorkspaceManifestRecord = {
  key: typeof LOCAL_WORKSPACE_KEY;
  version: typeof PROJECT_STORAGE_VERSION;
  savedAt: string;
  activeFileId: string;
  openFileIds: string[];
  fileOrder: string[];
  folderOrder: string[];
};

export type WorkspaceFileRecord = {
  id: string;
  payload: StoredWorkspaceFile;
};

export type WorkspaceFolderRecord = {
  id: string;
  payload: WorkspaceFolder;
};

export type WorkspaceCommentRecord = {
  fileId: string;
  comments: FileComment[];
};

export type RoomLocalManifestRecord = {
  key: string;
  roomId: string;
  ownerId: string;
  savedAt: string;
  activeFileId: string;
  openFileIds: string[];
  fileOrder: string[];
  folderOrder: string[];
};

export type RoomLocalFileRecord = WorkspaceFileRecord & {
  key: string;
  ownerKey: string;
};

export type RoomLocalFolderRecord = WorkspaceFolderRecord & {
  key: string;
  ownerKey: string;
};

export type RoomLocalCommentRecord = WorkspaceCommentRecord & {
  key: string;
  ownerKey: string;
};

export type WorkspaceWritePlan = {
  manifest: WorkspaceManifestRecord;
  filePuts: WorkspaceFileRecord[];
  fileDeletes: string[];
  folderPuts: WorkspaceFolderRecord[];
  folderDeletes: string[];
  commentPuts: WorkspaceCommentRecord[];
  commentDeletes: string[];
};

export type RoomLocalWritePlan = {
  manifest: RoomLocalManifestRecord;
  filePuts: RoomLocalFileRecord[];
  fileDeletes: string[];
  folderPuts: RoomLocalFolderRecord[];
  folderDeletes: string[];
  commentPuts: RoomLocalCommentRecord[];
  commentDeletes: string[];
};

export type WorkspaceDatabaseAdapter = {
  readWorkspace: () => Promise<WorkspaceState | null>;
  writeWorkspace: (plan: WorkspaceWritePlan) => Promise<void>;
  deleteWorkspace: () => Promise<void>;
  readRoomLocalWorkspace: (roomId: string, ownerId: string) => Promise<RoomLocalWorkspaceState | null>;
  writeRoomLocalWorkspace: (plan: RoomLocalWritePlan) => Promise<void>;
  deleteRoomLocalWorkspace: (roomId: string, ownerId: string) => Promise<void>;
};

class TabulaWorkspaceDb extends Dexie {
  workspaceManifests!: Table<WorkspaceManifestRecord, string>;
  workspaceFiles!: Table<WorkspaceFileRecord, string>;
  workspaceFolders!: Table<WorkspaceFolderRecord, string>;
  workspaceComments!: Table<WorkspaceCommentRecord, string>;
  roomLocalManifests!: Table<RoomLocalManifestRecord, string>;
  roomLocalFiles!: Table<RoomLocalFileRecord, string>;
  roomLocalFolders!: Table<RoomLocalFolderRecord, string>;
  roomLocalComments!: Table<RoomLocalCommentRecord, string>;

  constructor() {
    super(WORKSPACE_DATABASE_NAME);
    this.version(1).stores({
      workspaceManifests: "key",
      workspaceFiles: "id",
      workspaceFolders: "id",
      workspaceComments: "fileId",
      roomLocalManifests: "key, roomId, ownerId, savedAt",
      roomLocalFiles: "key, ownerKey, fileId",
      roomLocalFolders: "key, ownerKey, id",
      roomLocalComments: "key, ownerKey, fileId",
    });
  }
}

export const workspaceIndexedDb = new TabulaWorkspaceDb();

const getRoomOwnerKey = (roomId: string, ownerId: string) => `${roomId}:${ownerId}`;
const getRoomRecordKey = (ownerKey: string, recordId: string) => `${ownerKey}:${recordId}`;

const dexieWorkspaceDatabaseAdapter: WorkspaceDatabaseAdapter = {
  readWorkspace: () => workspaceIndexedDb.transaction(
    "r",
    workspaceIndexedDb.workspaceManifests,
    workspaceIndexedDb.workspaceFiles,
    workspaceIndexedDb.workspaceFolders,
    workspaceIndexedDb.workspaceComments,
    async () => {
      const manifest = await workspaceIndexedDb.workspaceManifests.get(LOCAL_WORKSPACE_KEY);
      if (!manifest || manifest.version !== PROJECT_STORAGE_VERSION) return null;

      const [fileRecords, folderRecords, commentRecords] = await Promise.all([
        workspaceIndexedDb.workspaceFiles.bulkGet(manifest.fileOrder),
        workspaceIndexedDb.workspaceFolders.bulkGet(manifest.folderOrder),
        workspaceIndexedDb.workspaceComments.bulkGet(manifest.fileOrder),
      ]);
      const files = fileRecords.flatMap((record) => record ? [record.payload] : []);
      const folders = folderRecords.flatMap((record) => record ? [record.payload] : []);
      const commentsByFileId = Object.fromEntries(
        commentRecords.flatMap((record) => record ? [[record.fileId, record.comments] as const] : []),
      );

      return finalizeWorkspaceState(files, manifest.activeFileId, commentsByFileId, {
        folders,
        includeLocationRoom: false,
        openFileIds: manifest.openFileIds,
      });
    },
  ),
  writeWorkspace: (plan) => workspaceIndexedDb.transaction(
    "rw",
    workspaceIndexedDb.workspaceManifests,
    workspaceIndexedDb.workspaceFiles,
    workspaceIndexedDb.workspaceFolders,
    workspaceIndexedDb.workspaceComments,
    async () => {
      if (plan.filePuts.length) await workspaceIndexedDb.workspaceFiles.bulkPut(plan.filePuts);
      if (plan.fileDeletes.length) await workspaceIndexedDb.workspaceFiles.bulkDelete(plan.fileDeletes);
      if (plan.folderPuts.length) await workspaceIndexedDb.workspaceFolders.bulkPut(plan.folderPuts);
      if (plan.folderDeletes.length) await workspaceIndexedDb.workspaceFolders.bulkDelete(plan.folderDeletes);
      if (plan.commentPuts.length) await workspaceIndexedDb.workspaceComments.bulkPut(plan.commentPuts);
      if (plan.commentDeletes.length) await workspaceIndexedDb.workspaceComments.bulkDelete(plan.commentDeletes);
      await workspaceIndexedDb.workspaceManifests.put(plan.manifest);
    },
  ),
  deleteWorkspace: () => workspaceIndexedDb.transaction(
    "rw",
    workspaceIndexedDb.workspaceManifests,
    workspaceIndexedDb.workspaceFiles,
    workspaceIndexedDb.workspaceFolders,
    workspaceIndexedDb.workspaceComments,
    async () => {
      await Promise.all([
        workspaceIndexedDb.workspaceManifests.clear(),
        workspaceIndexedDb.workspaceFiles.clear(),
        workspaceIndexedDb.workspaceFolders.clear(),
        workspaceIndexedDb.workspaceComments.clear(),
      ]);
    },
  ),
  readRoomLocalWorkspace: (roomId, ownerId) => workspaceIndexedDb.transaction(
    "r",
    workspaceIndexedDb.roomLocalManifests,
    workspaceIndexedDb.roomLocalFiles,
    workspaceIndexedDb.roomLocalFolders,
    workspaceIndexedDb.roomLocalComments,
    async () => {
      const ownerKey = getRoomOwnerKey(roomId, ownerId);
      const manifest = await workspaceIndexedDb.roomLocalManifests.get(ownerKey);
      if (!manifest) return null;
      const [fileRecords, folderRecords, commentRecords] = await Promise.all([
        workspaceIndexedDb.roomLocalFiles.bulkGet(
          manifest.fileOrder.map((fileId) => getRoomRecordKey(ownerKey, fileId)),
        ),
        workspaceIndexedDb.roomLocalFolders.bulkGet(
          manifest.folderOrder.map((folderId) => getRoomRecordKey(ownerKey, folderId)),
        ),
        workspaceIndexedDb.roomLocalComments.bulkGet(
          manifest.fileOrder.map((fileId) => getRoomRecordKey(ownerKey, fileId)),
        ),
      ]);
      const state: RoomLocalWorkspaceState = {
        schema: ROOM_LOCAL_WORKSPACE_SCHEMA,
        version: ROOM_LOCAL_WORKSPACE_VERSION,
        roomId,
        ownerId,
        savedAt: manifest.savedAt,
        activeFileId: manifest.activeFileId,
        openFileIds: manifest.openFileIds,
        files: fileRecords.flatMap((record) => record ? [record.payload] : []),
        folders: folderRecords.flatMap((record) => record ? [record.payload] : []),
        commentsByFileId: Object.fromEntries(
          commentRecords.flatMap((record) => record ? [[record.fileId, record.comments] as const] : []),
        ),
      };
      return isRoomLocalWorkspaceState(state, roomId, ownerId) ? state : null;
    },
  ),
  writeRoomLocalWorkspace: (plan) => workspaceIndexedDb.transaction(
    "rw",
    workspaceIndexedDb.roomLocalManifests,
    workspaceIndexedDb.roomLocalFiles,
    workspaceIndexedDb.roomLocalFolders,
    workspaceIndexedDb.roomLocalComments,
    async () => {
      if (plan.filePuts.length) await workspaceIndexedDb.roomLocalFiles.bulkPut(plan.filePuts);
      if (plan.fileDeletes.length) await workspaceIndexedDb.roomLocalFiles.bulkDelete(plan.fileDeletes);
      if (plan.folderPuts.length) await workspaceIndexedDb.roomLocalFolders.bulkPut(plan.folderPuts);
      if (plan.folderDeletes.length) await workspaceIndexedDb.roomLocalFolders.bulkDelete(plan.folderDeletes);
      if (plan.commentPuts.length) await workspaceIndexedDb.roomLocalComments.bulkPut(plan.commentPuts);
      if (plan.commentDeletes.length) await workspaceIndexedDb.roomLocalComments.bulkDelete(plan.commentDeletes);
      await workspaceIndexedDb.roomLocalManifests.put(plan.manifest);
    },
  ),
  deleteRoomLocalWorkspace: (roomId, ownerId) => workspaceIndexedDb.transaction(
    "rw",
    workspaceIndexedDb.roomLocalManifests,
    workspaceIndexedDb.roomLocalFiles,
    workspaceIndexedDb.roomLocalFolders,
    workspaceIndexedDb.roomLocalComments,
    async () => {
      const ownerKey = getRoomOwnerKey(roomId, ownerId);
      const [fileKeys, folderKeys, commentKeys] = await Promise.all([
        workspaceIndexedDb.roomLocalFiles.where("ownerKey").equals(ownerKey).primaryKeys(),
        workspaceIndexedDb.roomLocalFolders.where("ownerKey").equals(ownerKey).primaryKeys(),
        workspaceIndexedDb.roomLocalComments.where("ownerKey").equals(ownerKey).primaryKeys(),
      ]);
      await Promise.all([
        workspaceIndexedDb.roomLocalManifests.delete(ownerKey),
        workspaceIndexedDb.roomLocalFiles.bulkDelete(fileKeys as string[]),
        workspaceIndexedDb.roomLocalFolders.bulkDelete(folderKeys as string[]),
        workspaceIndexedDb.roomLocalComments.bulkDelete(commentKeys as string[]),
      ]);
    },
  ),
};

type SourceTracker = {
  fileRefs: Map<string, WorkspaceFile>;
  folderRefs: Map<string, WorkspaceFolder>;
  commentRefs: Map<string, FileComment[]>;
};

type AdapterTrackers = {
  local?: SourceTracker;
  rooms: Map<string, SourceTracker>;
};

const adapterTrackers = new WeakMap<WorkspaceDatabaseAdapter, AdapterTrackers>();

const getAdapterTrackers = (adapter: WorkspaceDatabaseAdapter) => {
  const existing = adapterTrackers.get(adapter);
  if (existing) return existing;
  const created: AdapterTrackers = { rooms: new Map() };
  adapterTrackers.set(adapter, created);
  return created;
};

const createSourceTracker = (
  files: readonly WorkspaceFile[],
  folders: readonly WorkspaceFolder[],
  commentsByFileId: Record<string, FileComment[]>,
): SourceTracker => ({
  fileRefs: new Map(files.map((file) => [file.id, file])),
  folderRefs: new Map(folders.map((folder) => [folder.id, folder])),
  commentRefs: new Map(
    Object.entries(commentsByFileId).filter(([, comments]) => comments.length > 0),
  ),
});

const getDeletedIds = (previousIds: Iterable<string>, currentIds: ReadonlySet<string>) =>
  [...previousIds].filter((id) => !currentIds.has(id));

export const createWorkspaceWritePlan = (
  workspace: WorkspaceState,
  previous?: SourceTracker,
): WorkspaceWritePlan => {
  const stored = createStoredWorkspace(workspace);
  const filesById = new Map(workspace.files.map((file) => [file.id, file]));
  const foldersById = new Map(workspace.folders.map((folder) => [folder.id, folder]));
  const fileIds = new Set(stored.fileOrder);
  const folderIds = new Set(stored.folderOrder);
  const commentIds = new Set(
    Object.entries(stored.commentsByFileId).filter(([, comments]) => comments.length > 0).map(([fileId]) => fileId),
  );

  return {
    manifest: {
      key: LOCAL_WORKSPACE_KEY,
      version: PROJECT_STORAGE_VERSION,
      savedAt: stored.savedAt,
      activeFileId: stored.activeFileId,
      openFileIds: stored.openFileIds,
      fileOrder: stored.fileOrder,
      folderOrder: stored.folderOrder,
    },
    filePuts: stored.fileOrder
      .filter((fileId) => previous?.fileRefs.get(fileId) !== filesById.get(fileId))
      .map((fileId) => ({ id: fileId, payload: stored.files[fileId]! })),
    fileDeletes: getDeletedIds(previous?.fileRefs.keys() ?? [], fileIds),
    folderPuts: stored.folderOrder
      .filter((folderId) => previous?.folderRefs.get(folderId) !== foldersById.get(folderId))
      .map((folderId) => ({ id: folderId, payload: stored.folders[folderId]! })),
    folderDeletes: getDeletedIds(previous?.folderRefs.keys() ?? [], folderIds),
    commentPuts: [...commentIds]
      .filter((fileId) => previous?.commentRefs.get(fileId) !== workspace.commentsByFileId[fileId])
      .map((fileId) => ({ fileId, comments: stored.commentsByFileId[fileId]! })),
    commentDeletes: getDeletedIds(previous?.commentRefs.keys() ?? [], commentIds),
  };
};

export const createRoomLocalWritePlan = (
  state: RoomLocalWorkspaceState,
  previous?: SourceTracker,
): RoomLocalWritePlan => {
  const ownerKey = getRoomOwnerKey(state.roomId, state.ownerId);
  const fileIds = new Set(state.files.map((file) => file.id));
  const folderIds = new Set(state.folders.map((folder) => folder.id));
  const commentIds = new Set(
    Object.entries(state.commentsByFileId).filter(([, comments]) => comments.length > 0).map(([fileId]) => fileId),
  );

  return {
    manifest: {
      key: ownerKey,
      roomId: state.roomId,
      ownerId: state.ownerId,
      savedAt: state.savedAt,
      activeFileId: state.activeFileId,
      openFileIds: state.openFileIds,
      fileOrder: state.files.map((file) => file.id),
      folderOrder: state.folders.map((folder) => folder.id),
    },
    filePuts: state.files
      .filter((file) => previous?.fileRefs.get(file.id) !== file)
      .map((file) => ({
        key: getRoomRecordKey(ownerKey, file.id),
        ownerKey,
        id: file.id,
        payload: serializeFile(file),
      })),
    fileDeletes: getDeletedIds(previous?.fileRefs.keys() ?? [], fileIds)
      .map((fileId) => getRoomRecordKey(ownerKey, fileId)),
    folderPuts: state.folders
      .filter((folder) => previous?.folderRefs.get(folder.id) !== folder)
      .map((folder) => ({
        key: getRoomRecordKey(ownerKey, folder.id),
        ownerKey,
        id: folder.id,
        payload: { ...folder, roomId: undefined },
      })),
    folderDeletes: getDeletedIds(previous?.folderRefs.keys() ?? [], folderIds)
      .map((folderId) => getRoomRecordKey(ownerKey, folderId)),
    commentPuts: [...commentIds]
      .filter((fileId) => previous?.commentRefs.get(fileId) !== state.commentsByFileId[fileId])
      .map((fileId) => ({
        key: getRoomRecordKey(ownerKey, fileId),
        ownerKey,
        fileId,
        comments: state.commentsByFileId[fileId]!,
      })),
    commentDeletes: getDeletedIds(previous?.commentRefs.keys() ?? [], commentIds)
      .map((fileId) => getRoomRecordKey(ownerKey, fileId)),
  };
};

export const writeIndexedDbWorkspace = async (
  workspace: WorkspaceState,
  adapter: WorkspaceDatabaseAdapter = dexieWorkspaceDatabaseAdapter,
) => {
  const trackers = getAdapterTrackers(adapter);
  const plan = createWorkspaceWritePlan(workspace, trackers.local);
  await adapter.writeWorkspace(plan);
  const storedIds = new Set(plan.manifest.fileOrder);
  trackers.local = createSourceTracker(
    workspace.files.filter((file) => storedIds.has(file.id)),
    workspace.folders,
    workspace.commentsByFileId,
  );
};

export const readIndexedDbWorkspace = async (
  adapter: WorkspaceDatabaseAdapter = dexieWorkspaceDatabaseAdapter,
) => {
  const workspace = await adapter.readWorkspace();
  if (workspace) {
    getAdapterTrackers(adapter).local = createSourceTracker(
      workspace.files,
      workspace.folders,
      workspace.commentsByFileId,
    );
  }
  return workspace;
};

export const deleteIndexedDbWorkspace = async (
  adapter: WorkspaceDatabaseAdapter = dexieWorkspaceDatabaseAdapter,
) => {
  await adapter.deleteWorkspace();
  getAdapterTrackers(adapter).local = undefined;
};

export const writeIndexedDbRoomLocalWorkspace = async (
  state: RoomLocalWorkspaceState,
  adapter: WorkspaceDatabaseAdapter = dexieWorkspaceDatabaseAdapter,
) => {
  const trackers = getAdapterTrackers(adapter);
  const ownerKey = getRoomOwnerKey(state.roomId, state.ownerId);
  const plan = createRoomLocalWritePlan(state, trackers.rooms.get(ownerKey));
  await adapter.writeRoomLocalWorkspace(plan);
  trackers.rooms.set(ownerKey, createSourceTracker(state.files, state.folders, state.commentsByFileId));
};

export const readIndexedDbRoomLocalWorkspace = async (
  roomId: string,
  ownerId: string,
  adapter: WorkspaceDatabaseAdapter = dexieWorkspaceDatabaseAdapter,
) => {
  const state = await adapter.readRoomLocalWorkspace(roomId, ownerId);
  if (state) {
    getAdapterTrackers(adapter).rooms.set(
      getRoomOwnerKey(roomId, ownerId),
      createSourceTracker(state.files, state.folders, state.commentsByFileId),
    );
  }
  return state;
};

export const deleteIndexedDbRoomLocalWorkspace = async (
  roomId: string,
  ownerId: string,
  adapter: WorkspaceDatabaseAdapter = dexieWorkspaceDatabaseAdapter,
) => {
  await adapter.deleteRoomLocalWorkspace(roomId, ownerId);
  getAdapterTrackers(adapter).rooms.delete(getRoomOwnerKey(roomId, ownerId));
};
