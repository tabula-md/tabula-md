import { AlertTriangle, X } from "lucide-react";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getWorkspaceFolderImportCopy } from "../io/workspaceFolderImportLocale";
import { ModalSurface } from "../../ui/ModalSurface";

type WorkspaceFolderImportDialogProps = {
  language: WorkspaceLanguage;
  onCancel: () => void;
  onReplace: () => void;
};

export function WorkspaceFolderImportDialog({
  language,
  onCancel,
  onReplace,
}: WorkspaceFolderImportDialogProps) {
  const copy = getWorkspaceFolderImportCopy(language);

  return (
    <ModalSurface
      ariaLabelledBy="workspace-folder-title"
      className="json-import-modal workspace-folder-import-modal"
      onClose={onCancel}
    >
      <button className="share-modal-close" type="button" aria-label={copy.close} onClick={onCancel}>
        <X size={18} />
      </button>
      <header className="share-modal-header compact">
        <h2 id="workspace-folder-title">{copy.title}</h2>
      </header>
      <div className="json-import-warning" role="note">
        <AlertTriangle size={18} aria-hidden="true" />
        <p>{copy.replacementWarning}</p>
      </div>
      <div className="share-modal-actions">
        <button className="ui-modal-action secondary workspace-folder-import-cancel" type="button" onClick={onCancel}>{copy.cancel}</button>
        <button className="ui-modal-action share-modal-primary" type="button" data-modal-initial-focus onClick={onReplace}>{copy.importAndReplace}</button>
      </div>
    </ModalSurface>
  );
}
