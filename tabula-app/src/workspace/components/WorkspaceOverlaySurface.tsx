import { lazy, Suspense } from "react";
import { AppToast } from "../../ui/AppToast";
import { TooltipLayer } from "../../ui/TooltipLayer";
import type { AppToastState } from "../../ui/useAppToast";
import type { WorkspaceFile, WorkspaceFolder, WorkspaceState } from "../workspaceStorage";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getWorkspaceSurfaceCopy } from "../workspaceSurfaceLocale";
import type { WorkspaceInfoDialogKind } from "./WorkspaceInfoDialog";
import type { ShortcutPlatform } from "../keyboardShortcuts";
import type { WorkspaceExportReview } from "../io/workspaceExportReviewModel";
import type { WorkspaceFolderImportDraft } from "../io/workspaceFolderImport";
import type { LiveFolderConflictReview } from "../io/useWorkspaceFileIoController";

const WorkspaceFolderImportDialog = lazy(() =>
  import("./WorkspaceFolderImportDialog").then((module) => ({
    default: module.WorkspaceFolderImportDialog,
  }))
);
const WorkspaceInfoDialog = lazy(() =>
  import("./WorkspaceInfoDialog").then((module) => ({
    default: module.WorkspaceInfoDialog,
  }))
);
const JsonShareImportOverlay = lazy(() =>
  import("./JsonShareImportOverlay").then((module) => ({
    default: module.JsonShareImportOverlay,
  }))
);
const WorkspaceExportReviewDialog = lazy(() =>
  import("./WorkspaceExportReviewDialog").then((module) => ({
    default: module.WorkspaceExportReviewDialog,
  }))
);
const LiveFolderConflictDialog = lazy(() =>
  import("./LiveFolderConflictDialog").then((module) => ({
    default: module.LiveFolderConflictDialog,
  }))
);
const WorkspaceLauncher = lazy(() =>
  import("./WorkspaceLauncher").then((module) => ({ default: module.WorkspaceLauncher }))
);

type JsonShareImportState =
  | { status: "loading" }
  | { status: "error"; errorMessage: string }
  | { status: "ready"; workspace: WorkspaceState };

export type WorkspaceOverlaySurfaceProps = {
  infoDialog: WorkspaceInfoDialogKind | null;
  workspaceFolderImport: WorkspaceFolderImportDraft | null;
  workspaceExportReview: WorkspaceExportReview | null;
  jsonShareImport: JsonShareImportState | null;
  liveFolderConflict: LiveFolderConflictReview | null;
  language: WorkspaceLanguage;
  shortcutPlatform: ShortcutPlatform;
  toast: AppToastState | null;
  launcher?: {
    files: WorkspaceFile[];
    folders: WorkspaceFolder[];
    openFileIds: readonly string[];
    activeFileId?: string;
    onClose: () => void;
    onSelectFile: (fileId: string) => void;
    onNewFile: () => void;
    onNewFolder: () => void;
    onImportFile: () => void;
    onImportWorkspace: () => void;
    onOpenPreferences: () => void;
  };
  onDismissToast: () => void;
  onCloseInfoDialog: () => void;
  onCloseWorkspaceFolderImport: () => void;
  onCloseWorkspaceExportReview: () => void;
  onPauseToast: () => void;
  onResumeToast: () => void;
  onCloseJsonShareImport: () => void;
  onReplaceWorkspaceWithJsonShare: (workspace: WorkspaceState) => void;
  onReplaceWorkspaceWithFolder: () => void;
  onKeepTabulaLiveFolderVersion: () => void;
  onMergeLiveFolderConflictManually: () => void;
  onUseExternalLiveFolderVersion: () => void;
  onConfirmWorkspaceExport: () => void;
  onReviewWorkspaceExportIssues: () => void;
};

export function WorkspaceOverlaySurface({
  infoDialog,
  workspaceFolderImport,
  workspaceExportReview,
  jsonShareImport,
  liveFolderConflict,
  language,
  shortcutPlatform,
  toast,
  launcher,
  onDismissToast,
  onCloseInfoDialog,
  onCloseWorkspaceFolderImport,
  onCloseWorkspaceExportReview,
  onPauseToast,
  onResumeToast,
  onCloseJsonShareImport,
  onReplaceWorkspaceWithJsonShare,
  onReplaceWorkspaceWithFolder,
  onKeepTabulaLiveFolderVersion,
  onMergeLiveFolderConflictManually,
  onUseExternalLiveFolderVersion,
  onConfirmWorkspaceExport,
  onReviewWorkspaceExportIssues,
}: WorkspaceOverlaySurfaceProps) {
  const copy = getWorkspaceSurfaceCopy(language);
  return (
    <>
      <TooltipLayer />
      {launcher && <Suspense fallback={null}><WorkspaceLauncher {...launcher} /></Suspense>}
      {infoDialog && (
        <Suspense fallback={null}>
          <WorkspaceInfoDialog
            kind={infoDialog}
            language={language}
            shortcutPlatform={shortcutPlatform}
            onClose={onCloseInfoDialog}
          />
        </Suspense>
      )}
      {workspaceFolderImport && (
        <Suspense fallback={null}>
          <WorkspaceFolderImportDialog
            language={language}
            workspace={workspaceFolderImport.workspace}
            profile={workspaceFolderImport.profile}
            onCancel={onCloseWorkspaceFolderImport}
            onReplace={onReplaceWorkspaceWithFolder}
          />
        </Suspense>
      )}
      {workspaceExportReview && (
        <Suspense fallback={null}>
          <WorkspaceExportReviewDialog
            language={language}
            review={workspaceExportReview}
            onCancel={onCloseWorkspaceExportReview}
            onExport={onConfirmWorkspaceExport}
            onReviewIssues={onReviewWorkspaceExportIssues}
          />
        </Suspense>
      )}
      {liveFolderConflict && (
        <Suspense fallback={null}>
          <LiveFolderConflictDialog
            language={language}
            review={liveFolderConflict}
            onKeepTabula={onKeepTabulaLiveFolderVersion}
            onMergeManually={onMergeLiveFolderConflictManually}
            onUseExternal={onUseExternalLiveFolderVersion}
          />
        </Suspense>
      )}
      {toast && (
        <AppToast
          key={toast.id}
          dismissLabel={copy.dismissNotification}
          message={toast.message}
          tone={toast.tone}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          onDismiss={onDismissToast}
          onPause={onPauseToast}
          onResume={onResumeToast}
        />
      )}
      {jsonShareImport && (
        <Suspense fallback={null}><JsonShareImportOverlay
          state={jsonShareImport}
          language={language}
          onCancel={onCloseJsonShareImport}
          onReplace={onReplaceWorkspaceWithJsonShare}
        /></Suspense>
      )}
    </>
  );
}
