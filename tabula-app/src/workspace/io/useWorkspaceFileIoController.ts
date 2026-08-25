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
  type ExternalChangeResolution,
  type WorkspaceKnowledgeBaseline,
  type WorkspaceSnapshot,
  type WorkspaceSourceAdapter,
  type WorkspaceSourceKind,
} from "@tabula-md/tabula";
import { getWorkspaceKnowledgeDocuments } from "../workspaceKnowledgeModel";
import {
  createArtifactSnapshotFromWorkspace,
  createWorkspaceDraftFromArtifactSnapshot,
  getLiveFolderAutoSaveBlockReason,
  getLiveFolderWorkspaceWritePlan,
  isLiveFolderSupported,
  pickLiveFolderSourceAdapter,
} from "./workspaceLiveFolder";

export type LiveFolderConflictReview = {
  resolution: Extract<ExternalChangeResolution, { type: "conflict-review" }>;
  externalSnapshot: WorkspaceSnapshot;
  localSnapshot: WorkspaceSnapshot;
};

export type LiveFolderSaveStatus =
  | "ready"
  | "dirty"
  | "saving"
  | "conflict"
  | "permission-required"
  | "error";

type ActiveLiveFolder = {
  adapter: WorkspaceSourceAdapter;
  baseline: WorkspaceSnapshot;
};

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
  replaceKnowledgeBaseline,
  replaceWorkspace,
  showToast,
  onCloseChrome,
}: UseWorkspaceFileIoControllerArgs) {
  const [emptyDropActive, setEmptyDropActive] = useState(false);
  const [workspaceFolderImport, setWorkspaceFolderImport] =
    useState<WorkspaceFolderImportDraft | null>(null);
  const pendingLiveFolderRef = useRef<{
    adapter: WorkspaceSourceAdapter;
  } | null>(null);
  const activeLiveFolderRef = useRef<ActiveLiveFolder | null>(null);
  const liveFolderWriteQueueRef = useRef(Promise.resolve());
  const [workspaceSourceKind, setWorkspaceSourceKind] =
    useState<WorkspaceSourceKind>("browser-copy");
  const [workspaceSourceLabel, setWorkspaceSourceLabel] = useState<string>();
  const [liveFolderAutoSave, setLiveFolderAutoSave] = useState(false);
  const [liveFolderSaveStatus, setLiveFolderSaveStatus] =
    useState<LiveFolderSaveStatus>("ready");
  const [liveFolderConflict, setLiveFolderConflict] =
    useState<LiveFolderConflictReview | null>(null);
  const [liveFolderConflictDialogOpen, setLiveFolderConflictDialogOpen] =
    useState(false);
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
    void exportWorkspaceSnapshot(workspaceSnapshot);
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
    setLiveFolderSaveStatus("ready");
    setLiveFolderConflict(null);
    setLiveFolderConflictDialogOpen(false);
    setWorkspaceSourceKind("browser-copy");
    setWorkspaceSourceLabel(undefined);
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
        setWorkspaceSourceLabel(pendingLiveFolder.adapter.source.label);
        setLiveFolderSaveStatus("ready");
      });
    } else {
      activeLiveFolderRef.current = null;
      setWorkspaceSourceKind("browser-copy");
      setWorkspaceSourceLabel(undefined);
      setLiveFolderSaveStatus("ready");
    }
    pendingLiveFolderRef.current = null;
    setWorkspaceFolderImport(null);
    onCloseChrome();
    syncUrlForLocalWorkspace("replace");
    queueAnimationFrameTask(() => editorRef.current?.focus());
  };

  const recoverExternalFolderChanges = async ({
    active,
    automatic,
    externalSnapshot,
    localSnapshot,
  }: {
    active: ActiveLiveFolder;
    automatic: boolean;
    externalSnapshot: WorkspaceSnapshot;
    localSnapshot: WorkspaceSnapshot;
  }) => {
    const { planExternalChangeResolution } = await import("@tabula-md/tabula");
    const {
      applySafeExternalChanges,
      getConflictReview,
    } = await import("./workspaceLiveFolderConflict");
    const resolutions = planExternalChangeResolution(
      active.baseline,
      localSnapshot,
      externalSnapshot,
    );
    const conflict = getConflictReview(resolutions);
    if (conflict) {
      setLiveFolderConflict({
        resolution: conflict,
        externalSnapshot,
        localSnapshot,
      });
      setLiveFolderConflictDialogOpen(true);
      setLiveFolderSaveStatus("conflict");
      setLiveFolderAutoSave(false);
      showToast(
        automatic
          ? copy.liveFolderAutoSavePausedExternal
          : copy.liveFolderWriteConflict,
        "error",
      );
      return;
    }

    const recoveredLocal = applySafeExternalChanges(localSnapshot, resolutions);
    active.baseline = applySafeExternalChanges(active.baseline, resolutions);
    await applyArtifactSnapshotToWorkspace(recoveredLocal);
    const remainingPlan = getLiveFolderWorkspaceWritePlan(
      active.baseline,
      recoveredLocal,
    );
    setLiveFolderSaveStatus(
      remainingPlan.changes.length > 0 || remainingPlan.deletes.length > 0
        ? "dirty"
        : "ready",
    );
    showToast(copy.liveFolderExternalChangesLoaded);
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
        setLiveFolderSaveStatus("saving");
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
          await recoverExternalFolderChanges({
            active,
            automatic,
            externalSnapshot: external!.snapshot,
            localSnapshot: local,
          });
          return;
        }
        if (plan.changes.length === 0 && plan.deletes.length === 0) {
          setLiveFolderSaveStatus("ready");
          if (!automatic) showToast(copy.liveFolderNoChanges);
          return;
        }
        if (autoSaveBlockReason === "delete") {
          setLiveFolderAutoSave(false);
          setLiveFolderSaveStatus("dirty");
          showToast(copy.liveFolderAutoSavePausedDelete);
          return;
        }
        if (
          plan.deletes.length > 0 &&
          !window.confirm(copy.confirmLiveFolderDelete)
        ) {
          setLiveFolderSaveStatus("dirty");
          return;
        }
        const result = await active.adapter.writeChanges?.([
          ...plan.changes,
          ...plan.deletes,
        ]);
        if (!result?.ok) {
          if (result?.reason === "conflict") {
            const latest = await active.adapter.readSnapshot();
            await recoverExternalFolderChanges({
              active,
              automatic,
              externalSnapshot: latest,
              localSnapshot: local,
            });
            return;
          }
          const permissionRequired = result?.reason === "permission";
          setLiveFolderSaveStatus(permissionRequired ? "permission-required" : "error");
          if (automatic) setLiveFolderAutoSave(false);
          showToast(
            permissionRequired
              ? copy.liveFolderPermissionLost
              : copy.liveFolderWriteFailed,
            "error",
            {
              actionLabel: copy.retryLiveFolderSave,
              onAction: () => queueLiveWorkspaceFolderSave(),
            },
          );
          return;
        }
        active.baseline = local;
        setLiveFolderSaveStatus("ready");
        if (!automatic) showToast(copy.liveFolderSaved);
      })
      .catch((error: unknown) => {
        clientErrorReporter.report({
          feature: "workspace",
          operation: "write-live-folder",
          error,
        });
        setLiveFolderSaveStatus("error");
        setLiveFolderAutoSave(false);
        showToast(copy.liveFolderWriteFailed, "error", {
          actionLabel: copy.retryLiveFolderSave,
          onAction: () => queueLiveWorkspaceFolderSave(),
        });
      });
  };

  const saveLiveWorkspaceFolder = () => queueLiveWorkspaceFolderSave();
  const toggleLiveFolderAutoSave = () => {
    if (!activeLiveFolderRef.current) return;
    setLiveFolderAutoSave((current) => !current);
  };

  const applyArtifactSnapshotToWorkspace = async (
    snapshot: WorkspaceSnapshot,
  ) => {
    const active = activeLiveFolderRef.current;
    if (!active) return;
    const previous = getWorkspaceSnapshot?.() ?? {
      files,
      folders,
      openFileIds,
      activeFileId,
    };
    const draft = await createWorkspaceDraftFromArtifactSnapshot(
      snapshot,
      active.adapter.source.label ?? "Workspace",
      {
        viewMode: preferences.newFileViewMode,
        readingWidth: preferences.readingWidth,
        lineWrapping: preferences.lineWrapping,
        lineNumbers: preferences.lineNumbers,
      },
      previous,
    );
    replaceWorkspace(draft.workspace);
    replaceKnowledgeBaseline(captureWorkspaceKnowledgeBaseline(
      getWorkspaceKnowledgeDocuments(draft.workspace.files, draft.workspace.folders),
    ));
  };

  const useExternalLiveFolderVersion = async () => {
    const review = liveFolderConflict;
    const active = activeLiveFolderRef.current;
    if (!review || !active) return;
    const { resolveConflictSnapshots } = await import("./workspaceLiveFolderConflict");
    const resolved = resolveConflictSnapshots({
      baseline: active.baseline,
      external: review.externalSnapshot,
      local: review.localSnapshot,
      resolution: review.resolution,
      workspaceReplacement: review.resolution.external,
    });
    active.baseline = resolved.baseline;
    setLiveFolderConflict(null);
    setLiveFolderConflictDialogOpen(false);
    const plan = getLiveFolderWorkspaceWritePlan(resolved.baseline, resolved.local);
    setLiveFolderSaveStatus(
      plan.changes.length > 0 || plan.deletes.length > 0 ? "dirty" : "ready",
    );
    void applyArtifactSnapshotToWorkspace(resolved.local);
  };

  const keepTabulaLiveFolderVersion = async () => {
    const review = liveFolderConflict;
    const active = activeLiveFolderRef.current;
    if (!review || !active?.adapter.writeChanges) return;
    const { getKeepTabulaChanges, resolveConflictSnapshots } =
      await import("./workspaceLiveFolderConflict");
    const changes = getKeepTabulaChanges(review.resolution);
    liveFolderWriteQueueRef.current = liveFolderWriteQueueRef.current
      .then(async () => {
        const result = await active.adapter.writeChanges?.(changes);
        if (!result?.ok) {
          const permissionRequired = result?.reason === "permission";
          setLiveFolderSaveStatus(permissionRequired ? "permission-required" : "error");
          showToast(
            permissionRequired ? copy.liveFolderPermissionLost : copy.liveFolderWriteFailed,
            "error",
          );
          return;
        }
        const resolved = resolveConflictSnapshots({
          baseline: active.baseline,
          external: review.externalSnapshot,
          local: review.localSnapshot,
          resolution: review.resolution,
          workspaceReplacement: review.resolution.local,
        });
        active.baseline = resolved.baseline;
        setLiveFolderConflict(null);
        setLiveFolderConflictDialogOpen(false);
        const plan = getLiveFolderWorkspaceWritePlan(resolved.baseline, resolved.local);
        setLiveFolderSaveStatus(
          plan.changes.length > 0 || plan.deletes.length > 0 ? "dirty" : "ready",
        );
        void applyArtifactSnapshotToWorkspace(resolved.local);
      });
  };

  const mergeLiveFolderConflictManually = async () => {
    const review = liveFolderConflict;
    const active = activeLiveFolderRef.current;
    if (!review || !active) return;
    const { createManualMergeArtifact, resolveConflictSnapshots } =
      await import("./workspaceLiveFolderConflict");
    const merged = await createManualMergeArtifact(review.resolution);
    if (merged) {
      const resolved = resolveConflictSnapshots({
        baseline: active.baseline,
        external: review.externalSnapshot,
        local: review.localSnapshot,
        resolution: review.resolution,
        workspaceReplacement: merged,
        baselineReplacement: review.resolution.external,
      });
      active.baseline = resolved.baseline;
      setLiveFolderConflict(null);
      setLiveFolderConflictDialogOpen(false);
      setLiveFolderSaveStatus("dirty");
      void applyArtifactSnapshotToWorkspace(resolved.local);
    }
  };

  useEffect(() => {
    const active = activeLiveFolderRef.current;
    if (isRoomSession || workspaceSourceKind !== "live-folder" || !active) return;
    let cancelled = false;
    void createArtifactSnapshotFromWorkspace(files, folders).then((local) => {
      if (cancelled) return;
      const plan = getLiveFolderWorkspaceWritePlan(active.baseline, local);
      const dirty = plan.changes.length > 0 || plan.deletes.length > 0;
      setLiveFolderSaveStatus((current) =>
        current === "saving" ||
        current === "conflict" ||
        current === "permission-required" ||
        current === "error"
          ? current
          : dirty
            ? "dirty"
            : "ready",
      );
    });
    return () => {
      cancelled = true;
    };
  }, [files, folders, isRoomSession, workspaceSourceKind]);

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
    workspaceSourceLabel,
    liveFolderAutoSave,
    liveFolderSaveStatus,
    liveFolderConflict,
    liveFolderConflictDialogOpen,
    copyFile,
    downloadCurrentFile,
    downloadWorkspaceArchive,
    disconnectLiveWorkspaceFolder,
    handleImportInputChange,
    handleWorkspaceImportInputChange,
    openLiveWorkspaceFolder,
    saveLiveWorkspaceFolder,
    toggleLiveFolderAutoSave,
    keepTabulaLiveFolderVersion,
    mergeLiveFolderConflictManually,
    deferLiveFolderConflict: () => setLiveFolderConflictDialogOpen(false),
    reviewLiveFolderConflict: () => {
      if (liveFolderConflict) setLiveFolderConflictDialogOpen(true);
    },
    useExternalLiveFolderVersion,
    handleEmptyWorkspaceDragOver,
    handleEmptyWorkspaceDragLeave,
    handleEmptyWorkspaceDrop,
    closeWorkspaceFolderImport,
    replaceWorkspaceWithFolder,
  };
}
