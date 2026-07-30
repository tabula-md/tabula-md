import { lazy, Suspense } from "react";
import { AppToast } from "../../ui/AppToast";
import { JsonShareImportDialog } from "../../share/JsonShareImportDialog";
import { TooltipLayer } from "../../ui/TooltipLayer";
import type { AppToastState } from "../../ui/useAppToast";
import type { WorkspaceState } from "../workspaceStorage";
import { getWorkspaceArchiveEntries } from "../io/workspaceArchive";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getWorkspaceSurfaceCopy } from "../workspaceSurfaceLocale";
import {
  WorkspaceInfoDialog,
  type WorkspaceInfoDialogKind,
} from "./WorkspaceInfoDialog";
import type { ShortcutPlatform } from "../keyboardShortcuts";
import type { WorkspaceExportReview } from "../io/workspaceExportReviewModel";
import type { WorkspaceFolderImportDraft } from "../io/workspaceFolderImport";
import type { WorkspaceImportResult } from "../io/workspaceImportResultModel";

const WorkspaceFolderImportDialog = lazy(() =>
  import("./WorkspaceFolderImportDialog").then((module) => ({
    default: module.WorkspaceFolderImportDialog,
  }))
);
const WorkspaceExportReviewDialog = lazy(() =>
  import("./WorkspaceExportReviewDialog").then((module) => ({
    default: module.WorkspaceExportReviewDialog,
  }))
);
const WorkspaceImportResultDialog = lazy(() =>
  import("./WorkspaceImportResultDialog").then((module) => ({
    default: module.WorkspaceImportResultDialog,
  }))
);

type JsonShareImportState =
  | { status: "loading" }
  | { status: "error"; errorMessage: string }
  | { status: "ready"; workspace: WorkspaceState };

export type WorkspaceOverlaySurfaceProps = {
  hasCurrentWorkspace: boolean;
  infoDialog: WorkspaceInfoDialogKind | null;
  workspaceFolderImport: WorkspaceFolderImportDraft | null;
  workspaceImportResult: WorkspaceImportResult | null;
  workspaceExportReview: WorkspaceExportReview | null;
  jsonShareImport: JsonShareImportState | null;
  language: WorkspaceLanguage;
  shortcutPlatform: ShortcutPlatform;
  toast: AppToastState | null;
  onDismissToast: () => void;
  onCloseInfoDialog: () => void;
  onCloseWorkspaceFolderImport: () => void;
  onCloseWorkspaceImportResult: () => void;
  onCloseWorkspaceExportReview: () => void;
  onExportCurrentWorkspaceBeforeImport: () => void;
  onPauseToast: () => void;
  onResumeToast: () => void;
  onCloseJsonShareImport: () => void;
  onReplaceWorkspaceWithJsonShare: (workspace: WorkspaceState) => void;
  onReplaceWorkspaceWithFolder: () => void;
  onOpenImportedRootIndex: () => void;
  onReviewImportedWorkspace: () => void;
  onConfirmWorkspaceExport: () => void;
  onReviewWorkspaceExportIssues: () => void;
};

export function WorkspaceOverlaySurface({
  hasCurrentWorkspace,
  infoDialog,
  workspaceFolderImport,
  workspaceImportResult,
  workspaceExportReview,
  jsonShareImport,
  language,
  shortcutPlatform,
  toast,
  onDismissToast,
  onCloseInfoDialog,
  onCloseWorkspaceFolderImport,
  onCloseWorkspaceImportResult,
  onCloseWorkspaceExportReview,
  onExportCurrentWorkspaceBeforeImport,
  onPauseToast,
  onResumeToast,
  onCloseJsonShareImport,
  onReplaceWorkspaceWithJsonShare,
  onReplaceWorkspaceWithFolder,
  onOpenImportedRootIndex,
  onReviewImportedWorkspace,
  onConfirmWorkspaceExport,
  onReviewWorkspaceExportIssues,
}: WorkspaceOverlaySurfaceProps) {
  const copy = getWorkspaceSurfaceCopy(language);
  return (
    <>
      <TooltipLayer />
      {infoDialog && (
        <WorkspaceInfoDialog
          kind={infoDialog}
          language={language}
          shortcutPlatform={shortcutPlatform}
          onClose={onCloseInfoDialog}
        />
      )}
      {workspaceFolderImport && (
        <Suspense fallback={null}>
          <WorkspaceFolderImportDialog
            hasCurrentWorkspace={hasCurrentWorkspace}
            language={language}
            workspace={workspaceFolderImport.workspace}
            profile={workspaceFolderImport.profile}
            onCancel={onCloseWorkspaceFolderImport}
            onExportCurrentWorkspace={onExportCurrentWorkspaceBeforeImport}
            onReplace={onReplaceWorkspaceWithFolder}
          />
        </Suspense>
      )}
      {workspaceImportResult && (
        <Suspense fallback={null}>
          <WorkspaceImportResultDialog
            language={language}
            result={workspaceImportResult}
            onClose={onCloseWorkspaceImportResult}
            onOpenRootIndex={onOpenImportedRootIndex}
            onReviewWorkspace={onReviewImportedWorkspace}
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
        <JsonShareImportDialog
          status={jsonShareImport.status}
          language={language}
          fileCount={
            jsonShareImport.status === "ready"
              ? jsonShareImport.workspace.files.length
              : undefined
          }
          filePaths={
            jsonShareImport.status === "ready"
              ? getWorkspaceArchiveEntries(
                  jsonShareImport.workspace.files,
                  jsonShareImport.workspace.folders,
                ).filter((entry) => !entry.path.endsWith("/")).map((entry) => entry.path)
              : undefined
          }
          errorMessage={
            jsonShareImport.status === "error"
              ? jsonShareImport.errorMessage
              : undefined
          }
          onCancel={onCloseJsonShareImport}
          onReplace={() => {
            if (jsonShareImport.status === "ready") {
              onReplaceWorkspaceWithJsonShare(jsonShareImport.workspace);
            }
          }}
        />
      )}
    </>
  );
}
