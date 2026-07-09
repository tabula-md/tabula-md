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
  type FileBookmark,
  type LocationRoom,
  type WorkspaceFile,
} from "../workspaceStorage";
import {
  restoreFileToList,
  restoreOpenFileId,
} from "../workspaceFileRuntimeModel";

type WorkspaceStoreInitialization = WorkspaceModelState<WorkspaceFile> & {
  createFile: (index: number, overrides?: Partial<WorkspaceFile>) => WorkspaceFile;
  readmeFileId: string;
};

type RestoreFileInput = {
  file: WorkspaceFile;
  fileIndex: number;
  previousOpenFileIds: string[];
  activate: boolean;
};

type CollaborationStatusOptions = {
  collaboratorCount?: number;
  requireRoom?: boolean;
};

type RecoveryEventUpdate = {
  type: NonNullable<WorkspaceFile["lastRecoveryType"]>;
  message: string;
  createdAt: string;
};

type WorkspaceStoreState = WorkspaceModelState<WorkspaceFile> & {
  createFile: (index: number, overrides?: Partial<WorkspaceFile>) => WorkspaceFile;
  initialized: boolean;
  readmeFileId: string;
};

type WorkspaceStoreActions = {
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
  replaceWorkspace: (workspace: WorkspaceModelState<WorkspaceFile>) => WorkspaceFile | undefined;
  restoreFile: (input: RestoreFileInput) => WorkspaceFile;
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
  setFileCollaboratorCount: (fileId: string, collaboratorCount: number) => void;
  setFileRecoveryEvent: (fileId: string, event: RecoveryEventUpdate) => void;
  setFileText: (fileId: string, text: string) => void;
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
  collaboratorCount: overrides.collaboratorCount,
  lastRecoveryType: overrides.lastRecoveryType,
  lastRecoveryMessage: overrides.lastRecoveryMessage,
  lastRecoveryAt: overrides.lastRecoveryAt,
});

const DEFAULT_WORKSPACE_STORE_STATE: WorkspaceStoreState = {
  activeFileId: "",
  createFile: noopCreateFile,
  files: [],
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

const getAvailableFileTitle = (files: WorkspaceFile[], baseTitle: string) =>
  getAvailableWorkspaceFileTitle(files, baseTitle);

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
  collaboratorCount: 0,
  lastRecoveryType: undefined,
  lastRecoveryMessage: undefined,
  lastRecoveryAt: undefined,
});

export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => ({
  ...DEFAULT_WORKSPACE_STORE_STATE,

  initializeWorkspace: ({ createFile, readmeFileId, ...workspace }) => {
    set({
      ...createWorkspaceModelState(workspace),
      createFile,
      initialized: true,
      readmeFileId,
    });
  },

  replaceWorkspace: (workspace) => {
    const nextWorkspace = createWorkspaceModelState(workspace);
    set((state) => ({
      ...state,
      ...nextWorkspace,
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
    const nextFile = state.createFile(getNextUserFileIndex(state.files, state.readmeFileId), overrides);
    set((currentState) => ({
      ...currentState,
      ...addWorkspaceFile(getWorkspaceState(currentState), nextFile),
    }));
    return nextFile;
  },

  addFileFromContent: (title, text, viewMode = "edit", overrides) => {
    const state = get();
    const nextFile = state.createFile(getNextUserFileIndex(state.files, state.readmeFileId), {
      ...overrides,
      title: getAvailableFileTitle(state.files, title),
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
            collaboratorCount: sourceFile.collaboratorCount ?? 0,
          }
        : {
            connectionStatus: "idle" as const,
            roomId: undefined,
            shareUrl: undefined,
            collaboratorCount: undefined,
          };
    const nextFile = state.createFile(getNextUserFileIndex(state.files, state.readmeFileId), {
      title: getAvailableFileTitle(state.files, sourceFile.title),
      text: sourceFile.text,
      viewMode: sourceFile.viewMode,
      readingWidth: sourceFile.readingWidth,
      lineWrapping: sourceFile.lineWrapping,
      lineNumbers: sourceFile.lineNumbers,
      ...collaborationFields,
    });

    set((currentState) => ({
      ...currentState,
      ...addWorkspaceFile(getWorkspaceState(currentState), nextFile, { insertAfterFileId: fileId }),
    }));
    return nextFile;
  },

  renameFile: (fileId, nextRawTitle) => {
    const { result } = renameWorkspaceFile(getWorkspaceState(get()), fileId, nextRawTitle);
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
          collaboratorCount: options.collaboratorCount ?? file.collaboratorCount,
        };
      }),
    );
  },

  setFileCollaboratorCount: (fileId, collaboratorCount) => {
    set((state) => updateFileInState(state, fileId, (file) => ({ ...file, collaboratorCount })));
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
}));

export const getWorkspaceStoreSnapshot = () => getWorkspaceState(useWorkspaceStore.getState());

export const getWorkspaceStoreOpenFiles = () => getOpenWorkspaceFiles(getWorkspaceStoreSnapshot());

export const getWorkspaceStoreActiveFile = () => getActiveWorkspaceFile(getWorkspaceStoreSnapshot());

export const resetWorkspaceStoreForTests = () => {
  useWorkspaceStore.setState(DEFAULT_WORKSPACE_STORE_STATE);
};
