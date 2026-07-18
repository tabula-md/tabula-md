import { useMemo, useState } from "react";
import {
  getWorkspaceStoreForMode,
  type WorkspaceStoreBinding,
} from "./workspaceStore";
import type { WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";
import {
  getActiveWorkspaceFile,
  getAvailableWorkspaceFileTitle,
  getOpenWorkspaceFiles,
} from "@tabula-md/tabula";
export { normalizeWorkspaceFileTitle } from "@tabula-md/tabula";
export type { RenameFileResult } from "@tabula-md/tabula";

type UseWorkspaceFilesOptions = {
  initialFiles: WorkspaceFile[];
  initialFolders: WorkspaceFolder[];
  initialOpenFileIds: string[];
  initialActiveFileId: string;
  readmeFileId: string;
  createFile: (index: number, overrides?: Partial<WorkspaceFile>) => WorkspaceFile;
  store: WorkspaceStoreBinding;
};

export function useWorkspaceFiles({
  initialFiles,
  initialFolders,
  initialOpenFileIds,
  initialActiveFileId,
  readmeFileId,
  createFile,
  store,
}: UseWorkspaceFilesOptions) {
  useState(() => {
    for (const storeMode of ["local", "room"] as const) {
      const store = getWorkspaceStoreForMode(storeMode);
      if (store.getState().initialized) continue;
      store.getState().initializeWorkspace({
        files: initialFiles,
        folders: initialFolders,
        openFileIds: initialOpenFileIds,
        activeFileId: initialActiveFileId,
        readmeFileId,
        createFile,
      });
    }
    return true;
  });

  const useActiveStore = store;

  const files = useActiveStore((state) => state.files);
  const folders = useActiveStore((state) => state.folders);
  const openFileIds = useActiveStore((state) => state.openFileIds);
  const activeFileId = useActiveStore((state) => state.activeFileId);
  const workspace = useMemo(
    () => ({
      files,
      openFileIds,
      activeFileId,
    }),
    [activeFileId, files, openFileIds],
  );
  const openFiles = useMemo(() => getOpenWorkspaceFiles(workspace), [workspace]);
  const activeFile = useMemo(() => getActiveWorkspaceFile(workspace), [workspace]);
  const selectFile = useActiveStore((state) => state.selectFile);
  const addFile = useActiveStore((state) => state.addFile);
  const addFolder = useActiveStore((state) => state.addFolder);
  const addFileFromContent = useActiveStore((state) => state.addFileFromContent);
  const duplicateFile = useActiveStore((state) => state.duplicateFile);
  const renameFile = useActiveStore((state) => state.renameFile);
  const closeFile = useActiveStore((state) => state.closeFile);
  const deleteFile = useActiveStore((state) => state.deleteFile);
  const deleteFolder = useActiveStore((state) => state.deleteFolder);
  const moveFileToFolder = useActiveStore((state) => state.moveFileToFolder);
  const moveFolder = useActiveStore((state) => state.moveFolder);
  const renameFolder = useActiveStore((state) => state.renameFolder);
  const reorderFiles = useActiveStore((state) => state.reorderFiles);
  const moveFile = useActiveStore((state) => state.moveFile);
  const selectAdjacentFile = useActiveStore((state) => state.selectAdjacentFile);
  const replaceWorkspace = useActiveStore((state) => state.replaceWorkspace);
  const restoreFile = useActiveStore((state) => state.restoreFile);
  const restoreFolder = useActiveStore((state) => state.restoreFolder);
  const setActiveFileBookmarks = useActiveStore((state) => state.setActiveFileBookmarks);
  const setActiveFileText = useActiveStore((state) => state.setActiveFileText);
  const setActiveFileViewMode = useActiveStore((state) => state.setActiveFileViewMode);
  const setActiveFileReadingWidth = useActiveStore((state) => state.setActiveFileReadingWidth);
  const setActiveFileLineWrapping = useActiveStore((state) => state.setActiveFileLineWrapping);
  const setActiveFileLineNumbers = useActiveStore((state) => state.setActiveFileLineNumbers);
  const commitActiveFileSplitRatio = useActiveStore((state) => state.commitActiveFileSplitRatio);
  const setFileText = useActiveStore((state) => state.setFileText);

  const getAvailableFileTitle = (baseTitle: string) => getAvailableWorkspaceFileTitle(files, baseTitle);

  const addTemplateFile = (template: { title: string; content: string }, overrides?: Partial<WorkspaceFile>) => {
    return addFileFromContent(template.title, template.content, "edit", overrides);
  };

  return {
    files,
    folders,
    openFiles,
    openFileIds,
    activeFileId,
    activeFile,
    selectFile,
    addFile,
    addFolder,
    addFileFromContent,
    addTemplateFile,
    duplicateFile,
    renameFile,
    closeFile,
    deleteFile,
    deleteFolder,
    moveFileToFolder,
    moveFolder,
    renameFolder,
    replaceWorkspace,
    restoreFile,
    restoreFolder,
    reorderFiles,
    moveFile,
    selectAdjacentFile,
    setActiveFileBookmarks,
    setActiveFileText,
    setActiveFileViewMode,
    setActiveFileReadingWidth,
    setActiveFileLineWrapping,
    setActiveFileLineNumbers,
    commitActiveFileSplitRatio,
    setFileText,
    getAvailableFileTitle,
  };
}
