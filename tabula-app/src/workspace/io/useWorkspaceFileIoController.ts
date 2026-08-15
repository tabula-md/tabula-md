import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type RefObject,
} from "react";
import { clientErrorReporter } from "../../observability/clientErrorReporting";
import type { MarkdownEditorHandle } from "../../document/markdownEditorTypes";
import { createWorkspaceArchive } from "./workspaceArchive";
import {
  parseWorkspaceFolderImport,
  type WorkspaceFolderImportDraft,
} from "./workspaceFolderImport";
import {
  getWorkspaceName,
  syncUrlForLocalWorkspace,
  type WorkspaceFile,
  type WorkspaceFolder,
  type WorkspaceState,
} from "../workspaceStorage";
import {
  createCurrentFileDownloadDraft,
  createImportedWorkspaceFileDraft,
  isSupportedImportFileDescriptor,
} from "./workspaceIoModel";
import type { WorkspacePreferences } from "../state/useWorkspacePreferences";
import { useAnimationFrameTask } from "../../shared/useAnimationFrameTask";
import { writeIndexedDbWorkspace } from "../persistence/workspaceIndexedDb";
import { getWorkspaceIoCopy } from "./workspaceIoLocale";
import { productAnalytics } from "../../observability/productAnalytics";
import {
  captureWorkspaceKnowledgeBaseline,
  getWorkspaceArtifactBytes,
  type WorkspaceKnowledgeBaseline,
  type WorkspaceSnapshot,
  type WorkspaceSourceAdapter,
  type WorkspaceSourceKind,
} from "@tabula-md/tabula";
import { getWorkspaceKnowledgeDocuments } from "../workspaceKnowledgeModel";
import type { WorkspaceExportReview } from "./workspaceExportReviewModel";
import {
  createArtifactSnapshotFromWorkspace,
  getLiveFolderAutoSaveBlockReason,
  getLiveFolderWorkspaceWritePlan,
  isLiveFolderSupported,
  pickLiveFolderSourceAdapter,
} from "./workspaceLiveFolder";

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
  knowledgeBaseline?: WorkspaceKnowledgeBaseline;
  replaceKnowledgeBaseline: (baseline?: WorkspaceKnowledgeBaseline) => void;
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
  knowledgeBaseline,
  replaceKnowledgeBaseline,
  replaceWorkspace,
  showToast,
  onCloseChrome,
}: UseWorkspaceFileIoControllerArgs) {
  const [emptyDropActive, setEmptyDropActive] = useState(false);
  const [workspaceFolderImport, setWorkspaceFolderImport] =
    useState<WorkspaceFolderImportDraft | null>(null);
  const [pendingWorkspaceExport, setPendingWorkspaceExport] = useState<{
    review: WorkspaceExportReview;
    snapshot: Pick<WorkspaceState, "files" | "folders" | "openFileIds" | "activeFileId">;
  } | null>(null);
  const pendingLiveFolderRef = useRef<{
    adapter: WorkspaceSourceAdapter;
  } | null>(null);
  const activeLiveFolderRef = useRef<{
    adapter: WorkspaceSourceAdapter;
    baseline: WorkspaceSnapshot;
  } | null>(null);
  const liveFolderWriteQueueRef = useRef(Promise.resolve());
  const [workspaceSourceKind, setWorkspaceSourceKind] =
    useState<WorkspaceSourceKind>("browser-copy");
  const [liveFolderAutoSave, setLiveFolderAutoSave] = useState(false);
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

  const exportWorkspaceSnapshot = async (
    workspaceSnapshot: Pick<
      WorkspaceState,
      "files" | "folders" | "openFileIds" | "activeFileId"
    >,
  ) => {
    try {
      const archive = await createWorkspaceArchive(workspaceSnapshot.files, workspaceSnapshot.folders);
      downloadBlobFile(`${getWorkspaceName(workspaceSnapshot.folders)}.zip`, archive);
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
  const downloadWorkspaceArchive = async () => {
    const workspaceSnapshot = getWorkspaceFileIoBoundaryWorkspaceSnapshot({
      activeFile,
      activeFileId,
      files,
      folders,
      getWorkspaceSnapshot,
      onBeforeWorkspaceBoundary,
      openFileIds,
    });
    const { getWorkspaceExportReview } = await import(
      "./workspaceExportReviewModel"
    );
    const review = getWorkspaceExportReview(
      workspaceSnapshot.files,
      workspaceSnapshot.folders,
      knowledgeBaseline,
    );
    if (!review) {
      void exportWorkspaceSnapshot(workspaceSnapshot);
      return;
    }
    setPendingWorkspaceExport({ review, snapshot: workspaceSnapshot });
  };
  const closeWorkspaceExportReview = () => setPendingWorkspaceExport(null);
  const confirmWorkspaceArchiveExport = () => {
    if (!pendingWorkspaceExport) return;
    const { snapshot } = pendingWorkspaceExport;
    setPendingWorkspaceExport(null);
    void exportWorkspaceSnapshot(snapshot);
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
    pendingLiveFolderRef.current = null;

    void parseWorkspaceFolderImport(selectedFiles, {
      viewMode: preferences.newFileViewMode,
      readingWidth: preferences.readingWidth,
      lineWrapping: preferences.lineWrapping,
      lineNumbers: preferences.lineNumbers,
    }).then((draft) => {
      onCloseChrome();
      setWorkspaceFolderImport(draft);
    }).catch((error: unknown) => {
      clientErrorReporter.report({ feature: "workspace", operation: "open-folder", error });
      showToast(copy.openFailed, "error");
    });
  };

  const closeWorkspaceFolderImport = () => {
    pendingLiveFolderRef.current = null;
    setWorkspaceFolderImport(null);
  };

  const disconnectLiveWorkspaceFolder = () => {
    pendingLiveFolderRef.current = null;
    activeLiveFolderRef.current = null;
    setLiveFolderAutoSave(false);
    setWorkspaceSourceKind("browser-copy");
  };

  const openLiveWorkspaceFolder = () => {
    if (isRoomSession || !isLiveFolderSupported()) return;
    void pickLiveFolderSourceAdapter().then(async (adapter) => {
      if (!adapter) return;
      const sourceSnapshot = await adapter.readSnapshot();
      const selectedRoot = adapter.source.label ?? "Workspace";
      const selectedFiles = sourceSnapshot.artifacts.map((artifact) => {
        const bytes = Uint8Array.from(
          getWorkspaceArtifactBytes(artifact.content),
        );
        const name = artifact.path.split("/").at(-1) ?? artifact.path;
        const file = new File([bytes], name, {
          type: artifact.mediaType,
        });
        Object.defineProperty(file, "webkitRelativePath", {
          configurable: true,
          value: `${selectedRoot}/${artifact.path}`,
        });
        return file;
      });
      const draft = await parseWorkspaceFolderImport(selectedFiles, {
        viewMode: preferences.newFileViewMode,
        readingWidth: preferences.readingWidth,
        lineWrapping: preferences.lineWrapping,
        lineNumbers: preferences.lineNumbers,
      });
      pendingLiveFolderRef.current = { adapter };
      onCloseChrome();
      setWorkspaceFolderImport(draft);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      clientErrorReporter.report({
        feature: "workspace",
        operation: "open-live-folder",
        error,
      });
      showToast(copy.openFailed, "error");
    });
  };

  const replaceWorkspaceWithFolder = () => {
    if (!workspaceFolderImport || isRoomSession) return;
    const knowledgeBaseline = captureWorkspaceKnowledgeBaseline(
      getWorkspaceKnowledgeDocuments(
        workspaceFolderImport.workspace.files,
        workspaceFolderImport.workspace.folders,
      ),
    );
    const nextWorkspace = {
      ...workspaceFolderImport.workspace,
      commentsByFileId: {},
      knowledgeBaseline,
    };
    const pendingLiveFolder = pendingLiveFolderRef.current;
    onBeforeWorkspaceBoundary?.();
    replaceWorkspace(nextWorkspace);
    replaceKnowledgeBaseline(knowledgeBaseline);
    productAnalytics.report("file_created_or_opened", {
      documentSource: "folder",
    });
    replaceCommentsByFileId({});
    clearFileHistory();
    void writeIndexedDbWorkspace(nextWorkspace).catch((error: unknown) => {
      clientErrorReporter.report({ feature: "workspace", operation: "persist-open-folder", error });
      showToast(copy.saveOpenedWorkspaceFailed, "error");
    });
    if (pendingLiveFolder) {
      void createArtifactSnapshotFromWorkspace(
        nextWorkspace.files,
        nextWorkspace.folders,
      ).then((baseline) => {
        activeLiveFolderRef.current = {
          adapter: pendingLiveFolder.adapter,
          baseline,
        };
        setWorkspaceSourceKind("live-folder");
      });
    } else {
      activeLiveFolderRef.current = null;
      setWorkspaceSourceKind("browser-copy");
    }
    pendingLiveFolderRef.current = null;
    setWorkspaceFolderImport(null);
    onCloseChrome();
    syncUrlForLocalWorkspace("replace");
    queueAnimationFrameTask(() => editorRef.current?.focus());
  };

  const queueLiveWorkspaceFolderSave = ({ automatic = false } = {}) => {
    if (isRoomSession || !activeLiveFolderRef.current) return;
    const workspaceSnapshot = getWorkspaceFileIoBoundaryWorkspaceSnapshot({
      activeFile,
      activeFileId,
      files,
      folders,
      getWorkspaceSnapshot,
      onBeforeWorkspaceBoundary,
      openFileIds,
    });
    liveFolderWriteQueueRef.current = liveFolderWriteQueueRef.current
      .then(async () => {
        const active = activeLiveFolderRef.current;
        if (!active) return;
        const local = await createArtifactSnapshotFromWorkspace(
          workspaceSnapshot.files,
          workspaceSnapshot.folders,
        );
        const external = await active.adapter.checkExternalChanges?.(
          active.baseline,
        );
        const plan = getLiveFolderWorkspaceWritePlan(active.baseline, local);
        const autoSaveBlockReason = automatic
          ? getLiveFolderAutoSaveBlockReason({
              externalChangeCount: external?.changes.length ?? 0,
              deleteCount: plan.deletes.length,
            })
          : external && external.changes.length > 0
            ? "external-change"
            : null;
        if (autoSaveBlockReason === "external-change") {
          if (automatic) {
            setLiveFolderAutoSave(false);
            showToast(copy.liveFolderAutoSavePausedExternal, "error");
          } else {
            showToast(copy.liveFolderWriteConflict, "error");
          }
          return;
        }
        if (plan.changes.length === 0 && plan.deletes.length === 0) {
          if (!automatic) showToast(copy.liveFolderNoChanges);
          return;
        }
        if (autoSaveBlockReason === "delete") {
          setLiveFolderAutoSave(false);
          showToast(copy.liveFolderAutoSavePausedDelete);
          return;
        }
        if (
          plan.deletes.length > 0 &&
          !window.confirm(copy.confirmLiveFolderDelete)
        ) {
          return;
        }
        const result = await active.adapter.writeChanges?.([
          ...plan.changes,
          ...plan.deletes,
        ]);
        if (!result?.ok) {
          showToast(
            result?.reason === "permission"
              ? copy.liveFolderPermissionLost
              : copy.liveFolderWriteConflict,
            "error",
          );
          return;
        }
        active.baseline = result.snapshot ?? local;
        if (!automatic) showToast(copy.liveFolderSaved);
      })
      .catch((error: unknown) => {
        clientErrorReporter.report({
          feature: "workspace",
          operation: "write-live-folder",
          error,
        });
        showToast(copy.liveFolderWriteFailed, "error");
      });
  };

  const saveLiveWorkspaceFolder = () => queueLiveWorkspaceFolderSave();
  const toggleLiveFolderAutoSave = () => {
    if (!activeLiveFolderRef.current) return;
    setLiveFolderAutoSave((current) => !current);
  };

  useEffect(() => {
    if (
      isRoomSession ||
      workspaceSourceKind !== "live-folder" ||
      !liveFolderAutoSave
    ) return;
    const timer = window.setTimeout(() => {
      queueLiveWorkspaceFolderSave({ automatic: true });
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [files, folders, isRoomSession, liveFolderAutoSave, workspaceSourceKind]);

  useEffect(() => {
    if (isRoomSession) disconnectLiveWorkspaceFolder();
  }, [isRoomSession]);

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
    isLiveFolderSupported: isLiveFolderSupported(),
    workspaceFolderImport,
    workspaceSourceKind,
    liveFolderAutoSave,
    workspaceExportReview: pendingWorkspaceExport?.review ?? null,
    copyFile,
    downloadCurrentFile,
    downloadWorkspaceArchive,
    disconnectLiveWorkspaceFolder,
    closeWorkspaceExportReview,
    confirmWorkspaceArchiveExport,
    handleImportInputChange,
    handleWorkspaceImportInputChange,
    openLiveWorkspaceFolder,
    saveLiveWorkspaceFolder,
    toggleLiveFolderAutoSave,
    handleEmptyWorkspaceDragOver,
    handleEmptyWorkspaceDragLeave,
    handleEmptyWorkspaceDrop,
    closeWorkspaceFolderImport,
    replaceWorkspaceWithFolder,
  };
}
