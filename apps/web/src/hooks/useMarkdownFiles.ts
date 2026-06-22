import { useCallback, useMemo, useReducer, type Dispatch, type SetStateAction } from "react";
import type { FileViewMode, MarkdownFile, ReadingWidth } from "../workspaceStorage";
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
} from "../workspaceModel";
export { normalizeMarkdownFileTitle } from "../workspaceModel";
export type { RenameFileResult } from "../workspaceModel";

type UseMarkdownFilesOptions = {
  initialFiles: MarkdownFile[];
  initialOpenFileIds: string[];
  initialActiveFileId: string;
  readmeFileId: string;
  createFile: (index: number, overrides?: Partial<MarkdownFile>) => MarkdownFile;
};

export function useMarkdownFiles({
  initialFiles,
  initialOpenFileIds,
  initialActiveFileId,
  readmeFileId,
  createFile,
}: UseMarkdownFilesOptions) {
  const [workspace, dispatchWorkspace] = useReducer(
    workspaceReducer,
    {
      files: initialFiles,
      openFileIds: initialOpenFileIds,
      activeFileId: initialActiveFileId,
    },
    createWorkspaceModelState,
  );
  const { files, openFileIds, activeFileId } = workspace;
  const openFiles = useMemo(() => getOpenWorkspaceFiles(workspace), [workspace]);
  const activeFile = useMemo(() => getActiveWorkspaceFile(workspace), [workspace]);

  const setFiles = useCallback<Dispatch<SetStateAction<MarkdownFile[]>>>((update) => {
    dispatchWorkspace({ type: "replaceFiles", update });
  }, []);

  const setOpenFileIds = useCallback<Dispatch<SetStateAction<string[]>>>((update) => {
    dispatchWorkspace({ type: "replaceOpenFileIds", update });
  }, []);

  const setActiveFileId = useCallback((fileId: string) => {
    dispatchWorkspace({ type: "setActiveFileId", fileId });
  }, []);

  const getAvailableFileTitle = (baseTitle: string) => getAvailableMarkdownFileTitle(files, baseTitle);

  const getNextUserFileIndex = () => files.filter((file) => file.id !== readmeFileId).length + 1;

  const selectFile = (fileId: string) => {
    const nextWorkspace = selectWorkspaceFile(workspace, fileId);
    const nextFile = nextWorkspace.files.find((file) => file.id === fileId);
    if (!nextFile) {
      return undefined;
    }

    dispatchWorkspace({ type: "selectFile", fileId });
    return nextFile;
  };

  const addFile = (overrides?: Partial<MarkdownFile>) => {
    const nextFile = createFile(getNextUserFileIndex(), overrides);
    dispatchWorkspace({ type: "addFile", file: nextFile });
    return nextFile;
  };

  const addFileFromContent = (
    title: string,
    text: string,
    viewMode: FileViewMode = "edit",
    overrides?: Partial<MarkdownFile>,
  ) => {
    const nextFile = createFile(getNextUserFileIndex(), {
      ...overrides,
      title: getAvailableFileTitle(title),
      text,
      viewMode: overrides?.viewMode ?? viewMode,
    });
    dispatchWorkspace({ type: "addFile", file: nextFile });
    return nextFile;
  };

  const addTemplateFile = (template: { title: string; content: string }, overrides?: Partial<MarkdownFile>) => {
    return addFileFromContent(template.title, template.content, "edit", overrides);
  };

  const duplicateFile = (fileId: string) => {
    const sourceFile = files.find((file) => file.id === fileId);
    if (!sourceFile) {
      return undefined;
    }

    const nextFile = createFile(getNextUserFileIndex(), {
      title: getAvailableFileTitle(sourceFile.title),
      text: sourceFile.text,
      viewMode: sourceFile.viewMode,
      readingWidth: sourceFile.readingWidth,
      lineWrapping: sourceFile.lineWrapping,
      lineNumbers: sourceFile.lineNumbers,
      connectionStatus: "idle",
    });

    dispatchWorkspace({ type: "addFile", file: nextFile, insertAfterFileId: fileId });
    return nextFile;
  };

  const renameFile = (fileId: string, nextRawTitle: string) => {
    const { result } = renameWorkspaceFile(workspace, fileId, nextRawTitle);
    if (result.ok) {
      dispatchWorkspace({ type: "renameFile", fileId, title: nextRawTitle });
    }

    return result;
  };

  const closeFile = (fileId: string) => {
    const next = closeWorkspaceFile(workspace, fileId);
    if (!next) {
      return undefined;
    }

    dispatchWorkspace({ type: "closeFile", fileId });
    return next.result;
  };

  const deleteFile = (fileId: string) => {
    const next = deleteWorkspaceFile(workspace, fileId);
    if (!next) {
      return undefined;
    }

    dispatchWorkspace({ type: "deleteFile", fileId });
    return next.result;
  };

  const reorderFiles = (sourceFileId: string, targetFileId: string) => {
    if (reorderOpenWorkspaceFile(workspace, sourceFileId, targetFileId) === workspace) {
      return;
    }

    dispatchWorkspace({ type: "reorderOpenFile", sourceFileId, targetFileId });
  };

  const moveFile = (fileId: string, direction: -1 | 1) => {
    const currentIndex = openFileIds.indexOf(fileId);
    const targetFileId = openFileIds[currentIndex + direction];

    if (!targetFileId) {
      return;
    }

    reorderFiles(fileId, targetFileId);
  };

  const selectAdjacentFile = (direction: -1 | 1) => {
    const next = selectAdjacentWorkspaceFile(workspace, direction);
    if (!next.file) {
      return undefined;
    }

    dispatchWorkspace({ type: "selectFile", fileId: next.file.id });
    return next.file;
  };

  const setActiveFileViewMode = (nextViewMode: FileViewMode) => {
    dispatchWorkspace({ type: "setActiveFileViewMode", viewMode: nextViewMode });
  };

  const setActiveFileReadingWidth = (nextReadingWidth: ReadingWidth) => {
    dispatchWorkspace({ type: "setActiveFileReadingWidth", readingWidth: nextReadingWidth });
  };

  const setActiveFileLineWrapping = (nextLineWrapping: boolean) => {
    dispatchWorkspace({ type: "setActiveFileLineWrapping", lineWrapping: nextLineWrapping });
  };

  const setActiveFileLineNumbers = (nextLineNumbers: boolean) => {
    dispatchWorkspace({ type: "setActiveFileLineNumbers", lineNumbers: nextLineNumbers });
  };

  return {
    files,
    openFiles,
    openFileIds,
    setOpenFileIds,
    setFiles,
    activeFileId,
    setActiveFileId,
    activeFile,
    selectFile,
    addFile,
    addFileFromContent,
    addTemplateFile,
    duplicateFile,
    renameFile,
    closeFile,
    deleteFile,
    reorderFiles,
    moveFile,
    selectAdjacentFile,
    setActiveFileViewMode,
    setActiveFileReadingWidth,
    setActiveFileLineWrapping,
    setActiveFileLineNumbers,
    getAvailableFileTitle,
  };
}
