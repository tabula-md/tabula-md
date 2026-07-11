import { FolderOpen } from "lucide-react";

export function WorkspaceLoadingSurface() {
  return (
    <main className="app-shell">
      <section className="workspace empty-workspace workspace-loading-surface" aria-label="Opening workspace">
        <div className="empty-file-center live-room-loading-center">
          <FolderOpen size={18} aria-hidden="true" />
          <p>Opening workspace...</p>
        </div>
      </section>
    </main>
  );
}
