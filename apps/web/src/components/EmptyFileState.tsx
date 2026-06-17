import { CircleHelp, FilePlus2, FolderOpen, Upload } from "lucide-react";
import { PRODUCT_NAME } from "../product";
import { TabulaLogo } from "./TabulaLogo";

type EmptyFileStateProps = {
  onNewFile: () => void;
  onOpenMarkdown: () => void;
  onBrowseFiles: () => void;
  onOpenHelp: () => void;
  primaryShortcutModifier: string;
  alternateShortcutModifier: string;
};

export function EmptyFileState({
  onNewFile,
  onOpenMarkdown,
  onBrowseFiles,
  onOpenHelp,
  primaryShortcutModifier,
  alternateShortcutModifier,
}: EmptyFileStateProps) {
  const appShortcutPrefix = `${primaryShortcutModifier}+${alternateShortcutModifier}`;

  return (
    <section className="empty-file-state" aria-label={`${PRODUCT_NAME} start`}>
      <div className="empty-file-center">
        <div className="empty-file-brand">
          <TabulaLogo className="empty-file-logo" />
        </div>
        <p>The default document format for humans and agents.</p>
        <div className="empty-file-actions">
          <button type="button" onClick={onNewFile} className="empty-file-action">
            <FilePlus2 size={15} />
            <span>New Markdown</span>
            <span className="empty-file-action-hint">{appShortcutPrefix}+N</span>
          </button>
          <button type="button" onClick={onOpenMarkdown} className="empty-file-action">
            <Upload size={15} />
            <span>Open .md file</span>
            <span className="empty-file-action-hint">{appShortcutPrefix}+O</span>
          </button>
          <button type="button" onClick={onBrowseFiles} className="empty-file-action">
            <FolderOpen size={15} />
            <span>Browse project files</span>
            <span className="empty-file-action-hint">{appShortcutPrefix}+F</span>
          </button>
          <button type="button" onClick={onOpenHelp} className="empty-file-action">
            <CircleHelp size={15} />
            <span>Help</span>
            <span className="empty-file-action-hint">?</span>
          </button>
        </div>
      </div>
    </section>
  );
}
