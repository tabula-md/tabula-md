import { AppToast } from "./AppToast";
import { JsonShareImportDialog } from "./JsonShareImportDialog";
import { TooltipLayer } from "./ui/TooltipLayer";
import type { AppToastState } from "../hooks/useAppToast";
import type { WorkspaceState } from "../workspaceStorage";
import { getProjectArchiveEntries } from "../projectArchive";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceSurfaceCopy } from "../workspaceSurfaceLocale";
import {
  WorkspaceInfoDialog,
  type WorkspaceInfoDialogKind,
} from "./WorkspaceInfoDialog";
import type { ShortcutPlatform } from "../keyboardShortcuts";
import { WorkspaceArchiveImportDialog } from "./WorkspaceArchiveImportDialog";

type JsonShareImportState =
  | { status: "loading" }
  | { status: "error"; errorMessage: string }
  | { status: "ready"; workspace: WorkspaceState };

export type WorkspaceOverlaySurfaceProps = {
  infoDialog: WorkspaceInfoDialogKind | null;
  workspaceArchiveImport: WorkspaceState | null;
  jsonShareImport: JsonShareImportState | null;
  language: WorkspaceLanguage;
  shortcutPlatform: ShortcutPlatform;
  toast: AppToastState | null;
  onDismissToast: () => void;
  onCloseInfoDialog: () => void;
  onCloseWorkspaceArchiveImport: () => void;
  onPauseToast: () => void;
  onResumeToast: () => void;
  onCloseJsonShareImport: () => void;
  onReplaceWorkspaceWithJsonShare: (workspace: WorkspaceState) => void;
  onReplaceWorkspaceWithArchive: () => void;
};

export function WorkspaceOverlaySurface({
  infoDialog,
  workspaceArchiveImport,
  jsonShareImport,
  language,
  shortcutPlatform,
  toast,
  onDismissToast,
  onCloseInfoDialog,
  onCloseWorkspaceArchiveImport,
  onPauseToast,
  onResumeToast,
  onCloseJsonShareImport,
  onReplaceWorkspaceWithJsonShare,
  onReplaceWorkspaceWithArchive,
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
      {workspaceArchiveImport && (
        <WorkspaceArchiveImportDialog
          language={language}
          workspace={workspaceArchiveImport}
          onCancel={onCloseWorkspaceArchiveImport}
          onReplace={onReplaceWorkspaceWithArchive}
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
              ? getProjectArchiveEntries(
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
