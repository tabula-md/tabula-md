import { useState, type ChangeEvent, type DragEvent, type RefObject } from "react";
import { clientErrorReporter } from "../observability/clientErrorReporting";
import type { MarkdownEditorHandle } from "../markdownEditorTypes";
import { WORKSPACE_EXPORT_FILE_PREFIX } from "../product";
import { createWorkspaceArchive } from "../workspaceArchive";
import { parseWorkspaceFolderFiles } from "../workspaceFolderImport";
import {
  syncUrlForLocalWorkspace,
  type WorkspaceFile,
  type WorkspaceFolder,
  type WorkspaceState,
} from "../workspaceStorage";
import {
  createCurrentFileDownloadDraft,
  createImportedWorkspaceFileDraft,
  isSupportedImportFileDescriptor,
} from "../workspaceIoModel";
import type { WorkspacePreferences } from "./useWorkspacePreferences";
import { useAnimationFrameTask } from "./useAnimationFrameTask";
import { writeIndexedDbWorkspace } from "../workspaceIndexedDb";
import { getWorkspaceIoCopy } from "../workspaceIoLocale";
import { productAnalytics } from "../observability/productAnalytics";

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

type UseWorkspaceFileIoControllerArgs = {
  activeFile?: WorkspaceFile;
  isRoomSession: boolean;
  activeFileId: string;
  addFileFromContent: (
    title: string,
    text: string,
    viewMode?: WorkspaceFile["viewMode"],
    overrides?: Partial<WorkspaceFile>,
  ) => WorkspaceFile;
  clearFileHistory: () => void;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  getWorkspaceSnapshot?: () => Pick<WorkspaceState, "files" | "folders" | "openFileIds" | "activeFileId">;
  openFileIds: string[];
  onBeforeWorkspaceBoundary?: () => void;
  preferences: WorkspacePreferences;
  replaceCommentsByFileId: (commentsByFileId: WorkspaceState["commentsByFileId"]) => void;
  replaceWorkspace: (
    workspace: Pick<WorkspaceState, "files" | "folders" | "openFileIds" | "activeFileId">,
  ) => WorkspaceFile | undefined;
  showToast: (message: string, tone?: "neutral" | "error", options?: { actionLabel?: string; onAction?: () => void }) => void;
  onCloseChrome: () => void;
};

export const getWorkspaceFileIoActiveFileSnapshot = ({
  activeFile,
  getActiveFileSnapshot,
}: {
  activeFile?: WorkspaceFile;
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
}) => getActiveFileSnapshot?.() ?? activeFile;

export const getWorkspaceFileIoWorkspaceSnapshot = ({
  activeFile,
  activeFileId,
  files,
  folders,
  getWorkspaceSnapshot,
  openFileIds,
}: {
  activeFile?: WorkspaceFile;
  activeFileId: string;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  getWorkspaceSnapshot?: () => Pick<WorkspaceState, "files" | "folders" | "openFileIds" | "activeFileId">;
  openFileIds: string[];
}) =>
  getWorkspaceSnapshot?.() ?? {
    files,
    folders,
    openFileIds,
    activeFileId: activeFile?.id ?? activeFileId,
  };

export const getWorkspaceFileIoBoundaryActiveFileSnapshot = ({
  activeFile,
  getActiveFileSnapshot,
  onBeforeWorkspaceBoundary,
}: {
  activeFile?: WorkspaceFile;
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  onBeforeWorkspaceBoundary?: () => void;
}) => {
  onBeforeWorkspaceBoundary?.();
  return getWorkspaceFileIoActiveFileSnapshot({ activeFile, getActiveFileSnapshot });
};

export const getWorkspaceFileIoBoundaryWorkspaceSnapshot = ({
  activeFile,
  activeFileId,
  files,
  folders,
  getWorkspaceSnapshot,
  onBeforeWorkspaceBoundary,
  openFileIds,
}: {
  activeFile?: WorkspaceFile;
  activeFileId: string;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  getWorkspaceSnapshot?: () => Pick<WorkspaceState, "files" | "folders" | "openFileIds" | "activeFileId">;
  onBeforeWorkspaceBoundary?: () => void;
  openFileIds: string[];
}) => {
  onBeforeWorkspaceBoundary?.();
  return getWorkspaceFileIoWorkspaceSnapshot({
    activeFile,
    activeFileId,
    files,
    folders,
    getWorkspaceSnapshot,
    openFileIds,
  });
};

