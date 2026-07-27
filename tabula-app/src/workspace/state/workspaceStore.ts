import { create } from "zustand";
import {
  addWorkspaceFile,
  closeAllWorkspaceFiles,
  closeOtherWorkspaceFiles,
  closeWorkspaceFile,
  createWorkspaceModelState,
  deleteWorkspaceFile,
  getActiveWorkspaceFile,
  getAvailableWorkspaceFileTitle,
  getFileEditingMode,
  getOpenWorkspaceFiles,
  renameWorkspaceFile,
  reorderOpenWorkspaceFile,
  reopenWorkspaceFile,
  selectAdjacentWorkspaceFile,
  selectWorkspaceFile,
  WORKSPACE_ROOM_MAX_TREE_DEPTH,
  workspaceReducer,
  type CloseFileResult,
  type FileViewMode,
  type ReadingWidth,
  type RenameFileResult,
  type WorkspaceModelAction,
  type WorkspaceModelState,
} from "@tabula-md/tabula";
import {
  normalizeWorkspaceName,
  randomId,
  WORKSPACE_ROOT_FOLDER_ID,
  type FileBookmark,
  type WorkspaceFile,
  type WorkspaceFolder,
} from "../workspaceStorage";
import {
  restoreFileToList,
  restoreOpenFileId,
} from "@tabula-md/tabula";
import { maintainWorkspaceKnowledgePaths } from "../workspaceKnowledgeModel";

type WorkspaceStoreInitialization = WorkspaceModelState<WorkspaceFile> & {
  folders: WorkspaceFolder[];
  createFile: (index: number, overrides?: Partial<WorkspaceFile>) => WorkspaceFile;
  readmeFileId: string;
};

type RestoreFileInput = {
  file: WorkspaceFile;
  fileIndex: number;
  previousOpenFileIds: string[];
  activate: boolean;
};

type IndexedWorkspaceItem<Item> = {
  index: number;
  item: Item;
};

export type DeletedWorkspaceFolderBundle = {
  files: IndexedWorkspaceItem<WorkspaceFile>[];
  folders: IndexedWorkspaceItem<WorkspaceFolder>[];
  previousActiveFileId: string;
  previousOpenFileIds: string[];
};

type WorkspaceStoreState = WorkspaceModelState<WorkspaceFile> & {
  folders: WorkspaceFolder[];
  createFile: (index: number, overrides?: Partial<WorkspaceFile>) => WorkspaceFile;
  initialized: boolean;
  lastClosedTab: {
    fileId: string;
    openIndex: number;
  } | null;
  readmeFileId: string;
};

type WorkspaceStoreActions = {
  addFolder: (title?: string, parentId?: string) => WorkspaceFolder | undefined;
  addFile: (overrides?: Partial<WorkspaceFile>) => WorkspaceFile;
  addFileFromContent: (
    title: string,
    text: string,
    viewMode?: FileViewMode,
    overrides?: Partial<WorkspaceFile>,
  ) => WorkspaceFile;
  closeAllFiles: () => void;
  closeOtherFiles: () => void;
  closeFile: (fileId: string) => CloseFileResult | undefined;
  commitActiveFileSplitRatio: (splitRatio: number) => void;
  deleteFile: (fileId: string) => CloseFileResult | undefined;
  duplicateFile: (fileId: string) => WorkspaceFile | undefined;
  initializeWorkspace: (initialization: WorkspaceStoreInitialization) => void;
  moveFile: (fileId: string, direction: -1 | 1) => void;
  renameFile: (fileId: string, nextRawTitle: string) => Promise<RenameFileResult>;
  reorderFiles: (sourceFileId: string, targetFileId: string) => void;
  replaceWorkspace: (workspace: WorkspaceModelState<WorkspaceFile> & { folders?: WorkspaceFolder[] }) => WorkspaceFile | undefined;
  deleteFolder: (folderId: string) => DeletedWorkspaceFolderBundle | undefined;
  moveFileToFolder: (fileId: string, folderId: string) => Promise<boolean>;
  moveFolder: (folderId: string, parentId: string) => Promise<boolean>;
  renameFolder: (folderId: string, title: string) => Promise<boolean>;
  renameWorkspace: (title: string) => boolean;
  restoreFile: (input: RestoreFileInput) => WorkspaceFile;
  restoreFolder: (bundle: DeletedWorkspaceFolderBundle) => WorkspaceFile | undefined;
  reopenLastClosedFile: () => WorkspaceFile | undefined;
  selectAdjacentFile: (direction: -1 | 1) => WorkspaceFile | undefined;
  selectFile: (fileId: string) => WorkspaceFile | undefined;
  setActiveFileBookmarks: (bookmarks: FileBookmark[]) => void;
  setActiveFileLineNumbers: (lineNumbers: boolean) => void;
  setActiveFileLineWrapping: (lineWrapping: boolean) => void;
  setActiveFileReadingWidth: (readingWidth: ReadingWidth) => void;
  setActiveFileText: (text: string) => void;
  setActiveFileViewMode: (viewMode: FileViewMode) => void;
  setFileText: (fileId: string, text: string) => void;
};

