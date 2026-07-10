import {
  clampSplitEditorRatio,
  type FileViewMode,
  type ReadingWidth,
} from "./documentPrimitives";

export type WorkspaceModelFile = {
  id: string;
  title: string;
  text: string;
  viewMode: FileViewMode;
  readingWidth: ReadingWidth;
  splitRatio?: number;
  lineWrapping: boolean;
  lineNumbers: boolean;
};

export type WorkspaceModelState<TFile extends WorkspaceModelFile = WorkspaceModelFile> = {
  files: TFile[];
  openFileIds: string[];
  activeFileId: string;
};

export type CloseFileResult<TFile extends WorkspaceModelFile = WorkspaceModelFile> = {
  closedActiveFile: boolean;
  nextActiveFile?: TFile;
};

export type RenameFileResult =
  | {
      ok: true;
      title: string;
    }
  | {
      ok: false;
      reason: "empty" | "duplicate";
      title: string;
      message: string;
    };

type WorkspaceValueUpdater<T> = T | ((currentValue: T) => T);

export type WorkspaceModelAction<TFile extends WorkspaceModelFile = WorkspaceModelFile> =
  | { type: "replaceWorkspace"; state: WorkspaceModelState<TFile> }
  | { type: "replaceFiles"; update: WorkspaceValueUpdater<TFile[]> }
  | { type: "replaceOpenFileIds"; update: WorkspaceValueUpdater<string[]> }
  | { type: "setActiveFileId"; fileId: string }
  | { type: "selectFile"; fileId: string }
  | { type: "addFile"; file: TFile; insertAfterFileId?: string }
  | { type: "renameFile"; fileId: string; title: string }
  | { type: "closeFile"; fileId: string }
  | { type: "deleteFile"; fileId: string }
  | { type: "reorderOpenFile"; sourceFileId: string; targetFileId: string }
  | { type: "setActiveFileText"; text: string }
  | { type: "setActiveFileViewMode"; viewMode: FileViewMode }
  | { type: "setActiveFileReadingWidth"; readingWidth: ReadingWidth }
  | { type: "setActiveFileLineWrapping"; lineWrapping: boolean }
  | { type: "setActiveFileLineNumbers"; lineNumbers: boolean }
  | { type: "setActiveFileSplitRatio"; splitRatio: number };

const updateWorkspaceFileFields = <TFile extends WorkspaceModelFile>(
  file: TFile,
  fields: Partial<WorkspaceModelFile>,
): TFile => ({
  ...file,
  ...fields,
});

const applyValueUpdater = <T>(value: T, update: WorkspaceValueUpdater<T>) =>
  typeof update === "function" ? (update as (currentValue: T) => T)(value) : update;

const uniqueKnownFileIds = (fileIds: string[], knownFileIds: Set<string>) => {
  const nextFileIds: string[] = [];

  for (const fileId of fileIds) {
    if (!knownFileIds.has(fileId) || nextFileIds.includes(fileId)) {
      continue;
    }

    nextFileIds.push(fileId);
  }

  return nextFileIds;
};

export const createWorkspaceModelState = <TFile extends WorkspaceModelFile>({
  files,
  openFileIds,
  activeFileId,
}: WorkspaceModelState<TFile>): WorkspaceModelState<TFile> => {
  const knownFileIds = new Set(files.map((file) => file.id));
  const nextOpenFileIds = uniqueKnownFileIds(openFileIds, knownFileIds);
  const hasActiveFile = Boolean(activeFileId && knownFileIds.has(activeFileId));
  const nextActiveFileId = hasActiveFile ? activeFileId : (nextOpenFileIds[0] ?? "");

  if (nextActiveFileId && !nextOpenFileIds.includes(nextActiveFileId)) {
    nextOpenFileIds.push(nextActiveFileId);
  }

  return {
    files,
    openFileIds: nextOpenFileIds,
    activeFileId: nextActiveFileId,
  };
};

export const getOpenWorkspaceFiles = <TFile extends WorkspaceModelFile>(
  state: WorkspaceModelState<TFile>,
) =>
  state.openFileIds
    .map((fileId) => state.files.find((file) => file.id === fileId))
    .filter((file): file is TFile => Boolean(file));

