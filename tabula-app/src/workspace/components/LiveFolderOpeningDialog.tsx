import { FolderSync, Loader2 } from "lucide-react";
import { ModalSurface } from "../../ui/ModalSurface";
import { getWorkspaceIoCopy } from "../io/workspaceIoLocale";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";

type LiveFolderOpeningDialogProps = {
  language: WorkspaceLanguage;
};

export function LiveFolderOpeningDialog({
  language,
}: LiveFolderOpeningDialogProps) {
  const copy = getWorkspaceIoCopy(language);

  return (
    <ModalSurface
      ariaLabelledBy="live-folder-opening-title"
      className="json-import-modal workspace-folder-opening-modal"
      onClose={() => undefined}
    >
      <header className="share-modal-header compact">
        <h2 id="live-folder-opening-title">
          {copy.liveFolderOpeningTitle}
        </h2>
      </header>
      <div className="json-import-state" role="status">
        <span className="workspace-folder-opening-icon" aria-hidden="true">
          <FolderSync size={18} />
          <Loader2 size={14} />
        </span>
        <p>{copy.liveFolderOpeningDescription}</p>
      </div>
    </ModalSurface>
  );
}
