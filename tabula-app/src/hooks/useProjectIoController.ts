import { useState, type ChangeEvent, type DragEvent, type RefObject } from "react";
import { clientErrorReporter } from "../observability/clientErrorReporting";
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
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  getWorkspaceSnapshot?: () => Pick<WorkspaceState, "files" | "openFileIds" | "activeFileId">;
  openFileIds: string[];
  onBeforeWorkspaceBoundary?: () => void;
  preferences: WorkspacePreferences;
  replaceCommentsByFileId: (commentsByFileId: Record<string, FileComment[]>) => void;
  replaceWorkspace: (workspace: Pick<WorkspaceState, "files" | "openFileIds" | "activeFileId">) => WorkspaceFile | undefined;
  resetCollaborationState: (nextStatus: WorkspaceFile["connectionStatus"]) => void;
  showToast: (message: string, tone?: "neutral" | "error", options?: { actionLabel?: string; onAction?: () => void }) => void;
  clearFileHistory: () => void;
  onCloseChrome: () => void;
};

export const getProjectIoActiveFileSnapshot = ({
  activeFile,
  getActiveFileSnapshot,
}: {
  activeFile?: WorkspaceFile;
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
}) => getActiveFileSnapshot?.() ?? activeFile;

export const getProjectIoWorkspaceSnapshot = ({
  activeFile,
  activeFileId,
  files,
  getWorkspaceSnapshot,
  openFileIds,
}: {
  activeFile?: WorkspaceFile;
  activeFileId: string;
  files: WorkspaceFile[];
  getWorkspaceSnapshot?: () => Pick<WorkspaceState, "files" | "openFileIds" | "activeFileId">;
  openFileIds: string[];
}) =>
  getWorkspaceSnapshot?.() ?? {
    files,
    openFileIds,
    activeFileId: activeFile?.id ?? activeFileId,
  };

export const getProjectIoBoundaryActiveFileSnapshot = ({
  activeFile,
  getActiveFileSnapshot,
  onBeforeWorkspaceBoundary,
}: {
  activeFile?: WorkspaceFile;
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  onBeforeWorkspaceBoundary?: () => void;
}) => {
  onBeforeWorkspaceBoundary?.();
  return getProjectIoActiveFileSnapshot({ activeFile, getActiveFileSnapshot });
};

export const getProjectIoBoundaryWorkspaceSnapshot = ({
  activeFile,
  activeFileId,
  files,
  getWorkspaceSnapshot,
  onBeforeWorkspaceBoundary,
  openFileIds,
}: {
  activeFile?: WorkspaceFile;
  activeFileId: string;
  files: WorkspaceFile[];
  getWorkspaceSnapshot?: () => Pick<WorkspaceState, "files" | "openFileIds" | "activeFileId">;
  onBeforeWorkspaceBoundary?: () => void;
  openFileIds: string[];
}) => {
  onBeforeWorkspaceBoundary?.();
  return getProjectIoWorkspaceSnapshot({
    activeFile,
    activeFileId,
    files,
    getWorkspaceSnapshot,
    openFileIds,
  });
};

export function useProjectIoController({
  activeFile,
  activeFileId,
  addFileFromContent,
  commentsByFileId,
  editorRef,
  files,
  getActiveFileSnapshot,
  getWorkspaceSnapshot,
  openFileIds,
  onBeforeWorkspaceBoundary,
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
    const fileSnapshot = getProjectIoBoundaryActiveFileSnapshot({
      activeFile,
      getActiveFileSnapshot,
      onBeforeWorkspaceBoundary,
    });
    if (!fileSnapshot) {
      return;
    }

    await navigator.clipboard.writeText(fileSnapshot.text);
    showToast("File copied.");
  };

  const downloadCurrentFile = () => {
    const fileSnapshot = getProjectIoBoundaryActiveFileSnapshot({
      activeFile,
      getActiveFileSnapshot,
      onBeforeWorkspaceBoundary,
    });
    if (!fileSnapshot) {
      return;
    }

    const download = createCurrentFileDownloadDraft(fileSnapshot);
    downloadTextFile(download.fileName, download.content, download.type);
    showToast("File downloaded.");
  };

  const downloadProject = () => {
    const workspaceSnapshot = getProjectIoBoundaryWorkspaceSnapshot({
      activeFile,
      activeFileId,
      files,
      getWorkspaceSnapshot,
      onBeforeWorkspaceBoundary,
      openFileIds,
    });
    const download = createWorkspaceProjectDownloadDraft({
      files: workspaceSnapshot.files,
      openFileIds: workspaceSnapshot.openFileIds,
      activeFileId: workspaceSnapshot.activeFileId,
      commentsByFileId,
    });
    downloadTextFile(download.fileName, download.content, download.type);
    showToast("Project downloaded.");
  };

  const downloadProjectArchive = (fileIds?: readonly string[]) => {
    try {
      const workspaceSnapshot = getProjectIoBoundaryWorkspaceSnapshot({
        activeFile,
        activeFileId,
        files,
        getWorkspaceSnapshot,
        onBeforeWorkspaceBoundary,
        openFileIds,
      });
      const includedFileIds = fileIds ? new Set(fileIds) : null;
      const archiveFiles = includedFileIds
        ? workspaceSnapshot.files.filter((file) => includedFileIds.has(file.id))
        : workspaceSnapshot.files;
      const archive = createProjectArchive(archiveFiles);
      downloadBlobFile(`${WORKSPACE_EXPORT_FILE_PREFIX}.zip`, archive);
      showToast("Project archive downloaded.");
    } catch (error) {
      clientErrorReporter.report({
        feature: "workspace",
        operation: "export-archive",
        error,
      });
      showToast("Couldn’t export to file.", "error");
    }
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

    onBeforeWorkspaceBoundary?.();
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
    onBeforeWorkspaceBoundary?.();
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