export const getActiveWorkspaceFile = <TFile extends WorkspaceModelFile>(
  state: WorkspaceModelState<TFile>,
) =>
  getOpenWorkspaceFiles(state).find((file) => file.id === state.activeFileId);

export const normalizeWorkspaceFileTitle = (title: string) => {
  const trimmedTitle = title
    .trim()
    .split("\0")
    .join(" ")
    .replace(/[/\\]/g, " ")
    .replace(/\s+/g, " ");
  if (!trimmedTitle || trimmedTitle === "." || trimmedTitle === "..") {
    return "Untitled.md";
  }

  return /\.[A-Za-z0-9]+$/.test(trimmedTitle) ? trimmedTitle : `${trimmedTitle}.md`;
};

export const getAvailableWorkspaceFileTitle = <TFile extends WorkspaceModelFile>(
  files: TFile[],
  baseTitle: string,
) => {
  const normalizedTitle = normalizeWorkspaceFileTitle(baseTitle);
  const existingTitles = new Set(files.map((file) => file.title.toLowerCase()));
  if (!existingTitles.has(normalizedTitle.toLowerCase())) {
    return normalizedTitle;
  }

  const extensionMatch = normalizedTitle.match(/(\.[A-Za-z0-9]+)$/);
  const extension = extensionMatch?.[1] ?? "";
  const titleWithoutExtension = extension ? normalizedTitle.slice(0, -extension.length) : normalizedTitle;
  let index = 2;
  let candidateTitle = `${titleWithoutExtension} ${index}${extension}`;

  while (existingTitles.has(candidateTitle.toLowerCase())) {
    index += 1;
    candidateTitle = `${titleWithoutExtension} ${index}${extension}`;
  }

  return candidateTitle;
};

export const renameWorkspaceFile = <TFile extends WorkspaceModelFile>(
  state: WorkspaceModelState<TFile>,
  fileId: string,
  nextRawTitle: string,
): { state: WorkspaceModelState<TFile>; result: RenameFileResult } => {
  const trimmedTitle = nextRawTitle.trim().replace(/\s+/g, " ");
  if (!trimmedTitle) {
    return {
      state,
      result: {
        ok: false,
        reason: "empty",
        title: "",
        message: "File name cannot be empty.",
      },
    };
  }

  const nextTitle = normalizeWorkspaceFileTitle(trimmedTitle);
  const duplicateFile = state.files.find(
    (file) => file.id !== fileId && file.title.toLowerCase() === nextTitle.toLowerCase(),
  );

  if (duplicateFile) {
    return {
      state,
      result: {
        ok: false,
        reason: "duplicate",
        title: nextTitle,
        message: "File name already exists.",
      },
    };
  }

  return {
    state: {
      ...state,
      files: state.files.map((file) =>
        file.id === fileId ? updateWorkspaceFileFields(file, { title: nextTitle }) : file,
      ),
    },
    result: { ok: true, title: nextTitle },
  };
};

export const selectWorkspaceFile = <TFile extends WorkspaceModelFile>(
  state: WorkspaceModelState<TFile>,
  fileId: string,
): WorkspaceModelState<TFile> => {
  if (!state.files.some((file) => file.id === fileId)) {
    return state;
  }

  return {
    ...state,
    activeFileId: fileId,
    openFileIds: state.openFileIds.includes(fileId) ? state.openFileIds : [...state.openFileIds, fileId],
  };
};

export const setWorkspaceActiveFileId = <TFile extends WorkspaceModelFile>(
  state: WorkspaceModelState<TFile>,
  fileId: string,
): WorkspaceModelState<TFile> => {
  if (!fileId) {
    return {
      ...state,
      activeFileId: "",
    };
  }

  return selectWorkspaceFile(state, fileId);
};

export const addWorkspaceFile = <TFile extends WorkspaceModelFile>(
  state: WorkspaceModelState<TFile>,
  file: TFile,
  options: { insertAfterFileId?: string } = {},
): WorkspaceModelState<TFile> => {
  const files = [...state.files];
  const insertAfterIndex = options.insertAfterFileId
    ? files.findIndex((candidateFile) => candidateFile.id === options.insertAfterFileId)
    : -1;

  if (insertAfterIndex === -1) {
    files.push(file);
  } else {
    files.splice(insertAfterIndex + 1, 0, file);
  }

  return {
    files,
    openFileIds: state.openFileIds.includes(file.id) ? state.openFileIds : [...state.openFileIds, file.id],
    activeFileId: file.id,
  };
};

