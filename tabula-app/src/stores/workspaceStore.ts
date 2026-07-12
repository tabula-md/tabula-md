import { create } from "zustand";
import {
  addWorkspaceFile,
  closeWorkspaceFile,
  createWorkspaceModelState,
  deleteWorkspaceFile,
  getActiveWorkspaceFile,
  getAvailableWorkspaceFileTitle,
  getOpenWorkspaceFiles,
  renameWorkspaceFile,
  reorderOpenWorkspaceFile,
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
  createRoomWorkspaceState,
  randomId,
  WORKSPACE_ROOT_FOLDER_ID,
  type FileBookmark,
  type LocationRoom,
  type WorkspaceFile,
  type WorkspaceFolder,
} from "../workspaceStorage";
import {
  restoreFileToList,
  restoreOpenFileId,
} from "../workspaceFileRuntimeModel";

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

type CollaborationStatusOptions = {
  requireRoom?: boolean;
};

type RecoveryEventUpdate = {
  type: NonNullable<WorkspaceFile["lastRecoveryType"]>;
  message: string;
  createdAt: string;
};

type WorkspaceStoreState = WorkspaceModelState<WorkspaceFile> & {
  folders: WorkspaceFolder[];
  createFile: (index: number, overrides?: Partial<WorkspaceFile>) => WorkspaceFile;
  initialized: boolean;
  readmeFileId: string;
};

type WorkspaceStoreActions = {
  addFolder: (title?: string, parentId?: string, roomId?: string) => WorkspaceFolder | undefined;
  addFile: (overrides?: Partial<WorkspaceFile>) => WorkspaceFile;
  addFileFromContent: (
    title: string,
    text: string,
    viewMode?: FileViewMode,
    overrides?: Partial<WorkspaceFile>,
  ) => WorkspaceFile;
  activateRoomFile: (room: LocationRoom) => WorkspaceFile | undefined;
  closeFile: (fileId: string) => CloseFileResult | undefined;
  commitActiveFileSplitRatio: (splitRatio: number) => void;
  deleteFile: (fileId: string) => CloseFileResult | undefined;
  duplicateFile: (fileId: string) => WorkspaceFile | undefined;
  initializeWorkspace: (initialization: WorkspaceStoreInitialization) => void;
  moveFile: (fileId: string, direction: -1 | 1) => void;
  renameFile: (fileId: string, nextRawTitle: string) => RenameFileResult;
  reorderFiles: (sourceFileId: string, targetFileId: string) => void;
  replaceWorkspace: (workspace: WorkspaceModelState<WorkspaceFile> & { folders?: WorkspaceFolder[] }) => WorkspaceFile | undefined;
  deleteFolder: (folderId: string) => DeletedWorkspaceFolderBundle | undefined;
  moveFileToFolder: (fileId: string, folderId: string) => boolean;
  moveFolder: (folderId: string, parentId: string) => boolean;
  renameFolder: (folderId: string, title: string) => boolean;
  restoreFile: (input: RestoreFileInput) => WorkspaceFile;
  restoreFolder: (bundle: DeletedWorkspaceFolderBundle) => WorkspaceFile | undefined;
  selectAdjacentFile: (direction: -1 | 1) => WorkspaceFile | undefined;
  selectFile: (fileId: string) => WorkspaceFile | undefined;
  setActiveFileBookmarks: (bookmarks: FileBookmark[]) => void;
  setActiveFileLineNumbers: (lineNumbers: boolean) => void;
  setActiveFileLineWrapping: (lineWrapping: boolean) => void;
  setActiveFileReadingWidth: (readingWidth: ReadingWidth) => void;
  setActiveFileText: (text: string) => void;
  setActiveFileViewMode: (viewMode: FileViewMode) => void;
  setFileCollaborationStatus: (
    fileId: string,
    status: NonNullable<WorkspaceFile["connectionStatus"]>,
    options?: CollaborationStatusOptions,
  ) => void;
  setFileRecoveryEvent: (fileId: string, event: RecoveryEventUpdate) => void;
  setFileText: (fileId: string, text: string) => void;
  setFolderCollaborationRoom: (folderId: string, roomId?: string) => void;
  startFileCollaborationSession: (
    fileId: string,
    roomId: string,
    shareUrl: string,
  ) => WorkspaceFile | undefined;
  stopFileCollaborationSession: (fileId: string) => WorkspaceFile | undefined;
  upsertHelpFile: (helpMarkdown: string) => WorkspaceFile;
};

export type WorkspaceStore = WorkspaceStoreState & WorkspaceStoreActions;

