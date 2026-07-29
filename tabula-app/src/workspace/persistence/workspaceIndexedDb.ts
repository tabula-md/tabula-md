import Dexie, { type Table } from "dexie";
import type { WorkspaceKnowledgeBaseline } from "@tabula-md/tabula";
import {
  PROJECT_STORAGE_VERSION,
  parseWorkspacePayload,
  serializeFile,
  type FileComment,
  type StoredWorkspaceFile,
  type WorkspaceFile,
  type WorkspaceFolder,
  type WorkspaceState,
} from "../workspaceStorage";
import { migrateWorkspaceStoragePayload } from "../workspaceStorageMigrations";

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

export type WorkspaceKnowledgeBaselineRecord = {
  key: typeof LOCAL_WORKSPACE_KEY;
  payload: WorkspaceKnowledgeBaseline;
};

export type IndexedDbWorkspaceSnapshot = {
  version: number;
  savedAt: string;
  activeFileId: string;
  openFileIds: string[];
  fileOrder: string[];
  folderOrder: string[];
  files: Record<string, unknown>;
  folders: Record<string, unknown>;
  commentsByFileId: Record<string, unknown>;
  knowledgeBaseline?: WorkspaceKnowledgeBaseline;
};

export const parseIndexedDbWorkspaceSnapshot = (
  snapshot: IndexedDbWorkspaceSnapshot,
) => {
  const migration = migrateWorkspaceStoragePayload({
    schema: "tabula.project",
    version: snapshot.version,
    savedAt: snapshot.savedAt,
    activeFileId: snapshot.activeFileId,
    openFileIds: snapshot.openFileIds,
    fileOrder: snapshot.fileOrder,
    folderOrder: snapshot.folderOrder,
    folders: snapshot.folders,
    files: snapshot.files,
    commentsByFileId: snapshot.commentsByFileId,
  }, PROJECT_STORAGE_VERSION);
  const parsedWorkspace = migration.payload
    ? parseWorkspacePayload(migration.payload)
    : null;
  return {
    event: migration.event,
    workspace: parsedWorkspace
      ? {
          ...parsedWorkspace,
          knowledgeBaseline: snapshot.knowledgeBaseline,
        }
      : null,
  };
};

export type WorkspaceWritePlan = {
  manifest: WorkspaceManifestRecord;
  filePuts: WorkspaceFileRecord[];
  fileDeletes: string[];
  folderPuts: WorkspaceFolderRecord[];
  folderDeletes: string[];
  commentPuts: WorkspaceCommentRecord[];
  commentDeletes: string[];
  knowledgeBaselinePut?: WorkspaceKnowledgeBaselineRecord;
  deleteKnowledgeBaseline: boolean;
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
  workspaceKnowledgeBaselines!: Table<WorkspaceKnowledgeBaselineRecord, string>;
  constructor() {
    super(WORKSPACE_DATABASE_NAME);
    this.version(1).stores({
      workspaceManifests: "key",
      workspaceFiles: "id",
      workspaceFolders: "id",
      workspaceComments: "fileId",
    });
    this.version(2).stores({
      workspaceManifests: "key",
      workspaceFiles: "id",
      workspaceFolders: "id",
      workspaceComments: "fileId",
      workspaceKnowledgeBaselines: "key",
    });
  }
}

export const workspaceIndexedDb = new TabulaWorkspaceDb();

