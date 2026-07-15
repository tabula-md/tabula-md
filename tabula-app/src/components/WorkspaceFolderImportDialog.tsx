import { FolderOpen, X } from "lucide-react";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getProjectArchiveEntries } from "../projectArchive";
import { getWorkspaceFolderImportCopy } from "../workspaceFolderImportLocale";
import type { WorkspaceState } from "../workspaceStorage";
import { ModalSurface } from "./ui/ModalSurface";

type WorkspaceFolderImportDialogProps = {
  language: WorkspaceLanguage;
  workspace: WorkspaceState;
  onCancel: () => void;
  onReplace: () => void;
};

export function WorkspaceFolderImportDialog({
  language,
  workspace,
  onCancel,
  onReplace,
}: WorkspaceFolderImportDialogProps) {
  const copy = getWorkspaceFolderImportCopy(language);
  const paths = getProjectArchiveEntries(workspace.files, workspace.folders)
    .filter((entry) => !entry.path.endsWith("/"))
    .map((entry) => entry.path);

  return (
    <ModalSurface ariaLabelledBy="workspace-folder-title" className="json-import-modal" onClose={onCancel}>
      <button className="share-modal-close" type="button" aria-label={copy.close} onClick={onCancel}>
        <X size={18} />
      </button>
      <header className="share-modal-header compact">
        <h2 id="workspace-folder-title">{copy.title}</h2>
        <p>{copy.description}</p>
      </header>
      <div className="json-import-copy">
        <FolderOpen size={18} aria-hidden="true" />
        <div>
          <p>{copy.contains(workspace.files.length, Math.max(0, workspace.folders.length - 1))}</p>
          <ul className="json-import-files" aria-label={copy.paths}>
            {paths.slice(0, 5).map((path) => <li key={path}>{path}</li>)}
            {paths.length > 5 && <li>{copy.more(paths.length - 5)}</li>}
          </ul>
        </div>
      </div>
      <div className="share-modal-actions">
        <button className="share-modal-secondary" type="button" onClick={onCancel}>{copy.cancel}</button>
        <button className="share-modal-primary" type="button" data-modal-initial-focus onClick={onReplace}>{copy.open}</button>
      </div>
    </ModalSurface>
  );
}
