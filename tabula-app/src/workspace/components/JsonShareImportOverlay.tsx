import { JsonShareImportDialog } from "../../share/JsonShareImportDialog";
import { getWorkspaceArchiveEntries } from "../io/workspaceArchive";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import type { WorkspaceState } from "../workspaceStorage";

type JsonShareImportState =
  | { status: "loading" }
  | { status: "error"; errorMessage: string }
  | { status: "ready"; workspace: WorkspaceState };

export function JsonShareImportOverlay({
  language,
  state,
  onCancel,
  onReplace,
}: {
  language: WorkspaceLanguage;
  state: JsonShareImportState;
  onCancel: () => void;
  onReplace: (workspace: WorkspaceState) => void;
}) {
  return <JsonShareImportDialog
    status={state.status}
    language={language}
    fileCount={state.status === "ready" ? state.workspace.files.length : undefined}
    filePaths={state.status === "ready"
      ? getWorkspaceArchiveEntries(state.workspace.files, state.workspace.folders)
          .filter((entry) => !entry.path.endsWith("/"))
          .map((entry) => entry.path)
      : undefined}
    errorMessage={state.status === "error" ? state.errorMessage : undefined}
    onCancel={onCancel}
    onReplace={() => state.status === "ready" && onReplace(state.workspace)}
  />;
}