export const closeWorkspaceFile = <TFile extends WorkspaceModelFile>(
  state: WorkspaceModelState<TFile>,
  fileId: string,
): { state: WorkspaceModelState<TFile>; result: CloseFileResult<TFile> } | undefined => {
  const closingIndex = state.openFileIds.findIndex((openFileId) => openFileId === fileId);
  if (closingIndex === -1) {
    return undefined;
  }

  const remainingOpenFileIds = state.openFileIds.filter((openFileId) => openFileId !== fileId);
  const closedActiveFile = fileId === state.activeFileId;
  const nextActiveFileId = closedActiveFile
    ? (remainingOpenFileIds[closingIndex] ?? remainingOpenFileIds[closingIndex - 1] ?? remainingOpenFileIds[0] ?? "")
    : state.activeFileId;
  const nextActiveFile = closedActiveFile
    ? state.files.find((file) => file.id === nextActiveFileId)
    : state.files.find((file) => file.id === state.activeFileId);

  return {
    state: {
      ...state,
      openFileIds: remainingOpenFileIds,
      activeFileId: closedActiveFile ? (nextActiveFile?.id ?? "") : state.activeFileId,
    },
    result: { closedActiveFile, nextActiveFile },
  };
};

export const deleteWorkspaceFile = <TFile extends WorkspaceModelFile>(
  state: WorkspaceModelState<TFile>,
  fileId: string,
): { state: WorkspaceModelState<TFile>; result: CloseFileResult<TFile> } | undefined => {
  const deletingFile = state.files.find((file) => file.id === fileId);
  if (!deletingFile) {
    return undefined;
  }

  const deletedOpenIndex = state.openFileIds.findIndex((openFileId) => openFileId === fileId);
  const remainingOpenFileIds = state.openFileIds.filter((openFileId) => openFileId !== fileId);
  const deletedActiveFile = fileId === state.activeFileId;
  const nextActiveFileId = deletedActiveFile
    ? (remainingOpenFileIds[deletedOpenIndex] ?? remainingOpenFileIds[deletedOpenIndex - 1] ?? remainingOpenFileIds[0] ?? "")
    : state.activeFileId;
  const nextFiles = state.files.filter((file) => file.id !== fileId);
  const nextActiveFile = deletedActiveFile ? nextFiles.find((file) => file.id === nextActiveFileId) : getActiveWorkspaceFile(state);

  return {
    state: {
      files: nextFiles,
      openFileIds: remainingOpenFileIds,
      activeFileId: deletedActiveFile ? (nextActiveFile?.id ?? "") : state.activeFileId,
    },
    result: { closedActiveFile: deletedActiveFile, nextActiveFile },
  };
};

export const reorderOpenWorkspaceFile = <TFile extends WorkspaceModelFile>(
  state: WorkspaceModelState<TFile>,
  sourceFileId: string,
  targetFileId: string,
): WorkspaceModelState<TFile> => {
  if (sourceFileId === targetFileId) {
    return state;
  }

  const sourceIndex = state.openFileIds.indexOf(sourceFileId);
  const targetIndex = state.openFileIds.indexOf(targetFileId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return state;
  }

  const openFileIds = [...state.openFileIds];
  const [movedFileId] = openFileIds.splice(sourceIndex, 1);
  openFileIds.splice(targetIndex, 0, movedFileId);

  return {
    ...state,
    openFileIds,
  };
};

export const selectAdjacentWorkspaceFile = <TFile extends WorkspaceModelFile>(
  state: WorkspaceModelState<TFile>,
  direction: -1 | 1,
): { state: WorkspaceModelState<TFile>; file?: TFile } => {
  const openFiles = getOpenWorkspaceFiles(state);
  if (openFiles.length < 2) {
    return { state };
  }

  const currentIndex = Math.max(
    0,
    openFiles.findIndex((file) => file.id === state.activeFileId),
  );
  const nextIndex = (currentIndex + direction + openFiles.length) % openFiles.length;
  const nextFile = openFiles[nextIndex];

  return {
    state: {
      ...state,
      activeFileId: nextFile.id,
    },
    file: nextFile,
  };
};