export type WorkspaceStore = WorkspaceStoreState & WorkspaceStoreActions;

const noopCreateFile = (index: number, overrides: Partial<WorkspaceFile> = {}): WorkspaceFile => ({
  id: overrides.id ?? `workspace-file-${index}`,
  title: overrides.title ?? (index === 1 ? "Untitled.md" : `Untitled ${index}.md`),
  text: overrides.text ?? "",
  parentId: overrides.parentId,
  order: overrides.order,
  viewMode: overrides.viewMode ?? "visual",
  editingMode:
    overrides.editingMode ??
    getFileEditingMode({ viewMode: overrides.viewMode ?? "visual" }),
  readingWidth: overrides.readingWidth ?? "wide",
  splitRatio: overrides.splitRatio,
  lineWrapping: overrides.lineWrapping ?? true,
  lineNumbers: overrides.lineNumbers ?? true,
  bookmarks: overrides.bookmarks ?? [],
});

const DEFAULT_WORKSPACE_STORE_STATE: WorkspaceStoreState = {
  activeFileId: "",
  createFile: noopCreateFile,
  files: [],
  folders: [],
  initialized: false,
  lastClosedTab: null,
  openFileIds: [],
  readmeFileId: "",
};

const getWorkspaceState = (state: WorkspaceStoreState): WorkspaceModelState<WorkspaceFile> => ({
  files: state.files,
  openFileIds: state.openFileIds,
  activeFileId: state.activeFileId,
});

const getNextUserFileIndex = (files: WorkspaceFile[], readmeFileId: string) =>
  files.filter((file) => file.id !== readmeFileId).length + 1;

const getAvailableFileTitle = (files: WorkspaceFile[], baseTitle: string, parentId?: string | null) =>
  getAvailableWorkspaceFileTitle(
    files.filter((file) => (file.parentId ?? WORKSPACE_ROOT_FOLDER_ID) === (parentId ?? WORKSPACE_ROOT_FOLDER_ID)),
    baseTitle,
  );

const getAvailableFolderTitle = (folders: WorkspaceFolder[], baseTitle: string, parentId: string) => {
  const normalizedBase = baseTitle.trim().split("\0").join(" ").replace(/[/\\]/g, " ").replace(/\s+/g, " ") || "New folder";
  const titles = new Set(
    folders.filter((folder) => folder.parentId === parentId).map((folder) => folder.title.toLowerCase()),
  );
  if (!titles.has(normalizedBase.toLowerCase())) return normalizedBase;
  let index = 2;
  while (titles.has(`${normalizedBase} ${index}`.toLowerCase())) index += 1;
  return `${normalizedBase} ${index}`;
};

const getFolderDescendantIds = (folders: WorkspaceFolder[], folderId: string) => {
  const ids = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (!ids.has(folder.id) && folder.parentId && ids.has(folder.parentId)) {
        ids.add(folder.id);
        changed = true;
      }
    }
  }
  return ids;
};

