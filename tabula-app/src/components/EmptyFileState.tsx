import { CircleHelp, FilePlus2, FolderOpen, Upload } from "lucide-react";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { PRODUCT_NAME } from "../product";
import { getWorkspaceMenuCopy } from "../workspaceLocale";
import { TabulaLogo } from "./TabulaLogo";

type EmptyFileStateProps = {
  language: WorkspaceLanguage;
  onNewFile: () => void;
  onOpenFile: () => void;
  onBrowseFiles: () => void;
  onOpenHelp: () => void;
  primaryShortcutModifier: string;
  alternateShortcutModifier: string;
};

export function EmptyFileState({
  language,
  onNewFile,
  onOpenFile,
  onBrowseFiles,
  onOpenHelp,
  primaryShortcutModifier,
  alternateShortcutModifier,
}: EmptyFileStateProps) {
  const appShortcutPrefix = `${primaryShortcutModifier}+${alternateShortcutModifier}`;
  const copy = getWorkspaceMenuCopy(language).emptyState;

  return (
    <section className="empty-file-state" aria-label={`${PRODUCT_NAME} start`}>
      <div className="empty-file-center">
        <div className="empty-file-brand">
          <TabulaLogo className="empty-file-logo" />
        </div>
        <p>{copy.tagline}</p>
        <div className="empty-file-actions">
          <button type="button" onClick={onNewFile} className="empty-file-action">
            <FilePlus2 size={16} />
            <span>{copy.newFile}</span>
            <span className="empty-file-action-hint">{appShortcutPrefix}+N</span>
          </button>
          <button type="button" onClick={onOpenFile} className="empty-file-action">
            <Upload size={16} />
            <span>{copy.openFile}</span>
            <span className="empty-file-action-hint">{appShortcutPrefix}+O</span>
          </button>
          <button type="button" onClick={onBrowseFiles} className="empty-file-action">
            <FolderOpen size={16} />
            <span>{copy.browseFiles}</span>
            <span className="empty-file-action-hint">{appShortcutPrefix}+F</span>
          </button>
          <button type="button" onClick={onOpenHelp} className="empty-file-action">
            <CircleHelp size={16} />
            <span>{copy.help}</span>
            <span className="empty-file-action-hint">?</span>
          </button>
        </div>
      </div>
    </section>
  );
}
