import { AppToast } from "./AppToast";
import { JsonShareImportDialog } from "./JsonShareImportDialog";
import type { AppToastState } from "../hooks/useAppToast";
import type { WorkspaceState } from "../workspaceStorage";

type JsonShareImportState =
  | { status: "loading" }
  | { status: "error"; errorMessage: string }
  | { status: "ready"; workspace: WorkspaceState };

type WorkspaceOverlaySurfaceProps = {
  jsonShareImport: JsonShareImportState | null;
  toast: AppToastState | null;
  onCloseJsonShareImport: () => void;
  onReplaceWorkspaceWithJsonShare: (workspace: WorkspaceState) => void;
};

export function WorkspaceOverlaySurface({
  jsonShareImport,
  toast,
  onCloseJsonShareImport,
  onReplaceWorkspaceWithJsonShare,
}: WorkspaceOverlaySurfaceProps) {
  return (
    <>
      {toast && (
        <AppToast
          key={toast.id}
          message={toast.message}
          tone={toast.tone}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
        />
      )}
      {jsonShareImport && (
        <JsonShareImportDialog
          status={jsonShareImport.status}
          fileCount={
            jsonShareImport.status === "ready"
              ? jsonShareImport.workspace.files.length
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