const updateWorkspaceFile = <TFile extends WorkspaceModelFile>(
  state: WorkspaceModelState<TFile>,
  fileId: string,
  updateFile: (file: TFile) => TFile,
): WorkspaceModelState<TFile> => {
  if (!state.files.some((file) => file.id === fileId)) {
    return state;
  }

  return {
    ...state,
    files: state.files.map((file) => (file.id === fileId ? updateFile(file) : file)),
  };
};

const updateActiveWorkspaceFile = <TFile extends WorkspaceModelFile>(
  state: WorkspaceModelState<TFile>,
  updateFile: (file: TFile) => TFile,
): WorkspaceModelState<TFile> => {
  if (!state.activeFileId) {
    return state;
  }

  return updateWorkspaceFile(state, state.activeFileId, updateFile);
};

export const workspaceReducer = <TFile extends WorkspaceModelFile>(
  state: WorkspaceModelState<TFile>,
  action: WorkspaceModelAction<TFile>,
): WorkspaceModelState<TFile> => {
  switch (action.type) {
    case "replaceWorkspace":
      return createWorkspaceModelState(action.state);
    case "replaceFiles":
      return createWorkspaceModelState({
        ...state,
        files: applyValueUpdater(state.files, action.update),
      });
    case "replaceOpenFileIds": {
      const knownFileIds = new Set(state.files.map((file) => file.id));
      const openFileIds = uniqueKnownFileIds(applyValueUpdater(state.openFileIds, action.update), knownFileIds);
      const nextOpenFileIds =
        state.activeFileId && knownFileIds.has(state.activeFileId) && !openFileIds.includes(state.activeFileId)
          ? [...openFileIds, state.activeFileId]
          : openFileIds;

      return {
        ...state,
        openFileIds: nextOpenFileIds,
        activeFileId: state.activeFileId && nextOpenFileIds.includes(state.activeFileId) ? state.activeFileId : (nextOpenFileIds[0] ?? ""),
      };
    }
    case "setActiveFileId":
      return setWorkspaceActiveFileId(state, action.fileId);
    case "selectFile":
      return selectWorkspaceFile(state, action.fileId);
    case "addFile":
      return addWorkspaceFile(state, action.file, { insertAfterFileId: action.insertAfterFileId });
    case "renameFile":
      return renameWorkspaceFile(state, action.fileId, action.title).state;
    case "closeFile":
      return closeWorkspaceFile(state, action.fileId)?.state ?? state;
    case "deleteFile":
      return deleteWorkspaceFile(state, action.fileId)?.state ?? state;
    case "reorderOpenFile":
      return reorderOpenWorkspaceFile(state, action.sourceFileId, action.targetFileId);
    case "setActiveFileText":
      return updateActiveWorkspaceFile(state, (file) =>
        updateWorkspaceFileFields(file, { text: action.text }),
      );
    case "setActiveFileViewMode":
      return updateActiveWorkspaceFile(state, (file) =>
        updateWorkspaceFileFields(file, { viewMode: action.viewMode }),
      );
    case "setActiveFileReadingWidth":
      return updateActiveWorkspaceFile(state, (file) =>
        updateWorkspaceFileFields(file, { readingWidth: action.readingWidth }),
      );
    case "setActiveFileLineWrapping":
      return updateActiveWorkspaceFile(state, (file) =>
        updateWorkspaceFileFields(file, { lineWrapping: action.lineWrapping }),
      );
    case "setActiveFileLineNumbers":
      return updateActiveWorkspaceFile(state, (file) =>
        updateWorkspaceFileFields(file, { lineNumbers: action.lineNumbers }),
      );
    case "setActiveFileSplitRatio":
      return updateActiveWorkspaceFile(state, (file) =>
        updateWorkspaceFileFields(file, {
          splitRatio: clampSplitEditorRatio(action.splitRatio),
        }),
      );
    default:
      return state;
  }
};
