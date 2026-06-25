import { create } from "zustand";
import { getMarkdownDocumentTitle } from "../markdown";
import {
  addWorkspaceFile,
  closeWorkspaceFile,
  createWorkspaceModelState,
  deleteWorkspaceFile,
  getActiveWorkspaceFile,
  getAvailableMarkdownFileTitle,
  getOpenWorkspaceFiles,
  renameWorkspaceFile,
  reorderOpenWorkspaceFile,
  selectAdjacentWorkspaceFile,
  selectWorkspaceFile,
  workspaceReducer,
  type CloseFileResult,
  type RenameFileResult,
  type WorkspaceModelState,
} from "../workspaceModel";
import {
  ensureLiveFileForRoom,
  getFileIdForRoom,
  getLiveFileTitle,
  type FileBookmark,
  type FileViewMode,
  type LocationRoom,
  type MarkdownFile,
  type ReadingWidth,
} from "../workspaceStorage";

type WorkspaceStoreInitialization = WorkspaceModelState & {
  createFile: (index: number, overrides?: Partial<MarkdownFile>) => MarkdownFile;
  readmeFileId: string;
};

type RestoreFileInput = {
  file: MarkdownFile;
  fileIndex: number;
  previousOpenFileIds: string[];
  activate: boolean;
};

type CollaborationStatusOptions = {
  collaboratorCount?: number;
  requireRoom?: boolean;
};

type RoomMetaUpdate = {
  snapshotCount: number;
  lastSnapshotAt?: string;
};

type RecoveryEventUpdate = {
  type: NonNullable<MarkdownFile["lastRecoveryType"]>;
  message: string;
  createdAt: string;
};

type WorkspaceStoreState = WorkspaceModelState & {
  createFile: (index: number, overrides?: Partial<MarkdownFile>) => MarkdownFile;
  initialized: boolean;
  readmeFileId: string;
};

type WorkspaceStoreActions = {
  addFile: (overrides?: Partial<MarkdownFile>) => MarkdownFile;
  addFileFromContent: (
    title: string,
    text: string,
    viewMode?: FileViewMode,
    overrides?: Partial<MarkdownFile>,
  ) => MarkdownFile;
  activateRoomFile: (room: LocationRoom) => MarkdownFile | undefined;
  closeFile: (fileId: string) => CloseFileResult | undefined;
  commitActiveFileSplitRatio: (splitRatio: number) => void;
  deleteFile: (fileId: string) => CloseFileResult | undefined;
  duplicateFile: (fileId: string) => MarkdownFile | undefined;
  initializeWorkspace: (initialization: WorkspaceStoreInitialization) => void;
  moveFile: (fileId: string, direction: -1 | 1) => void;
  renameFile: (fileId: string, nextRawTitle: string) => RenameFileResult;
  reorderFiles: (sourceFileId: string, targetFileId: string) => void;
  replaceWorkspace: (workspace: WorkspaceModelState) => MarkdownFile | undefined;
  restoreFile: (input: RestoreFileInput) => MarkdownFile;
  selectAdjacentFile: (direction: -1 | 1) => MarkdownFile | undefined;
  selectFile: (fileId: string) => MarkdownFile | undefined;
  setActiveFileBookmarks: (bookmarks: FileBookmark[]) => void;
  setActiveFileLineNumbers: (lineNumbers: boolean) => void;
  setActiveFileLineWrapping: (lineWrapping: boolean) => void;
  setActiveFileReadingWidth: (readingWidth: ReadingWidth) => void;
  setActiveFileText: (text: string) => void;
  setActiveFileViewMode: (viewMode: FileViewMode) => void;
  setFileCollaborationStatus: (
    fileId: string,
    status: NonNullable<MarkdownFile["connectionStatus"]>,
    options?: CollaborationStatusOptions,
  ) => void;
  setFileCollaboratorCount: (fileId: string, collaboratorCount: number) => void;
  setFileRecoveryEvent: (fileId: string, event: RecoveryEventUpdate) => void;
  setFileRoomMeta: (fileId: string, meta: RoomMetaUpdate) => void;
  setFileText: (fileId: string, text: string) => void;
  startFileCollaborationSession: (fileId: string, roomId: string, shareUrl: string) => MarkdownFile | undefined;
  stopFileCollaborationSession: (fileId: string) => MarkdownFile | undefined;
  upsertHelpFile: (helpMarkdown: string) => MarkdownFile;
};

export type WorkspaceStore = WorkspaceStoreState & WorkspaceStoreActions;

