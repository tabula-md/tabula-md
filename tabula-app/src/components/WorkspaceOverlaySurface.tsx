import { AppToast } from "./AppToast";
import { JsonShareImportDialog } from "./JsonShareImportDialog";
import { TooltipLayer } from "./ui/TooltipLayer";
import type { AppToastState } from "../hooks/useAppToast";
import type { WorkspaceState } from "../workspaceStorage";
import { getProjectArchiveEntries } from "../projectArchive";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceSurfaceCopy } from "../workspaceSurfaceLocale";

type JsonShareImportState =
  | { status: "loading" }
  | { status: "error"; errorMessage: string }
  | { status: "ready"; workspace: WorkspaceState };

export type WorkspaceOverlaySurfaceProps = {
  jsonShareImport: JsonShareImportState | null;
  language: WorkspaceLanguage;
  toast: AppToastState | null;
  onDismissToast: () => void;
  onPauseToast: () => void;
  onResumeToast: () => void;
  onCloseJsonShareImport: () => void;
  onReplaceWorkspaceWithJsonShare: (workspace: WorkspaceState) => void;
};

export function WorkspaceOverlaySurface({
  jsonShareImport,
  language,
  toast,
  onDismissToast,
  onPauseToast,
  onResumeToast,
  onCloseJsonShareImport,
  onReplaceWorkspaceWithJsonShare,
}: WorkspaceOverlaySurfaceProps) {
  const copy = getWorkspaceSurfaceCopy(language);
  return (
    <>
      <TooltipLayer />
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