const getFolderDepth = (folders: WorkspaceFolder[], folderId: string) => {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const visited = new Set<string>();
  let currentId: string | null = folderId;
  let depth = 0;
  while (currentId && currentId !== WORKSPACE_ROOT_FOLDER_ID) {
    if (visited.has(currentId)) return Number.POSITIVE_INFINITY;
    visited.add(currentId);
    currentId = foldersById.get(currentId)?.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
    depth += 1;
  }
  return depth;
};

const getFolderSubtreeHeight = (folders: WorkspaceFolder[], folderId: string) => {
  const descendants = getFolderDescendantIds(folders, folderId);
  let maxHeight = 0;
  for (const descendantId of descendants) {
    let height = 0;
    let current = folders.find((folder) => folder.id === descendantId);
    while (current && current.id !== folderId) {
      height += 1;
      current = folders.find((folder) => folder.id === current?.parentId);
    }
    maxHeight = Math.max(maxHeight, height);
  }
  return maxHeight;
};

const restoreIndexedWorkspaceItems = <Item extends { id: string }>(
  currentItems: readonly Item[],
  restoredItems: readonly IndexedWorkspaceItem<Item>[],
) => {
  const nextItems = [...currentItems];
  for (const { index, item } of [...restoredItems].sort((first, second) => first.index - second.index)) {
    if (nextItems.some((candidate) => candidate.id === item.id)) continue;
    nextItems.splice(Math.min(Math.max(0, index), nextItems.length), 0, item);
  }
  return nextItems;
};

const reduceWorkspace = (
  state: WorkspaceStoreState,
  action: WorkspaceModelAction<WorkspaceFile>,
): WorkspaceStoreState => ({
  ...state,
  ...workspaceReducer(getWorkspaceState(state), action),
});

const updateFileInState = (
  state: WorkspaceStoreState,
  fileId: string,
  updateFile: (file: WorkspaceFile) => WorkspaceFile,
) => {
  if (!state.files.some((file) => file.id === fileId)) {
    return state;
  }

  return {
    ...state,
    files: state.files.map((file) => (file.id === fileId ? updateFile(file) : file)),
  };
};

