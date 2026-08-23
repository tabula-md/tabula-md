import { FilePlus2, FolderOpen, Upload } from "lucide-react";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { PRODUCT_NAME } from "../../product";
import { getWorkspaceMenuCopy } from "../workspaceLocale";
import { formatShortcut, type ShortcutPlatform } from "../keyboardShortcuts";
import { TabulaLogo } from "../../ui/TabulaLogo";

type EmptyFileStateProps = {
  language: WorkspaceLanguage;
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenWorkspace: () => void;
  workspaceMode: "connected" | "copy";
  shortcutPlatform: ShortcutPlatform;
};

export function EmptyFileState({
  language,
  onNewFile,
  onOpenFile,
  onOpenWorkspace,
  workspaceMode,
  shortcutPlatform,
}: EmptyFileStateProps) {
  const copy = getWorkspaceMenuCopy(language).emptyState;

  return (
    <section className="empty-file-state" aria-label={`${PRODUCT_NAME} start`}>
      <div className="empty-file-center">
        <div className="empty-file-brand">
          <TabulaLogo className="empty-file-logo" />
        </div>
        <p>{copy.tagline}</p>
        <div className="empty-file-actions">
          <button type="button" onClick={onNewFile} className="empty-file-action primary">
            <FilePlus2 size={16} />
            <span className="empty-file-action-copy">
              <strong>{copy.newFile}</strong>
              <span>{copy.newFileDescription}</span>
            </span>
            <span className="empty-file-action-hint">{formatShortcut("Mod+Alt+N", shortcutPlatform)}</span>
          </button>
          <button type="button" onClick={onOpenWorkspace} className="empty-file-action secondary">
            <FolderOpen size={16} />
            <span className="empty-file-action-copy">
              <strong>{workspaceMode === "connected" ? copy.openWorkspace : getWorkspaceMenuCopy(language).actions.importWorkspace.replace(/…$/, "")}</strong>
              <span>{workspaceMode === "connected" ? copy.openWorkspaceDescription : copy.importWorkspaceDescription}</span>
            </span>
            <span className="empty-file-action-hint" />
          </button>
          <button type="button" onClick={onOpenFile} className="empty-file-action tertiary">
            <Upload size={16} />
            <span className="empty-file-action-copy">
              <strong>{copy.openFile}</strong>
              <span>{copy.openFileDescription}</span>
            </span>
            <span className="empty-file-action-hint">{formatShortcut("Mod+Alt+O", shortcutPlatform)}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
