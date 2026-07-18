import {
  CircleHelp,
  FilePlus2,
  FolderOpen,
  Info,
  PanelsTopLeft,
  Share2,
  Upload,
  X,
} from "lucide-react";
import { formatShortcut, type ShortcutPlatform } from "../keyboardShortcuts";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getWorkspaceInfoCopy } from "../workspaceInfoLocale";
import { ModalSurface } from "../../ui/ModalSurface";

export type WorkspaceInfoDialogKind = "about" | "help";

type WorkspaceInfoDialogProps = {
  kind: WorkspaceInfoDialogKind;
  language: WorkspaceLanguage;
  shortcutPlatform: ShortcutPlatform;
  onClose: () => void;
};

export function WorkspaceInfoDialog({
  kind,
  language,
  shortcutPlatform,
  onClose,
}: WorkspaceInfoDialogProps) {
  const copy = getWorkspaceInfoCopy(language);
  const titleId = `workspace-${kind}-title`;

  return (
    <ModalSurface
      ariaLabelledBy={titleId}
      className="workspace-info-modal"
      onClose={onClose}
    >
      <button
        className="share-modal-close"
        type="button"
        aria-label={copy.close}
        data-modal-initial-focus
        onClick={onClose}
      >
        <X size={18} />
      </button>

      {kind === "about" ? (
        <>
          <header className="workspace-info-header">
            <Info size={20} aria-hidden="true" />
            <div>
              <h2 id={titleId}>{copy.about.title}</h2>
              <p>{copy.about.description}</p>
            </div>
          </header>
          <ul className="workspace-info-points">
            {copy.about.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </>
      ) : (
        <>
          <header className="workspace-info-header">
            <CircleHelp size={20} aria-hidden="true" />
            <div>
              <h2 id={titleId}>{copy.help.title}</h2>
              <p>{copy.help.description}</p>
            </div>
          </header>
          <div className="workspace-help-actions">
            <div><FilePlus2 size={16} /><span>{copy.help.newDocument}</span><kbd>{formatShortcut("Mod+Alt+N", shortcutPlatform)}</kbd></div>
            <div><Upload size={16} /><span>{copy.help.openMarkdown}</span><kbd>{formatShortcut("Mod+Alt+O", shortcutPlatform)}</kbd></div>
            <div><FolderOpen size={16} /><span>{copy.help.browseFiles}</span><kbd>{formatShortcut("Mod+Alt+F", shortcutPlatform)}</kbd></div>
            <div><PanelsTopLeft size={16} /><span>{copy.help.editModes}</span><kbd>{formatShortcut("Mod+Alt+1", shortcutPlatform)}–3</kbd></div>
            <div><Share2 size={16} /><span>{copy.help.share}</span></div>
          </div>
        </>
      )}
    </ModalSurface>
  );
}
