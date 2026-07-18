import Dexie, { type Table } from "dexie";
import {
  PROJECT_STORAGE_VERSION,
  finalizeWorkspaceState,
  serializeFile,
  type FileComment,
  type StoredWorkspaceFile,
  type WorkspaceFile,
  type WorkspaceFolder,
  type WorkspaceState,
} from "../workspaceStorage";

const WORKSPACE_DATABASE_NAME = "tabula-workspace-v8";
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

export type WorkspaceWritePlan = {
  manifest: WorkspaceManifestRecord;
  filePuts: WorkspaceFileRecord[];
  fileDeletes: string[];
  folderPuts: WorkspaceFolderRecord[];
  folderDeletes: string[];
  commentPuts: WorkspaceCommentRecord[];
  commentDeletes: string[];
};

export type WorkspaceDatabaseAdapter = {
  readWorkspace: () => Promise<WorkspaceState | null>;
  writeWorkspace: (plan: WorkspaceWritePlan) => Promise<void>;
  deleteWorkspace: () => Promise<void>;
};

class TabulaWorkspaceDb extends Dexie {
  workspaceManifests!: Table<WorkspaceManifestRecord, string>;
  workspaceFiles!: Table<WorkspaceFileRecord, string>;
  workspaceFolders!: Table<WorkspaceFolderRecord, string>;
  workspaceComments!: Table<WorkspaceCommentRecord, string>;
  constructor() {
    super(WORKSPACE_DATABASE_NAME);
    this.version(1).stores({
      workspaceManifests: "key",
      workspaceFiles: "id",
      workspaceFolders: "id",
      workspaceComments: "fileId",
    });
  }
}

export const workspaceIndexedDb = new TabulaWorkspaceDb();

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
};

type SourceTracker = {
  fileRefs: Map<string, WorkspaceFile>;
  folderRefs: Map<string, WorkspaceFolder>;
  commentRefs: Map<string, FileComment[]>;
};

const adapterTrackers = new WeakMap<WorkspaceDatabaseAdapter, SourceTracker>();

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
  const storedFiles = workspace.files;
  const filesById = new Map(storedFiles.map((file) => [file.id, file]));
  const foldersById = new Map(workspace.folders.map((folder) => [folder.id, folder]));
  const fileOrder = storedFiles.map((file) => file.id);
  const folderOrder = workspace.folders.map((folder) => folder.id);
  const fileIds = new Set(fileOrder);
  const folderIds = new Set(folderOrder);
  const commentIds = new Set(
    Object.entries(workspace.commentsByFileId)
      .filter(([fileId, comments]) => fileIds.has(fileId) && comments.length > 0)
      .map(([fileId]) => fileId),
  );
  const activeFileId = fileIds.has(workspace.activeFileId) ? workspace.activeFileId : (fileOrder[0] ?? "");
  const openFileIds = workspace.openFileIds.filter(
    (fileId, index, ids) => fileIds.has(fileId) && ids.indexOf(fileId) === index,
  );

  return {
    manifest: {
      key: LOCAL_WORKSPACE_KEY,
      version: PROJECT_STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      activeFileId,
      openFileIds,
      fileOrder,
      folderOrder,
    },
    filePuts: fileOrder
      .filter((fileId) => previous?.fileRefs.get(fileId) !== filesById.get(fileId))
      .map((fileId) => ({ id: fileId, payload: serializeFile(filesById.get(fileId)!) })),
    fileDeletes: getDeletedIds(previous?.fileRefs.keys() ?? [], fileIds),
    folderPuts: folderOrder
      .filter((folderId) => previous?.folderRefs.get(folderId) !== foldersById.get(folderId))
      .map((folderId) => ({
        id: folderId,
        payload: foldersById.get(folderId)!,
      })),
    folderDeletes: getDeletedIds(previous?.folderRefs.keys() ?? [], folderIds),
    commentPuts: [...commentIds]
      .filter((fileId) => previous?.commentRefs.get(fileId) !== workspace.commentsByFileId[fileId])
      .map((fileId) => ({ fileId, comments: workspace.commentsByFileId[fileId]! })),
    commentDeletes: getDeletedIds(previous?.commentRefs.keys() ?? [], commentIds),
  };
};

export const writeIndexedDbWorkspace = async (
  workspace: WorkspaceState,
  adapter: WorkspaceDatabaseAdapter = dexieWorkspaceDatabaseAdapter,
) => {
  const plan = createWorkspaceWritePlan(workspace, adapterTrackers.get(adapter));
  await adapter.writeWorkspace(plan);
  const storedIds = new Set(plan.manifest.fileOrder);
  const storedCommentsByFileId = Object.fromEntries(
    Object.entries(workspace.commentsByFileId).filter(([fileId]) => storedIds.has(fileId)),
  );
  adapterTrackers.set(adapter, createSourceTracker(
    workspace.files.filter((file) => storedIds.has(file.id)),
    workspace.folders,
    storedCommentsByFileId,
  ));
};

export const readIndexedDbWorkspace = async (
  adapter: WorkspaceDatabaseAdapter = dexieWorkspaceDatabaseAdapter,
) => {
  const workspace = await adapter.readWorkspace();
  if (workspace) {
    adapterTrackers.set(adapter, createSourceTracker(
      workspace.files,
      workspace.folders,
      workspace.commentsByFileId,
    ));
  }
  return workspace;
};

export const deleteIndexedDbWorkspace = async (
  adapter: WorkspaceDatabaseAdapter = dexieWorkspaceDatabaseAdapter,
) => {
  await adapter.deleteWorkspace();
  adapterTrackers.delete(adapter);
};
