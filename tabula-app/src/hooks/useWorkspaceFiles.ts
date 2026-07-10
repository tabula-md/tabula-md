import { useMemo, useState } from "react";
import { useWorkspaceStore } from "../stores/workspaceStore";
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
};

export function useWorkspaceFiles({
  initialFiles,
  initialFolders,
  initialOpenFileIds,
  initialActiveFileId,
  readmeFileId,
  createFile,
}: UseWorkspaceFilesOptions) {
  useState(() => {
    useWorkspaceStore.getState().initializeWorkspace({
      files: initialFiles,
      folders: initialFolders,
      openFileIds: initialOpenFileIds,
      activeFileId: initialActiveFileId,
      readmeFileId,
      createFile,
    });
    return true;
  });

  const files = useWorkspaceStore((state) => state.files);
  const folders = useWorkspaceStore((state) => state.folders);
  const openFileIds = useWorkspaceStore((state) => state.openFileIds);
  const activeFileId = useWorkspaceStore((state) => state.activeFileId);
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
  const selectFile = useWorkspaceStore((state) => state.selectFile);
  const addFile = useWorkspaceStore((state) => state.addFile);
  const addFolder = useWorkspaceStore((state) => state.addFolder);
  const addFileFromContent = useWorkspaceStore((state) => state.addFileFromContent);
  const activateRoomFile = useWorkspaceStore((state) => state.activateRoomFile);
  const duplicateFile = useWorkspaceStore((state) => state.duplicateFile);
  const renameFile = useWorkspaceStore((state) => state.renameFile);
  const closeFile = useWorkspaceStore((state) => state.closeFile);
  const deleteFile = useWorkspaceStore((state) => state.deleteFile);
  const deleteFolder = useWorkspaceStore((state) => state.deleteFolder);
  const moveFileToFolder = useWorkspaceStore((state) => state.moveFileToFolder);
  const moveFolder = useWorkspaceStore((state) => state.moveFolder);
  const renameFolder = useWorkspaceStore((state) => state.renameFolder);
  const reorderFiles = useWorkspaceStore((state) => state.reorderFiles);
  const moveFile = useWorkspaceStore((state) => state.moveFile);
  const selectAdjacentFile = useWorkspaceStore((state) => state.selectAdjacentFile);
  const replaceWorkspace = useWorkspaceStore((state) => state.replaceWorkspace);
  const restoreFile = useWorkspaceStore((state) => state.restoreFile);
  const upsertHelpFile = useWorkspaceStore((state) => state.upsertHelpFile);
  const setActiveFileBookmarks = useWorkspaceStore((state) => state.setActiveFileBookmarks);
  const setActiveFileText = useWorkspaceStore((state) => state.setActiveFileText);
  const setActiveFileViewMode = useWorkspaceStore((state) => state.setActiveFileViewMode);
  const setActiveFileReadingWidth = useWorkspaceStore((state) => state.setActiveFileReadingWidth);
  const setActiveFileLineWrapping = useWorkspaceStore((state) => state.setActiveFileLineWrapping);
  const setActiveFileLineNumbers = useWorkspaceStore((state) => state.setActiveFileLineNumbers);
  const commitActiveFileSplitRatio = useWorkspaceStore((state) => state.commitActiveFileSplitRatio);
  const setFileText = useWorkspaceStore((state) => state.setFileText);
  const setFileCollaborationStatus = useWorkspaceStore((state) => state.setFileCollaborationStatus);
  const setFileRecoveryEvent = useWorkspaceStore((state) => state.setFileRecoveryEvent);
  const setFolderCollaborationRoom = useWorkspaceStore((state) => state.setFolderCollaborationRoom);
  const startFileCollaborationSession = useWorkspaceStore((state) => state.startFileCollaborationSession);
  const stopFileCollaborationSession = useWorkspaceStore((state) => state.stopFileCollaborationSession);

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
    activateRoomFile,
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
    upsertHelpFile,
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
    setFileCollaborationStatus,
    setFileRecoveryEvent,
    setFolderCollaborationRoom,
    startFileCollaborationSession,
    stopFileCollaborationSession,
    getAvailableFileTitle,
  };
}