export const createWorkspaceStore = () => create<WorkspaceStore>()((set, get) => ({
  ...DEFAULT_WORKSPACE_STORE_STATE,

  initializeWorkspace: ({ createFile, folders, readmeFileId, ...workspace }) => {
    set({
      ...createWorkspaceModelState(workspace),
      createFile,
      folders,
      initialized: true,
      lastClosedTab: null,
      readmeFileId,
    });
  },

  replaceWorkspace: (workspace) => {
    const nextWorkspace = createWorkspaceModelState(workspace);
    set((state) => ({
      ...state,
      ...nextWorkspace,
      folders: workspace.folders ?? state.folders,
      lastClosedTab: null,
    }));

    return getActiveWorkspaceFile(nextWorkspace);
  },

  selectFile: (fileId) => {
    const workspace = getWorkspaceState(get());
    const nextWorkspace = selectWorkspaceFile(workspace, fileId);
    const nextFile = nextWorkspace.files.find((file) => file.id === fileId);
    if (!nextFile) {
      return undefined;
    }

    set((state) => ({
      ...reduceWorkspace(state, { type: "selectFile", fileId }),
      lastClosedTab: state.lastClosedTab?.fileId === fileId ? null : state.lastClosedTab,
    }));
    return nextFile;
  },

  addFile: (overrides) => {
    const state = get();
    const parentId = overrides?.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
    const requestedTitle = overrides?.title?.trim();
    const nextFile = state.createFile(getNextUserFileIndex(state.files, state.readmeFileId), {
      ...overrides,
      parentId,
      title: getAvailableFileTitle(state.files, requestedTitle || "Untitled.md", parentId),
    });
    set((currentState) => ({
      ...currentState,
      ...addWorkspaceFile(getWorkspaceState(currentState), nextFile),
    }));
    return nextFile;
  },

  addFileFromContent: (title, text, viewMode = "visual", overrides) => {
    const state = get();
    const parentId = overrides?.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
    const nextFile = state.createFile(getNextUserFileIndex(state.files, state.readmeFileId), {
      ...overrides,
      parentId,
      title: getAvailableFileTitle(state.files, title, parentId),
      text,
      viewMode: overrides?.viewMode ?? viewMode,
    });
    set((currentState) => ({
      ...currentState,
      ...addWorkspaceFile(getWorkspaceState(currentState), nextFile),
    }));
    return nextFile;
  },


  duplicateFile: (fileId) => {
    const state = get();
    const sourceFile = state.files.find((file) => file.id === fileId);
    if (!sourceFile) {
      return undefined;
    }

    const nextFile = state.createFile(getNextUserFileIndex(state.files, state.readmeFileId), {
      title: getAvailableFileTitle(state.files, sourceFile.title, sourceFile.parentId),
      text: sourceFile.text,
      viewMode: sourceFile.viewMode,
      editingMode: getFileEditingMode(sourceFile),
      readingWidth: sourceFile.readingWidth,
      lineWrapping: sourceFile.lineWrapping,
      lineNumbers: sourceFile.lineNumbers,
      parentId: sourceFile.parentId,
    });

    set((currentState) => ({
      ...currentState,
      ...addWorkspaceFile(getWorkspaceState(currentState), nextFile, { insertAfterFileId: fileId }),
    }));
    return nextFile;
  },

  renameFile: async (fileId, nextRawTitle) => {
    while (true) {
      const state = get();
      const file = state.files.find((candidate) => candidate.id === fileId);
      const siblingState = {
        ...getWorkspaceState(state),
        files: state.files.filter(
          (candidate) =>
            candidate.id === fileId ||
            (candidate.parentId ?? WORKSPACE_ROOT_FOLDER_ID) ===
              (file?.parentId ?? WORKSPACE_ROOT_FOLDER_ID),
        ),
      };
      const { result } = renameWorkspaceFile(siblingState, fileId, nextRawTitle);
      if (!result.ok) return result;

      const maintained = await maintainWorkspaceKnowledgePaths(
        state,
        reduceWorkspace(state, { type: "renameFile", fileId, title: nextRawTitle }),
      );
      const latest = get();
      if (latest.files !== state.files || latest.folders !== state.folders) {
        continue;
      }
      set((current) => ({
        ...current,
        files: maintained.state.files,
        folders: maintained.state.folders,
      }));
      return result;
    }
  },

  closeFile: (fileId) => {
    const currentState = get();
    const openIndex = currentState.openFileIds.indexOf(fileId);
    const next = closeWorkspaceFile(getWorkspaceState(currentState), fileId);
    if (!next) {
      return undefined;
    }

    set((state) => ({
      ...state,
      ...next.state,
      lastClosedTab: { fileId, openIndex },
    }));
    return next.result;
  },

  closeAllFiles: () => {
    const state = get();
    const fileId =
      (state.openFileIds.includes(state.activeFileId) && state.activeFileId) ||
      state.openFileIds.at(-1);
    if (!fileId) {
      return;
    }

    set((state) => ({
      ...state,
      ...closeAllWorkspaceFiles(getWorkspaceState(state)),
      lastClosedTab: {
        fileId,
        openIndex: state.openFileIds.indexOf(fileId),
      },
    }));
  },

  closeOtherFiles: () => {
    const state = get();
    if (!state.activeFileId || state.openFileIds.length <= 1) {
      return;
    }

    const lastClosedFileId = state.openFileIds
      .filter((fileId) => fileId !== state.activeFileId)
      .at(-1);
    if (!lastClosedFileId) {
      return;
    }
    const activeOpenIndex = state.openFileIds.indexOf(state.activeFileId);
    const lastClosedOpenIndex = state.openFileIds.indexOf(lastClosedFileId);

    set((currentState) => ({
      ...currentState,
      ...closeOtherWorkspaceFiles(
        getWorkspaceState(currentState),
        currentState.activeFileId,
      ),
      lastClosedTab: {
        fileId: lastClosedFileId,
        openIndex: lastClosedOpenIndex < activeOpenIndex ? 0 : 1,
      },
    }));
  },

  reopenLastClosedFile: () => {
    const state = get();
    const closedTab = state.lastClosedTab;
    if (!closedTab) {
      return undefined;
    }

    const file = state.files.find((candidate) => candidate.id === closedTab.fileId);
    if (!file) {
      set({ lastClosedTab: null });
      return undefined;
    }

    set((currentState) => ({
      ...currentState,
      ...reopenWorkspaceFile(
        getWorkspaceState(currentState),
        closedTab.fileId,
        closedTab.openIndex,
      ),
      lastClosedTab: null,
    }));
    return file;
  },

  deleteFile: (fileId) => {
    const next = deleteWorkspaceFile(getWorkspaceState(get()), fileId);
    if (!next) {
      return undefined;
    }

    set((state) => ({
      ...reduceWorkspace(state, { type: "deleteFile", fileId }),
      lastClosedTab: state.lastClosedTab?.fileId === fileId ? null : state.lastClosedTab,
    }));
    return next.result;
  },

  restoreFile: ({ file, fileIndex, previousOpenFileIds, activate }) => {
    set((state) => ({
      ...state,
      ...createWorkspaceModelState({
        files: restoreFileToList(state.files, file, fileIndex),
        openFileIds: restoreOpenFileId(state.openFileIds, file.id, previousOpenFileIds),
        activeFileId: activate ? file.id : state.activeFileId,
      }),
    }));

    return file;
  },

  reorderFiles: (sourceFileId, targetFileId) => {
    const workspace = getWorkspaceState(get());
    if (reorderOpenWorkspaceFile(workspace, sourceFileId, targetFileId) === workspace) {
      return;
    }

    set((state) => reduceWorkspace(state, { type: "reorderOpenFile", sourceFileId, targetFileId }));
  },

  moveFile: (fileId, direction) => {
    const { openFileIds } = get();
    const currentIndex = openFileIds.indexOf(fileId);
    const targetFileId = openFileIds[currentIndex + direction];

    if (!targetFileId) {
      return;
    }

    get().reorderFiles(fileId, targetFileId);
  },

  selectAdjacentFile: (direction) => {
    const next = selectAdjacentWorkspaceFile(getWorkspaceState(get()), direction);
    if (!next.file) {
      return undefined;
    }

    set((state) => reduceWorkspace(state, { type: "selectFile", fileId: next.file!.id }));
    return next.file;
  },

  setActiveFileText: (text) => {
    set((state) => reduceWorkspace(state, { type: "setActiveFileText", text }));
  },

  setFileText: (fileId, text) => {
    set((state) =>
      updateFileInState(state, fileId, (file) => ({
        ...file,
        text,
      })),
    );
  },

  setActiveFileBookmarks: (bookmarks) => {
    set((state) => updateFileInState(state, state.activeFileId, (file) => ({ ...file, bookmarks })));
  },

  setActiveFileViewMode: (viewMode) => {
    set((state) => reduceWorkspace(state, { type: "setActiveFileViewMode", viewMode }));
  },

  setActiveFileReadingWidth: (readingWidth) => {
    set((state) => reduceWorkspace(state, { type: "setActiveFileReadingWidth", readingWidth }));
  },

  setActiveFileLineWrapping: (lineWrapping) => {
    set((state) => reduceWorkspace(state, { type: "setActiveFileLineWrapping", lineWrapping }));
  },

  setActiveFileLineNumbers: (lineNumbers) => {
    set((state) => reduceWorkspace(state, { type: "setActiveFileLineNumbers", lineNumbers }));
  },

  commitActiveFileSplitRatio: (splitRatio) => {
    set((state) => reduceWorkspace(state, { type: "setActiveFileSplitRatio", splitRatio }));
  },

  addFolder: (title = "New folder", parentId = WORKSPACE_ROOT_FOLDER_ID) => {
    const state = get();
    const validParentId = state.folders.some((folder) => folder.id === parentId)
      ? parentId
      : WORKSPACE_ROOT_FOLDER_ID;
    if (getFolderDepth(state.folders, validParentId) >= WORKSPACE_ROOM_MAX_TREE_DEPTH) {
      return undefined;
    }
    const folder: WorkspaceFolder = {
      id: randomId(),
      title: getAvailableFolderTitle(state.folders, title, validParentId),
      parentId: validParentId,
      order: state.folders.filter((candidate) => candidate.parentId === validParentId).length,
    };
    set((current) => ({ ...current, folders: [...current.folders, folder] }));
    return folder;
  },

  renameFolder: async (folderId, title) => {
    while (true) {
      const state = get();
      const folder = state.folders.find((candidate) => candidate.id === folderId);
      const normalizedTitle = title.trim().split("\0").join(" ").replace(/[/\\]/g, " ").replace(/\s+/g, " ");
      if (!folder || folder.id === WORKSPACE_ROOT_FOLDER_ID || !normalizedTitle) return false;
      if (state.folders.some((candidate) =>
        candidate.id !== folderId && candidate.parentId === folder.parentId && candidate.title.toLowerCase() === normalizedTitle.toLowerCase()
      )) return false;
      const maintained = await maintainWorkspaceKnowledgePaths(state, {
        ...state,
        folders: state.folders.map((candidate) =>
          candidate.id === folderId ? { ...candidate, title: normalizedTitle } : candidate
        ),
      });
      const latest = get();
      if (latest.files !== state.files || latest.folders !== state.folders) continue;
      set((current) => ({
        ...current,
        files: maintained.state.files,
        folders: maintained.state.folders,
      }));
      return true;
    }
  },

  renameWorkspace: (title) => {
    const state = get();
    const root = state.folders.find((folder) => folder.id === WORKSPACE_ROOT_FOLDER_ID);
    const normalizedTitle = normalizeWorkspaceName(title, "");
    if (!root || !normalizedTitle) return false;
    if (root.title === normalizedTitle) return true;
    set((current) => ({
      ...current,
      folders: current.folders.map((folder) =>
        folder.id === WORKSPACE_ROOT_FOLDER_ID
          ? { ...folder, title: normalizedTitle }
          : folder,
      ),
    }));
    return true;
  },

  moveFileToFolder: async (fileId, folderId) => {
    while (true) {
      const state = get();
      const file = state.files.find((candidate) => candidate.id === fileId);
      if (!file || !state.folders.some((folder) => folder.id === folderId)) return false;
      if (state.files.some((candidate) =>
        candidate.id !== fileId &&
        (candidate.parentId ?? WORKSPACE_ROOT_FOLDER_ID) === folderId &&
        candidate.title.toLowerCase() === file.title.toLowerCase()
      )) return false;
      const maintained = await maintainWorkspaceKnowledgePaths(
        state,
        updateFileInState(state, fileId, (file) => ({ ...file, parentId: folderId })),
      );
      const latest = get();
      if (latest.files !== state.files || latest.folders !== state.folders) continue;
      set((current) => ({
        ...current,
        files: maintained.state.files,
        folders: maintained.state.folders,
      }));
      return true;
    }
  },

  moveFolder: async (folderId, parentId) => {
    while (true) {
      const state = get();
      const movingFolder = state.folders.find((folder) => folder.id === folderId);
      if (!movingFolder || folderId === WORKSPACE_ROOT_FOLDER_ID || !state.folders.some((folder) => folder.id === parentId)) return false;
      if (getFolderDescendantIds(state.folders, folderId).has(parentId)) return false;
      if (getFolderDepth(state.folders, parentId) + 1 + getFolderSubtreeHeight(state.folders, folderId) > WORKSPACE_ROOM_MAX_TREE_DEPTH) return false;
      if (state.folders.some((folder) =>
        folder.id !== folderId &&
        folder.parentId === parentId &&
        folder.title.toLowerCase() === movingFolder.title.toLowerCase()
      )) return false;
      const maintained = await maintainWorkspaceKnowledgePaths(state, {
        ...state,
        folders: state.folders.map((folder) =>
          folder.id === folderId ? { ...folder, parentId } : folder
        ),
      });
      const latest = get();
      if (latest.files !== state.files || latest.folders !== state.folders) continue;
      set((current) => ({
        ...current,
        files: maintained.state.files,
        folders: maintained.state.folders,
      }));
      return true;
    }
  },

  deleteFolder: (folderId) => {
    if (folderId === WORKSPACE_ROOT_FOLDER_ID) return undefined;
    const state = get();
    if (!state.folders.some((folder) => folder.id === folderId)) return undefined;
    const deletedFolderIds = getFolderDescendantIds(state.folders, folderId);
    const deletedFileIds = new Set(state.files.filter((file) => deletedFolderIds.has(file.parentId ?? WORKSPACE_ROOT_FOLDER_ID)).map((file) => file.id));
    const bundle: DeletedWorkspaceFolderBundle = {
      folders: state.folders.flatMap((folder, index) =>
        deletedFolderIds.has(folder.id) ? [{ index, item: folder }] : [],
      ),
      files: state.files.flatMap((file, index) =>
        deletedFileIds.has(file.id) ? [{ index, item: file }] : [],
      ),
      previousOpenFileIds: [...state.openFileIds],
      previousActiveFileId: state.activeFileId,
    };
    const files = state.files.filter((file) => !deletedFileIds.has(file.id));
    const openFileIds = state.openFileIds.filter((fileId) => !deletedFileIds.has(fileId));
    const activeFileId = deletedFileIds.has(state.activeFileId) ? (openFileIds[0] ?? files[0]?.id ?? "") : state.activeFileId;
    set((current) => ({
      ...current,
      folders: current.folders.filter((folder) => !deletedFolderIds.has(folder.id)),
      files,
      openFileIds,
      activeFileId,
      lastClosedTab:
        current.lastClosedTab && deletedFileIds.has(current.lastClosedTab.fileId)
          ? null
          : current.lastClosedTab,
    }));
    return bundle;
  },

  restoreFolder: (bundle) => {
    const state = get();
    const folders = restoreIndexedWorkspaceItems(state.folders, bundle.folders);
    const files = restoreIndexedWorkspaceItems(state.files, bundle.files);
    const fileIds = new Set(files.map((file) => file.id));
    const previousOpenFileIds = bundle.previousOpenFileIds.filter((fileId) => fileIds.has(fileId));
    const openFileIds = [
      ...previousOpenFileIds,
      ...state.openFileIds.filter((fileId) => fileIds.has(fileId) && !previousOpenFileIds.includes(fileId)),
    ];
    const activeFileId = fileIds.has(bundle.previousActiveFileId)
      ? bundle.previousActiveFileId
      : state.activeFileId && fileIds.has(state.activeFileId)
        ? state.activeFileId
        : openFileIds[0] ?? files[0]?.id ?? "";
    set((current) => ({ ...current, folders, files, openFileIds, activeFileId }));
    return files.find((file) => file.id === activeFileId);
  },
}));

