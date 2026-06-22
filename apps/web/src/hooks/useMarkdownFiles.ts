import { useMemo, useState } from "react";
import { useWorkspaceStore } from "../stores/workspaceStore";
import type { MarkdownFile } from "../workspaceStorage";
import {
  getActiveWorkspaceFile,
  getAvailableMarkdownFileTitle,
  getOpenWorkspaceFiles,
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
  useState(() => {
    useWorkspaceStore.getState().initializeWorkspace({
      files: initialFiles,
      openFileIds: initialOpenFileIds,
      activeFileId: initialActiveFileId,
      readmeFileId,
      createFile,
    });
    return true;
  });

  const files = useWorkspaceStore((state) => state.files);
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
  const addFileFromContent = useWorkspaceStore((state) => state.addFileFromContent);
  const activateRoomFile = useWorkspaceStore((state) => state.activateRoomFile);
  const duplicateFile = useWorkspaceStore((state) => state.duplicateFile);
  const renameFile = useWorkspaceStore((state) => state.renameFile);
  const closeFile = useWorkspaceStore((state) => state.closeFile);
  const deleteFile = useWorkspaceStore((state) => state.deleteFile);
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
  const setFileCollaboratorCount = useWorkspaceStore((state) => state.setFileCollaboratorCount);
  const setFileRoomMeta = useWorkspaceStore((state) => state.setFileRoomMeta);
  const setFileRecoveryEvent = useWorkspaceStore((state) => state.setFileRecoveryEvent);
  const startFileCollaborationSession = useWorkspaceStore((state) => state.startFileCollaborationSession);
  const stopFileCollaborationSession = useWorkspaceStore((state) => state.stopFileCollaborationSession);

  const getAvailableFileTitle = (baseTitle: string) => getAvailableMarkdownFileTitle(files, baseTitle);

  const addTemplateFile = (template: { title: string; content: string }, overrides?: Partial<MarkdownFile>) => {
    return addFileFromContent(template.title, template.content, "edit", overrides);
  };

  return {
    files,
    openFiles,
    openFileIds,
    activeFileId,
    activeFile,
    selectFile,
    addFile,
    addFileFromContent,
    activateRoomFile,
    addTemplateFile,
    duplicateFile,
    renameFile,
    closeFile,
    deleteFile,
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
    setFileCollaboratorCount,
    setFileRoomMeta,
    setFileRecoveryEvent,
    startFileCollaborationSession,
    stopFileCollaborationSession,
    getAvailableFileTitle,
  };
}
