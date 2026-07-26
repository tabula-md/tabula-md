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
import { WorkspaceFolderImportDialog } from "./WorkspaceFolderImportDialog";
import { WorkspaceExportReviewDialog } from "./WorkspaceExportReviewDialog";
import type { WorkspaceExportReview } from "../io/workspaceExportReviewModel";
import type { WorkspaceFolderImportDraft } from "../io/workspaceFolderImport";

type JsonShareImportState =
  | { status: "loading" }
  | { status: "error"; errorMessage: string }
  | { status: "ready"; workspace: WorkspaceState };

export type WorkspaceOverlaySurfaceProps = {
  infoDialog: WorkspaceInfoDialogKind | null;
  workspaceFolderImport: WorkspaceFolderImportDraft | null;
  workspaceExportReview: WorkspaceExportReview | null;
  jsonShareImport: JsonShareImportState | null;
  language: WorkspaceLanguage;
  shortcutPlatform: ShortcutPlatform;
  toast: AppToastState | null;
  onDismissToast: () => void;
  onCloseInfoDialog: () => void;
  onCloseWorkspaceFolderImport: () => void;
  onCloseWorkspaceExportReview: () => void;
  onPauseToast: () => void;
  onResumeToast: () => void;
  onCloseJsonShareImport: () => void;
  onReplaceWorkspaceWithJsonShare: (workspace: WorkspaceState) => void;
  onReplaceWorkspaceWithFolder: () => void;
  onConfirmWorkspaceExport: () => void;
  onReviewWorkspaceExportIssues: () => void;
};

export function WorkspaceOverlaySurface({
  infoDialog,
  workspaceFolderImport,
  workspaceExportReview,
  jsonShareImport,
  language,
  shortcutPlatform,
  toast,
  onDismissToast,
  onCloseInfoDialog,
  onCloseWorkspaceFolderImport,
  onCloseWorkspaceExportReview,
  onPauseToast,
  onResumeToast,
  onCloseJsonShareImport,
  onReplaceWorkspaceWithJsonShare,
  onReplaceWorkspaceWithFolder,
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
        <WorkspaceFolderImportDialog
          language={language}
          workspace={workspaceFolderImport.workspace}
          profile={workspaceFolderImport.profile}
          onCancel={onCloseWorkspaceFolderImport}
          onReplace={onReplaceWorkspaceWithFolder}
        />
      )}
      {workspaceExportReview && (
        <WorkspaceExportReviewDialog
          language={language}
          review={workspaceExportReview}
          onCancel={onCloseWorkspaceExportReview}
          onExport={onConfirmWorkspaceExport}
          onReviewIssues={onReviewWorkspaceExportIssues}
        />
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