export const useWorkspaceStore = createWorkspaceStore();
export const useRoomWorkspaceStore = createWorkspaceStore();
export type WorkspaceStoreBinding = ReturnType<typeof createWorkspaceStore>;

export const getWorkspaceStoreForMode = (mode: "local" | "room") =>
  mode === "room" ? useRoomWorkspaceStore : useWorkspaceStore;

export const getWorkspaceStoreSnapshot = (mode: "local" | "room" = "local") =>
  getWorkspaceState(getWorkspaceStoreForMode(mode).getState());

export const getWorkspaceStoreOpenFiles = (mode: "local" | "room" = "local") =>
  getOpenWorkspaceFiles(getWorkspaceStoreSnapshot(mode));

export const getWorkspaceStoreActiveFile = (mode: "local" | "room" = "local") =>
  getActiveWorkspaceFile(getWorkspaceStoreSnapshot(mode));

export const getWorkspaceStoreFolder = (folderId: string, mode: "local" | "room" = "local") =>
  getWorkspaceStoreForMode(mode).getState().folders.find((folder) => folder.id === folderId);

export const resetWorkspaceStoreForTests = () => {
  useWorkspaceStore.setState(DEFAULT_WORKSPACE_STORE_STATE);
  useRoomWorkspaceStore.setState(DEFAULT_WORKSPACE_STORE_STATE);
};
