import { readWorkspacePreferences } from "../hooks/useWorkspacePreferences";
import { getWorkspaceSurfaceCopy } from "../workspaceSurfaceLocale";

export function WorkspaceLoadingSurface() {
  const copy = getWorkspaceSurfaceCopy(readWorkspacePreferences().language);
  return (
    <main className="app-shell">
      <section
        className="workspace empty-workspace workspace-loading-surface"
        aria-busy="true"
        aria-label={copy.workspaceOpeningLabel}
      />
    </main>
  );
}
