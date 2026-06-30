import { useState, type ChangeEvent, type DragEvent, type RefObject } from "react";
import type { MarkdownEditorHandle } from "../markdownEditorTypes";
import { WORKSPACE_EXPORT_FILE_PREFIX } from "../product";
import { createProjectArchive } from "../projectArchive";
import {
  migrateWorkspacePayload,
  syncUrlForFile,
  type FileComment,
  type WorkspaceFile,
  type WorkspaceState,
} from "../workspaceStorage";
import {
  createCurrentFileDownloadDraft,
  createImportedWorkspaceFileDraft,
  createWorkspaceProjectDownloadDraft,
  getUnreadableProjectJsonMessage,
  getUnsupportedProjectSchemaMessage,
  isSupportedImportFileDescriptor,
} from "../workspaceIoModel";
import type { WorkspacePreferences } from "./useWorkspacePreferences";
import { useAnimationFrameTask } from "./useAnimationFrameTask";

const downloadTextFile = (fileName: string, content: string, type = "text/plain;charset=utf-8") => {
  const blob = new Blob([content], { type });
  downloadBlobFile(fileName, blob);
};

const downloadBlobFile = (fileName: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

type UseProjectIoControllerArgs = {
  activeFile?: WorkspaceFile;
  activeFileId: string;
  addFileFromContent: (
    title: string,
    text: string,
    viewMode?: WorkspaceFile["viewMode"],
    overrides?: Partial<WorkspaceFile>,
  ) => WorkspaceFile;
  commentsByFileId: Record<string, FileComment[]>;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  files: WorkspaceFile[];
  openFileIds: string[];
  preferences: WorkspacePreferences;
  replaceCommentsByFileId: (commentsByFileId: Record<string, FileComment[]>) => void;
  replaceWorkspace: (workspace: Pick<WorkspaceState, "files" | "openFileIds" | "activeFileId">) => WorkspaceFile | undefined;
  resetCollaborationState: (nextStatus: WorkspaceFile["connectionStatus"]) => void;
  showToast: (message: string, tone?: "neutral" | "error", options?: { actionLabel?: string; onAction?: () => void }) => void;
  clearFileHistory: () => void;
  onCloseChrome: () => void;
};

export function useProjectIoController({
  activeFile,
  activeFileId,
  addFileFromContent,
  commentsByFileId,
  editorRef,
  files,
  openFileIds,
  preferences,
  replaceCommentsByFileId,
  replaceWorkspace,
  resetCollaborationState,
  showToast,
  clearFileHistory,
  onCloseChrome,
}: UseProjectIoControllerArgs) {
  const [emptyDropActive, setEmptyDropActive] = useState(false);
  const queueAnimationFrameTask = useAnimationFrameTask();

  const copyCurrentFile = async () => {
    if (!activeFile) {
      return;
    }

    await navigator.clipboard.writeText(activeFile.text);
    showToast("File copied.");
  };

  const downloadCurrentFile = () => {
    if (!activeFile) {
      return;
    }

    const download = createCurrentFileDownloadDraft(activeFile);
    downloadTextFile(download.fileName, download.content, download.type);
    showToast("File downloaded.");
  };

  const downloadProject = () => {
    const download = createWorkspaceProjectDownloadDraft({
      files,
      openFileIds,
      activeFileId: activeFile?.id ?? activeFileId,
      commentsByFileId,
    });
    downloadTextFile(download.fileName, download.content, download.type);
    showToast("Project downloaded.");
  };

  const downloadProjectArchive = () => {
    const archive = createProjectArchive(files);
    downloadBlobFile(`${WORKSPACE_EXPORT_FILE_PREFIX}.zip`, archive);
    showToast("Project archive downloaded.");
  };

  const importProjectFile = async (file: File) => {
    let parsedWorkspace: unknown;

    try {
      parsedWorkspace = JSON.parse(await file.text());
    } catch {
      showToast(getUnreadableProjectJsonMessage(), "error");
      return;
    }

    const nextWorkspace = migrateWorkspacePayload(parsedWorkspace, { includeLocationRoom: false });
    if (!nextWorkspace) {
      showToast(getUnsupportedProjectSchemaMessage(), "error");
      return;
    }

    const nextActiveFile = replaceWorkspace(nextWorkspace);
    replaceCommentsByFileId(nextWorkspace.commentsByFileId);
    clearFileHistory();
    resetCollaborationState(nextActiveFile?.roomId ? "connecting" : "idle");
    onCloseChrome();
    syncUrlForFile(nextActiveFile);
    showToast("Project imported.");
  };

  const importFile = async (file: File) => {
    const importedText = await file.text();
    const importedFileDraft = createImportedWorkspaceFileDraft(file.name, importedText, preferences);
    const nextFile = addFileFromContent(
      importedFileDraft.title,
      importedFileDraft.text,
      importedFileDraft.viewMode,
      importedFileDraft.overrides,
    );
    onCloseChrome();
    syncUrlForFile(nextFile);

    queueAnimationFrameTask(() => editorRef.current?.focus());
  };

  const handleImportInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    void importFile(file);
  };

  const handleProjectImportInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    void importProjectFile(file);
  };

  const getDroppedImportFile = (event: DragEvent<HTMLElement>) => {
    return Array.from(event.dataTransfer.files).find(isSupportedImportFileDescriptor);
  };

  const handleEmptyWorkspaceDragOver = (event: DragEvent<HTMLElement>) => {
    if (!getDroppedImportFile(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setEmptyDropActive(true);
  };

  const handleEmptyWorkspaceDragLeave = (event: DragEvent<HTMLElement>) => {
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
      return;
    }

    setEmptyDropActive(false);
  };

  const handleEmptyWorkspaceDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setEmptyDropActive(false);

    const importedFile = getDroppedImportFile(event);
    if (!importedFile) {
      showToast("Drop a supported file.", "error");
      return;
    }

    void importFile(importedFile);
  };

  return {
    emptyDropActive,
    copyCurrentFile,
    downloadCurrentFile,
    downloadProject,
    downloadProjectArchive,
    handleImportInputChange,
    handleProjectImportInputChange,
    handleEmptyWorkspaceDragOver,
    handleEmptyWorkspaceDragLeave,
    handleEmptyWorkspaceDrop,
  };
}