export function useWorkspaceFileIoController({
  activeFile,
  isRoomSession,
  activeFileId,
  addFileFromContent,
  clearFileHistory,
  editorRef,
  files,
  folders,
  getActiveFileSnapshot,
  getWorkspaceSnapshot,
  openFileIds,
  onBeforeWorkspaceBoundary,
  preferences,
  replaceCommentsByFileId,
  replaceWorkspace,
  showToast,
  onCloseChrome,
}: UseWorkspaceFileIoControllerArgs) {
  const [emptyDropActive, setEmptyDropActive] = useState(false);
  const [workspaceFolderImport, setWorkspaceFolderImport] = useState<WorkspaceState | null>(null);
  const queueAnimationFrameTask = useAnimationFrameTask();
  const copy = getWorkspaceIoCopy(preferences.language);

  const copyFile = async (fileId: string) => {
    onBeforeWorkspaceBoundary?.();
    const fileSnapshot = fileId === activeFile?.id
      ? getWorkspaceFileIoActiveFileSnapshot({ activeFile, getActiveFileSnapshot })
      : files.find((file) => file.id === fileId);
    if (!fileSnapshot) {
      return;
    }

    await navigator.clipboard.writeText(fileSnapshot.text);
    showToast(copy.fileCopied);
  };

  const downloadCurrentFile = () => {
    const fileSnapshot = getWorkspaceFileIoBoundaryActiveFileSnapshot({
      activeFile,
      getActiveFileSnapshot,
      onBeforeWorkspaceBoundary,
    });
    if (!fileSnapshot) {
      return;
    }

    const download = createCurrentFileDownloadDraft(fileSnapshot);
    downloadTextFile(download.fileName, download.content, download.type);
    showToast(copy.fileDownloaded);
  };

  const downloadWorkspaceArchive = async () => {
    try {
      const workspaceSnapshot = getWorkspaceFileIoBoundaryWorkspaceSnapshot({
        activeFile,
        activeFileId,
        files,
        folders,
        getWorkspaceSnapshot,
        onBeforeWorkspaceBoundary,
        openFileIds,
      });
      const archive = await createWorkspaceArchive(workspaceSnapshot.files, workspaceSnapshot.folders);
      downloadBlobFile(`${WORKSPACE_EXPORT_FILE_PREFIX}.zip`, archive);
      showToast(copy.workspaceDownloaded);
    } catch (error) {
      clientErrorReporter.report({
        feature: "workspace",
        operation: "export-archive",
        error,
      });
      showToast(copy.exportFailed, "error");
    }
  };

  const importFile = async (file: File) => {
    const importedText = await file.text();
    const importedFileDraft = createImportedWorkspaceFileDraft(file.name, importedText, preferences);
    onBeforeWorkspaceBoundary?.();
    addFileFromContent(
      importedFileDraft.title,
      importedFileDraft.text,
      importedFileDraft.viewMode,
      importedFileDraft.overrides,
    );
    productAnalytics.report("file_created_or_opened", {
      documentSource: "markdown_file",
    });
    onCloseChrome();
    if (!isRoomSession) syncUrlForLocalWorkspace();

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

  const handleWorkspaceImportInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selectedFiles.length === 0) return;

    void parseWorkspaceFolderFiles(selectedFiles, {
      viewMode: preferences.newFileViewMode,
      readingWidth: preferences.readingWidth,
      lineWrapping: preferences.lineWrapping,
      lineNumbers: preferences.lineNumbers,
    }).then((workspace) => {
      onCloseChrome();
      setWorkspaceFolderImport(workspace);
    }).catch((error: unknown) => {
      clientErrorReporter.report({ feature: "workspace", operation: "open-folder", error });
      showToast(copy.openFailed, "error");
    });
  };

  const closeWorkspaceFolderImport = () => setWorkspaceFolderImport(null);

  const replaceWorkspaceWithFolder = () => {
    if (!workspaceFolderImport || isRoomSession) return;
    const nextWorkspace = { ...workspaceFolderImport, commentsByFileId: {} };
    onBeforeWorkspaceBoundary?.();
    replaceWorkspace(nextWorkspace);
    productAnalytics.report("file_created_or_opened", {
      documentSource: "folder",
    });
    replaceCommentsByFileId({});
    clearFileHistory();
    void writeIndexedDbWorkspace(nextWorkspace).catch((error: unknown) => {
      clientErrorReporter.report({ feature: "workspace", operation: "persist-open-folder", error });
      showToast(copy.saveOpenedWorkspaceFailed, "error");
    });
    setWorkspaceFolderImport(null);
    onCloseChrome();
    syncUrlForLocalWorkspace("replace");
    queueAnimationFrameTask(() => editorRef.current?.focus());
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
      showToast(copy.unsupportedDrop, "error");
      return;
    }

    void importFile(importedFile);
  };

  return {
    emptyDropActive,
    workspaceFolderImport,
    copyFile,
    downloadCurrentFile,
    downloadWorkspaceArchive,
    handleImportInputChange,
    handleWorkspaceImportInputChange,
    handleEmptyWorkspaceDragOver,
    handleEmptyWorkspaceDragLeave,
    handleEmptyWorkspaceDrop,
    closeWorkspaceFolderImport,
    replaceWorkspaceWithFolder,
  };
}