const noopCreateFile = (index: number, overrides: Partial<WorkspaceFile> = {}): WorkspaceFile => ({
  id: overrides.id ?? `workspace-file-${index}`,
  title: overrides.title ?? (index === 1 ? "Untitled.md" : `Untitled ${index}.md`),
  text: overrides.text ?? "",
  parentId: overrides.parentId,
  order: overrides.order,
  viewMode: overrides.viewMode ?? "edit",
  readingWidth: overrides.readingWidth ?? "wide",
  splitRatio: overrides.splitRatio,
  lineWrapping: overrides.lineWrapping ?? true,
  lineNumbers: overrides.lineNumbers ?? true,
  bookmarks: overrides.bookmarks ?? [],
  connectionStatus: overrides.connectionStatus ?? "idle",
  roomId: overrides.roomId,
  shareUrl: overrides.shareUrl,
  lastRecoveryType: overrides.lastRecoveryType,
  lastRecoveryMessage: overrides.lastRecoveryMessage,
  lastRecoveryAt: overrides.lastRecoveryAt,
});

const DEFAULT_WORKSPACE_STORE_STATE: WorkspaceStoreState = {
  activeFileId: "",
  createFile: noopCreateFile,
  files: [],
  folders: [],
  initialized: false,
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

const clearCollaborationFields = (file: WorkspaceFile): WorkspaceFile => ({
  ...file,
  roomId: undefined,
  shareUrl: undefined,
  connectionStatus: "idle",
  lastRecoveryType: undefined,
  lastRecoveryMessage: undefined,
  lastRecoveryAt: undefined,
});

export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => ({
  ...DEFAULT_WORKSPACE_STORE_STATE,

  initializeWorkspace: ({ createFile, folders, readmeFileId, ...workspace }) => {
    set({
      ...createWorkspaceModelState(workspace),
      createFile,
      folders,
      initialized: true,
      readmeFileId,
    });
  },

  replaceWorkspace: (workspace) => {
    const nextWorkspace = createWorkspaceModelState(workspace);
    set((state) => ({
      ...state,
      ...nextWorkspace,
      folders: workspace.folders ?? state.folders,
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

    set((state) => reduceWorkspace(state, { type: "selectFile", fileId }));
    return nextFile;
  },

  addFile: (overrides) => {
    const state = get();
    const parentId = overrides?.parentId ?? state.files.find((file) => file.id === state.activeFileId)?.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
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

  addFileFromContent: (title, text, viewMode = "edit", overrides) => {
    const state = get();
    const parentId = overrides?.parentId ?? state.files.find((file) => file.id === state.activeFileId)?.parentId ?? WORKSPACE_ROOT_FOLDER_ID;
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

  upsertHelpFile: (helpMarkdown) => {
    const existingHelpFile = get().files.find((file) => file.title.trim().toLowerCase() === "help.md");
    if (!existingHelpFile) {
      return get().addFileFromContent("HELP.md", helpMarkdown, "preview");
    }

    const nextFile = {
      ...existingHelpFile,
      title: "HELP.md",
      text: helpMarkdown,
      viewMode: "preview" as const,
    };

    set((state) => ({
      ...state,
      ...createWorkspaceModelState({
        files: state.files.map((file) => (file.id === existingHelpFile.id ? nextFile : file)),
        openFileIds: state.openFileIds,
        activeFileId: existingHelpFile.id,
      }),
    }));

    return nextFile;
  },

  activateRoomFile: (room) => {
    const roomWorkspace = createRoomWorkspaceState(room);
    const nextFile = roomWorkspace.files.find((file) => file.id === roomWorkspace.activeFileId);

    set((state) => ({
      ...state,
      ...createWorkspaceModelState(roomWorkspace),
      folders: roomWorkspace.folders,
    }));

    return nextFile;
  },

  duplicateFile: (fileId) => {
    const state = get();
    const sourceFile = state.files.find((file) => file.id === fileId);
    if (!sourceFile) {
      return undefined;
    }

    const collaborationFields =
      sourceFile.roomId && sourceFile.shareUrl
        ? {
            roomId: sourceFile.roomId,
            shareUrl: sourceFile.shareUrl,
            connectionStatus: sourceFile.connectionStatus ?? "idle",
          }
        : {
            connectionStatus: "idle" as const,
            roomId: undefined,
            shareUrl: undefined,
          };
    const nextFile = state.createFile(getNextUserFileIndex(state.files, state.readmeFileId), {
      title: getAvailableFileTitle(state.files, sourceFile.title, sourceFile.parentId),
      text: sourceFile.text,
      viewMode: sourceFile.viewMode,
      readingWidth: sourceFile.readingWidth,
      lineWrapping: sourceFile.lineWrapping,
      lineNumbers: sourceFile.lineNumbers,
      parentId: sourceFile.parentId,
      ...collaborationFields,
    });

    set((currentState) => ({
      ...currentState,
      ...addWorkspaceFile(getWorkspaceState(currentState), nextFile, { insertAfterFileId: fileId }),
    }));
    return nextFile;
  },

  renameFile: (fileId, nextRawTitle) => {
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
    if (result.ok) {
      set((state) => reduceWorkspace(state, { type: "renameFile", fileId, title: nextRawTitle }));
    }

    return result;
  },

  closeFile: (fileId) => {
    const next = closeWorkspaceFile(getWorkspaceState(get()), fileId);
    if (!next) {
      return undefined;
    }

    set((state) => reduceWorkspace(state, { type: "closeFile", fileId }));
    return next.result;
  },

  deleteFile: (fileId) => {
    const next = deleteWorkspaceFile(getWorkspaceState(get()), fileId);
    if (!next) {
      return undefined;
    }

    set((state) => reduceWorkspace(state, { type: "deleteFile", fileId }));
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

  setFileCollaborationStatus: (fileId, status, options = {}) => {
    set((state) =>
      updateFileInState(state, fileId, (file) => {
        if (options.requireRoom && !file.roomId) {
          return file;
        }

        return {
          ...file,
          connectionStatus: status,
        };
      }),
    );
  },

  setFileRecoveryEvent: (fileId, event) => {
    set((state) =>
      updateFileInState(state, fileId, (file) => ({
        ...file,
        lastRecoveryType: event.type,
        lastRecoveryMessage: event.message,
        lastRecoveryAt: event.createdAt,
      })),
    );
  },

  startFileCollaborationSession: (fileId, roomId, shareUrl) => {
    let nextFile: WorkspaceFile | undefined;

    set((state) =>
      updateFileInState(state, fileId, (file) => {
        nextFile = {
          ...file,
          roomId,
          shareUrl,
          connectionStatus: "connecting",
          lastRecoveryType: undefined,
          lastRecoveryMessage: undefined,
          lastRecoveryAt: undefined,
        };
        return nextFile;
      }),
    );

    return nextFile;
  },

  stopFileCollaborationSession: (fileId) => {
    let nextFile: WorkspaceFile | undefined;

    set((state) =>
      updateFileInState(state, fileId, (file) => {
        nextFile = clearCollaborationFields(file);
        return nextFile;
      }),
    );

    return nextFile;
  },

  addFolder: (title = "New folder", parentId = WORKSPACE_ROOT_FOLDER_ID, roomId) => {
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
      roomId,
    };
    set((current) => ({ ...current, folders: [...current.folders, folder] }));
    return folder;
  },

  setFolderCollaborationRoom: (folderId, roomId) => {
    if (folderId === WORKSPACE_ROOT_FOLDER_ID) return;
    set((current) => ({
      ...current,
      folders: current.folders.map((folder) =>
        folder.id === folderId ? { ...folder, roomId } : folder,
      ),
    }));
  },

  renameFolder: (folderId, title) => {
    const state = get();
    const folder = state.folders.find((candidate) => candidate.id === folderId);
    const normalizedTitle = title.trim().split("\0").join(" ").replace(/[/\\]/g, " ").replace(/\s+/g, " ");
    if (!folder || folder.id === WORKSPACE_ROOT_FOLDER_ID || !normalizedTitle) return false;
    if (state.folders.some((candidate) =>
      candidate.id !== folderId && candidate.parentId === folder.parentId && candidate.title.toLowerCase() === normalizedTitle.toLowerCase()
    )) return false;
    set((current) => ({
      ...current,
      folders: current.folders.map((candidate) => candidate.id === folderId ? { ...candidate, title: normalizedTitle } : candidate),
    }));
    return true;
  },

  moveFileToFolder: (fileId, folderId) => {
    const state = get();
    const file = state.files.find((candidate) => candidate.id === fileId);
    if (!file || !state.folders.some((folder) => folder.id === folderId)) return false;
    if (state.files.some((candidate) =>
      candidate.id !== fileId &&
      (candidate.parentId ?? WORKSPACE_ROOT_FOLDER_ID) === folderId &&
      candidate.title.toLowerCase() === file.title.toLowerCase()
    )) return false;
    set((current) => updateFileInState(current, fileId, (file) => ({ ...file, parentId: folderId })));
    return true;
  },

  moveFolder: (folderId, parentId) => {
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
    set((current) => ({
      ...current,
      folders: current.folders.map((folder) => folder.id === folderId ? { ...folder, parentId } : folder),
    }));
    return true;
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

export const getWorkspaceStoreSnapshot = () => getWorkspaceState(useWorkspaceStore.getState());

export const getWorkspaceStoreOpenFiles = () => getOpenWorkspaceFiles(getWorkspaceStoreSnapshot());

export const getWorkspaceStoreActiveFile = () => getActiveWorkspaceFile(getWorkspaceStoreSnapshot());

export const resetWorkspaceStoreForTests = () => {
  useWorkspaceStore.setState(DEFAULT_WORKSPACE_STORE_STATE);
};
