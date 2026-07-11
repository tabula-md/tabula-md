import { FolderOpen } from "lucide-react";
import { readWorkspacePreferences } from "../hooks/useWorkspacePreferences";
import { getWorkspaceSurfaceCopy } from "../workspaceSurfaceLocale";

export function WorkspaceLoadingSurface() {
  const copy = getWorkspaceSurfaceCopy(readWorkspacePreferences().language);
  return (
    <main className="app-shell">
      <section className="workspace empty-workspace workspace-loading-surface" aria-label={copy.workspaceOpeningLabel}>
        <div className="empty-file-center live-room-loading-center">
          <FolderOpen size={18} aria-hidden="true" />
          <p>{copy.workspaceOpening}</p>
        </div>
      </section>
    </main>
  );
}