const noopCreateFile = (index: number, overrides: Partial<MarkdownFile> = {}): MarkdownFile => ({
  id: overrides.id ?? `workspace-file-${index}`,
  title: overrides.title ?? (index === 1 ? "Untitled.md" : `Untitled ${index}.md`),
  text: overrides.text ?? "",
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
  snapshotCount: overrides.snapshotCount,
  lastSnapshotAt: overrides.lastSnapshotAt,
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

const getWorkspaceState = (state: WorkspaceStoreState): WorkspaceModelState => ({
  files: state.files,
  openFileIds: state.openFileIds,
  activeFileId: state.activeFileId,
});

const getNextUserFileIndex = (files: MarkdownFile[], readmeFileId: string) =>
  files.filter((file) => file.id !== readmeFileId).length + 1;

const getAvailableFileTitle = (files: MarkdownFile[], baseTitle: string) =>
  getAvailableMarkdownFileTitle(files, baseTitle);

const reduceWorkspace = (
  state: WorkspaceStoreState,
  action: Parameters<typeof workspaceReducer>[1],
): WorkspaceStoreState => ({
  ...state,
  ...workspaceReducer(getWorkspaceState(state), action),
});

const updateFileInState = (
  state: WorkspaceStoreState,
  fileId: string,
  updateFile: (file: MarkdownFile) => MarkdownFile,
) => {
  if (!state.files.some((file) => file.id === fileId)) {
    return state;
  }

  return {
    ...state,
    files: state.files.map((file) => (file.id === fileId ? updateFile(file) : file)),
  };
};

const insertFileAt = (files: MarkdownFile[], file: MarkdownFile, fileIndex: number) => {
  if (files.some((candidate) => candidate.id === file.id)) {
    return files;
  }

  const nextFiles = [...files];
  nextFiles.splice(Math.min(Math.max(0, fileIndex), nextFiles.length), 0, file);
  return nextFiles;
};

const restoreOpenFileId = (
  openFileIds: string[],
  restoredFileId: string,
  previousOpenFileIds: string[],
) => {
  if (!previousOpenFileIds.includes(restoredFileId) || openFileIds.includes(restoredFileId)) {
    return openFileIds;
  }

  const previousOpenIndex = previousOpenFileIds.indexOf(restoredFileId);
  const nextOpenFileIds = [...openFileIds];
  nextOpenFileIds.splice(Math.min(previousOpenIndex, nextOpenFileIds.length), 0, restoredFileId);
  return nextOpenFileIds;
};

const clearCollaborationFields = (file: MarkdownFile): MarkdownFile => ({
  ...file,
  roomId: undefined,
  shareUrl: undefined,
  connectionStatus: "idle",
  collaboratorCount: 0,
  snapshotCount: 0,
  lastSnapshotAt: undefined,
  lastRecoveryType: undefined,
  lastRecoveryMessage: undefined,
  lastRecoveryAt: undefined,
});

const getFileTitleFromLiveText = (files: MarkdownFile[], file: MarkdownFile, text: string) => {
  if (!file.roomId || file.title !== getLiveFileTitle(file.roomId)) {
    return file.title;
  }

  const documentTitle = getMarkdownDocumentTitle(text);
  return documentTitle
    ? getAvailableMarkdownFileTitle(
        files.filter((candidate) => candidate.id !== file.id),
        documentTitle,
      )
    : file.title;
};

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
    const nextFiles = ensureLiveFileForRoom(get().files, room);
    const targetFileId = getFileIdForRoom(nextFiles, room.roomId);
    const nextFile = nextFiles.find((file) => file.id === targetFileId);

    set((state) => ({
      ...state,
      ...createWorkspaceModelState({
        files: nextFiles,
        openFileIds: state.openFileIds,
        activeFileId: targetFileId,
      }),
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
      title: getAvailableFileTitle(state.files, sourceFile.title),
      text: sourceFile.text,
      viewMode: sourceFile.viewMode,
      readingWidth: sourceFile.readingWidth,
      lineWrapping: sourceFile.lineWrapping,
      lineNumbers: sourceFile.lineNumbers,
      connectionStatus: "idle",
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
        files: insertFileAt(state.files, file, fileIndex),
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
        title: getFileTitleFromLiveText(state.files, file, text),
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

  setFileRoomMeta: (fileId, meta) => {
    set((state) =>
      updateFileInState(state, fileId, (file) => ({
        ...file,
        snapshotCount: meta.snapshotCount,
        lastSnapshotAt: meta.lastSnapshotAt,
      })),
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
    let nextFile: MarkdownFile | undefined;

    set((state) =>
      updateFileInState(state, fileId, (file) => {
        nextFile = {
          ...file,
          roomId,
          shareUrl,
          connectionStatus: "connecting",
          snapshotCount: 0,
          lastSnapshotAt: undefined,
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
    let nextFile: MarkdownFile | undefined;

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