const dexieWorkspaceDatabaseAdapter: WorkspaceDatabaseAdapter = {
  readWorkspace: () => workspaceIndexedDb.transaction(
    "rw",
    workspaceIndexedDb.workspaceManifests,
    workspaceIndexedDb.workspaceFiles,
    workspaceIndexedDb.workspaceFolders,
    workspaceIndexedDb.workspaceComments,
    workspaceIndexedDb.workspaceKnowledgeBaselines,
    async () => {
      const manifest = await workspaceIndexedDb.workspaceManifests.get(LOCAL_WORKSPACE_KEY);
      if (!manifest) return null;

      const manifestVersion = Number(manifest.version);
      const fileOrder = Array.isArray(manifest.fileOrder) ? manifest.fileOrder : [];
      const folderOrder = Array.isArray(manifest.folderOrder) ? manifest.folderOrder : [];
      const openFileIds = Array.isArray(manifest.openFileIds) ? manifest.openFileIds : [];
      if (
        !Number.isInteger(manifestVersion) ||
        fileOrder.some((id) => typeof id !== "string") ||
        folderOrder.some((id) => typeof id !== "string") ||
        openFileIds.some((id) => typeof id !== "string")
      ) {
        return null;
      }

      const [fileRecords, folderRecords, commentRecords, knowledgeBaselineRecord] = await Promise.all([
        workspaceIndexedDb.workspaceFiles.bulkGet(fileOrder),
        workspaceIndexedDb.workspaceFolders.bulkGet(folderOrder),
        workspaceIndexedDb.workspaceComments.bulkGet(fileOrder),
        workspaceIndexedDb.workspaceKnowledgeBaselines.get(LOCAL_WORKSPACE_KEY),
      ]);
      const files = Object.fromEntries(
        fileRecords.flatMap((record) => record ? [[record.id, record.payload] as const] : []),
      );
      const folders = Object.fromEntries(
        folderRecords.flatMap((record) => record ? [[record.id, record.payload] as const] : []),
      );
      const commentsByFileId = Object.fromEntries(
        commentRecords.flatMap((record) => record ? [[record.fileId, record.comments] as const] : []),
      );

      const { event, workspace } = parseIndexedDbWorkspaceSnapshot({
        version: manifestVersion,
        savedAt: manifest.savedAt,
        activeFileId: manifest.activeFileId,
        openFileIds,
        fileOrder,
        folderOrder,
        folders,
        files,
        commentsByFileId,
        knowledgeBaseline: knowledgeBaselineRecord?.payload,
      });
      if (!workspace) return null;

      if (event.status === "migrated") {
        const nextFileOrder = workspace.files.map((file) => file.id);
        const nextFolderOrder = workspace.folders.map((folder) => folder.id);
        await workspaceIndexedDb.workspaceFiles.bulkPut(
          workspace.files.map((file) => ({ id: file.id, payload: serializeFile(file) })),
        );
        await workspaceIndexedDb.workspaceFolders.bulkPut(
          workspace.folders.map((folder) => ({ id: folder.id, payload: folder })),
        );
        await workspaceIndexedDb.workspaceManifests.put({
          key: LOCAL_WORKSPACE_KEY,
          version: PROJECT_STORAGE_VERSION,
          savedAt: manifest.savedAt,
          activeFileId: workspace.activeFileId,
          openFileIds: workspace.openFileIds,
          fileOrder: nextFileOrder,
          folderOrder: nextFolderOrder,
        });
      }

      return workspace;
    },
  ),
  writeWorkspace: (plan) => workspaceIndexedDb.transaction(
    "rw",
    workspaceIndexedDb.workspaceManifests,
    workspaceIndexedDb.workspaceFiles,
    workspaceIndexedDb.workspaceFolders,
    workspaceIndexedDb.workspaceComments,
    workspaceIndexedDb.workspaceKnowledgeBaselines,
    async () => {
      if (plan.filePuts.length) await workspaceIndexedDb.workspaceFiles.bulkPut(plan.filePuts);
      if (plan.fileDeletes.length) await workspaceIndexedDb.workspaceFiles.bulkDelete(plan.fileDeletes);
      if (plan.folderPuts.length) await workspaceIndexedDb.workspaceFolders.bulkPut(plan.folderPuts);
      if (plan.folderDeletes.length) await workspaceIndexedDb.workspaceFolders.bulkDelete(plan.folderDeletes);
      if (plan.commentPuts.length) await workspaceIndexedDb.workspaceComments.bulkPut(plan.commentPuts);
      if (plan.commentDeletes.length) await workspaceIndexedDb.workspaceComments.bulkDelete(plan.commentDeletes);
      if (plan.knowledgeBaselinePut) {
        await workspaceIndexedDb.workspaceKnowledgeBaselines.put(plan.knowledgeBaselinePut);
      } else if (plan.deleteKnowledgeBaseline) {
        await workspaceIndexedDb.workspaceKnowledgeBaselines.delete(LOCAL_WORKSPACE_KEY);
      }
      await workspaceIndexedDb.workspaceManifests.put(plan.manifest);
    },
  ),
  deleteWorkspace: () => workspaceIndexedDb.transaction(
    "rw",
    workspaceIndexedDb.workspaceManifests,
    workspaceIndexedDb.workspaceFiles,
    workspaceIndexedDb.workspaceFolders,
    workspaceIndexedDb.workspaceComments,
    workspaceIndexedDb.workspaceKnowledgeBaselines,
    async () => {
      await Promise.all([
        workspaceIndexedDb.workspaceManifests.clear(),
        workspaceIndexedDb.workspaceFiles.clear(),
        workspaceIndexedDb.workspaceFolders.clear(),
        workspaceIndexedDb.workspaceComments.clear(),
        workspaceIndexedDb.workspaceKnowledgeBaselines.clear(),
      ]);
    },
  ),
};

type SourceTracker = {
  fileRefs: Map<string, WorkspaceFile>;
  folderRefs: Map<string, WorkspaceFolder>;
  commentRefs: Map<string, FileComment[]>;
  knowledgeBaseline?: WorkspaceKnowledgeBaseline;
};

const adapterTrackers = new WeakMap<WorkspaceDatabaseAdapter, SourceTracker>();

const createSourceTracker = (
  files: readonly WorkspaceFile[],
  folders: readonly WorkspaceFolder[],
  commentsByFileId: Record<string, FileComment[]>,
  knowledgeBaseline?: WorkspaceKnowledgeBaseline,
): SourceTracker => ({
  fileRefs: new Map(files.map((file) => [file.id, file])),
  folderRefs: new Map(folders.map((folder) => [folder.id, folder])),
  commentRefs: new Map(
    Object.entries(commentsByFileId).filter(([, comments]) => comments.length > 0),
  ),
  knowledgeBaseline,
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
    knowledgeBaselinePut:
      workspace.knowledgeBaseline
      && previous?.knowledgeBaseline !== workspace.knowledgeBaseline
        ? {
            key: LOCAL_WORKSPACE_KEY,
            payload: workspace.knowledgeBaseline,
          }
        : undefined,
    deleteKnowledgeBaseline:
      !workspace.knowledgeBaseline && Boolean(previous?.knowledgeBaseline),
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
    workspace.knowledgeBaseline,
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
      workspace.knowledgeBaseline,
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
