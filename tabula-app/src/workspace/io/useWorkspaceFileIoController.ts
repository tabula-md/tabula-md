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
  createWorkspaceArtifact,
  planExternalChangeResolution,
  type ExternalChangeResolution,
  type WorkspaceKnowledgeBaseline,
  type WorkspaceSnapshot,
  type WorkspaceSourceAdapter,
  type WorkspaceSourceKind,
} from "@tabula-md/tabula";
import { getWorkspaceKnowledgeDocuments } from "../workspaceKnowledgeModel";
import type { WorkspaceExportReview } from "./workspaceExportReviewModel";
import {
  createArtifactSnapshotFromWorkspace,
  createWorkspaceDraftFromArtifactSnapshot,
  getLiveFolderWorkspaceWritePlan,
  isLiveFolderSupported,
  pickLiveFolderSourceAdapter,
} from "./workspaceLiveFolder";

export type LiveFolderConflictReview = {
  resolution: Extract<
    ExternalChangeResolution,
    { type: "conflict-review" }
  >;
  externalSnapshot: WorkspaceSnapshot;
  localSnapshot: WorkspaceSnapshot;
};

const replaceSnapshotArtifact = (
  snapshot: WorkspaceSnapshot,
  artifactId: string,
  replacement: WorkspaceSnapshot["artifacts"][number] | null,
): WorkspaceSnapshot => ({
  capturedAt: new Date().toISOString(),
  artifacts: replacement
    ? snapshot.artifacts.map((artifact) =>
        artifact.id === artifactId
          ? { ...replacement, id: artifactId }
          : artifact)
    : snapshot.artifacts.filter((artifact) => artifact.id !== artifactId),
});

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
  const [liveFolderConflict, setLiveFolderConflict] =
    useState<LiveFolderConflictReview | null>(null);
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
    setLiveFolderConflict(null);
    setWorkspaceSourceKind("browser-copy");
  };

  const openLiveWorkspaceFolder = () => {
    if (isRoomSession || !isLiveFolderSupported()) return;
    void pickLiveFolderSourceAdapter().then(async (adapter) => {
      if (!adapter) return;
      const sourceSnapshot = await adapter.readSnapshot();
      const selectedRoot = adapter.source.label ?? "Workspace";
      const draft = await createWorkspaceDraftFromArtifactSnapshot(
        sourceSnapshot,
        selectedRoot,
        {
        viewMode: preferences.newFileViewMode,
        readingWidth: preferences.readingWidth,
        lineWrapping: preferences.lineWrapping,
        lineNumbers: preferences.lineNumbers,
        },
      );
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

  const applyArtifactSnapshotToWorkspace = async (
    snapshot: WorkspaceSnapshot,
  ) => {
    const active = activeLiveFolderRef.current;
    if (!active) return null;
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
    const nextKnowledgeBaseline = captureWorkspaceKnowledgeBaseline(
      getWorkspaceKnowledgeDocuments(
        draft.workspace.files,
        draft.workspace.folders,
      ),
    );
    replaceWorkspace(draft.workspace);
    replaceKnowledgeBaseline(nextKnowledgeBaseline);
    return createArtifactSnapshotFromWorkspace(
      draft.workspace.files,
      draft.workspace.folders,
    );
  };

  const checkLiveFolderExternalChanges = () => {
    const active = activeLiveFolderRef.current;
    if (!active?.adapter.checkExternalChanges || liveFolderConflict) return;
    liveFolderWriteQueueRef.current = liveFolderWriteQueueRef.current
      .then(async () => {
        const current = activeLiveFolderRef.current;
        if (!current?.adapter.checkExternalChanges) return;
        const external = await current.adapter.checkExternalChanges(
          current.baseline,
        );
        if (external.changes.length === 0) return;
        const local = await createArtifactSnapshotFromWorkspace(
          getWorkspaceSnapshot?.().files ?? files,
          getWorkspaceSnapshot?.().folders ?? folders,
        );
        const resolutions = planExternalChangeResolution(
          current.baseline,
          local,
          external.snapshot,
        );
        const conflict = resolutions.find(
          (
            resolution,
          ): resolution is Extract<
            ExternalChangeResolution,
            { type: "conflict-review" }
          > => resolution.type === "conflict-review",
        );
        if (conflict) {
          setLiveFolderConflict({
            resolution: conflict,
            externalSnapshot: external.snapshot,
            localSnapshot: local,
          });
          return;
        }
        const nextBaseline = await applyArtifactSnapshotToWorkspace(
          external.snapshot,
        );
        if (nextBaseline) current.baseline = nextBaseline;
      })
      .catch((error: unknown) => {
        clientErrorReporter.report({
          feature: "workspace",
          operation: "check-live-folder",
          error,
        });
        showToast(copy.liveFolderCheckFailed, "error");
      });
  };

  const useExternalLiveFolderVersion = () => {
    const review = liveFolderConflict;
    const active = activeLiveFolderRef.current;
    if (!review || !active) return;
    const external = review.resolution.external;
    const localId = review.resolution.local.id;
    const resolvedLocal = replaceSnapshotArtifact(
      review.localSnapshot,
      localId,
      external,
    );
    const nextBaseline = replaceSnapshotArtifact(
      active.baseline,
      localId,
      external,
    );
    setLiveFolderConflict(null);
    void applyArtifactSnapshotToWorkspace(resolvedLocal).then((mapped) => {
      if (!mapped) return;
      const mappedReplacement = mapped.artifacts.find(
        (artifact) => artifact.id === localId,
      ) ?? null;
      active.baseline = replaceSnapshotArtifact(
        nextBaseline,
        localId,
        mappedReplacement,
      );
    });
  };

  const keepTabulaLiveFolderVersion = () => {
    const review = liveFolderConflict;
    const active = activeLiveFolderRef.current;
    if (!review || !active?.adapter.writeChanges) return;
    const { change, local } = review.resolution;
    const changes = change.type === "deleted"
      ? [{ type: "create" as const, artifact: local }]
      : change.type === "moved"
        ? [
            {
              type: "move" as const,
              artifactId: local.id,
              fromPath: change.external.path,
              toPath: local.path,
            },
            { type: "update" as const, artifact: local },
          ]
        : [{ type: "update" as const, artifact: local }];
    setLiveFolderConflict(null);
    liveFolderWriteQueueRef.current = liveFolderWriteQueueRef.current
      .then(async () => {
        const result = await active.adapter.writeChanges?.(changes);
        if (!result?.ok) {
          setLiveFolderConflict(review);
          showToast(copy.liveFolderWriteFailed, "error");
          return;
        }
        active.baseline = replaceSnapshotArtifact(
          active.baseline,
          local.id,
          local,
        );
      });
  };

  const mergeLiveFolderConflictManually = () => {
    const review = liveFolderConflict;
    const active = activeLiveFolderRef.current;
    if (!review || !active) return;
    const { external, local } = review.resolution;
    if (
      local.content.kind !== "text" ||
      (external && external.content.kind !== "text")
    ) {
      return;
    }
    const localText = local.content.text;
    const externalText =
      external?.content.kind === "text" ? external.content.text : "";
    void createWorkspaceArtifact({
      ...local,
      content: {
        kind: "text",
        encoding: "utf-8",
        text: [
          "<<<<<<< Tabula",
          localText,
          "=======",
          externalText,
          ">>>>>>> External",
        ].join("\n"),
      },
    }).then(async (merged) => {
      const resolvedLocal = replaceSnapshotArtifact(
        review.localSnapshot,
        local.id,
        merged,
      );
      active.baseline = replaceSnapshotArtifact(
        active.baseline,
        local.id,
        external,
      );
      setLiveFolderConflict(null);
      await applyArtifactSnapshotToWorkspace(resolvedLocal);
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

  useEffect(() => {
    if (
      isRoomSession ||
      !activeLiveFolderRef.current ||
      liveFolderConflict
    ) return;
    const timer = window.setTimeout(() => {
      const filesSnapshot = files;
      const foldersSnapshot = folders;
      liveFolderWriteQueueRef.current = liveFolderWriteQueueRef.current
        .then(async () => {
          const active = activeLiveFolderRef.current;
          if (!active) return;
          const local = await createArtifactSnapshotFromWorkspace(
            filesSnapshot,
            foldersSnapshot,
          );
          const plan = getLiveFolderWorkspaceWritePlan(
            active.baseline,
            local,
          );
          const deletes = plan.deletes.length > 0 &&
              window.confirm(copy.confirmLiveFolderDelete)
            ? plan.deletes
            : [];
          const changes = [...plan.changes, ...deletes];
          if (changes.length === 0) return;
          const result = await active.adapter.writeChanges?.(changes);
          if (!result?.ok) {
            showToast(
              result?.reason === "permission"
                ? copy.liveFolderPermissionLost
                : copy.liveFolderWriteConflict,
              "error",
            );
            return;
          }
          active.baseline = local;
        })
        .catch((error: unknown) => {
          clientErrorReporter.report({
            feature: "workspace",
            operation: "write-live-folder",
            error,
          });
          showToast(copy.liveFolderWriteFailed, "error");
        });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    copy,
    files,
    folders,
    isRoomSession,
    liveFolderConflict,
    showToast,
  ]);

  useEffect(() => {
    if (workspaceSourceKind !== "live-folder" || liveFolderConflict) return;
    const onFocus = () => checkLiveFolderExternalChanges();
    const interval = window.setInterval(
      checkLiveFolderExternalChanges,
      5_000,
    );
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [liveFolderConflict, workspaceSourceKind]);

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
    liveFolderConflict,
    workspaceFolderImport,
    workspaceSourceKind,
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
    keepTabulaLiveFolderVersion,
    mergeLiveFolderConflictManually,
    useExternalLiveFolderVersion,
    handleEmptyWorkspaceDragOver,
    handleEmptyWorkspaceDragLeave,
    handleEmptyWorkspaceDrop,
    closeWorkspaceFolderImport,
    replaceWorkspaceWithFolder,
  };
}
