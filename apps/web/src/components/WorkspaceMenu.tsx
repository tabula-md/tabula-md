import type { ReactNode } from "react";
import {
  ChevronRight,
  Download,
  FileDown,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  Settings2,
  Sparkles,
  Upload,
  Users,
  X,
} from "lucide-react";
import { PRODUCT_PLUS_NAME } from "../product";
import type { FileViewMode, ReadingWidth } from "../workspaceStorage";

type WorkspaceMenuProps = {
  isOpen: boolean;
  preferencesOpen: boolean;
  plusOpen: boolean;
  plusEnabled: boolean;
  canExportCurrentFile: boolean;
  newFileViewMode: FileViewMode;
  defaultReadingWidth: ReadingWidth;
  defaultLineWrapping: boolean;
  defaultLineNumbers: boolean;
  onTogglePreferences: () => void;
  onClosePreferences: () => void;
  onTogglePlus: () => void;
  onClosePlus: () => void;
  onChangeNewFileViewMode: (viewMode: FileViewMode) => void;
  onChangeDefaultReadingWidth: (readingWidth: ReadingWidth) => void;
  onChangeDefaultLineWrapping: (lineWrapping: boolean) => void;
  onChangeDefaultLineNumbers: (lineNumbers: boolean) => void;
  onAddFile: () => void;
  onOpenMarkdownFile: () => void;
  onImportProject: () => void;
  onDownloadMarkdown: () => void;
  onDownloadProject: () => void;
  onOpenCollaboration: () => void;
  onOpenHelp: () => void;
};

type MenuRowProps = {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  trailing?: ReactNode;
};

function MenuRow({ children, icon, onClick, className = "", disabled = false, trailing }: MenuRowProps) {
  return (
    <button className={`workspace-menu-row ${className}`} type="button" disabled={disabled} onClick={onClick}>
      {icon}
      <span>{children}</span>
      {trailing}
    </button>
  );
}

export function WorkspaceMenu({
  isOpen,
  preferencesOpen,
  plusOpen,
  plusEnabled,
  canExportCurrentFile,
  newFileViewMode,
  defaultReadingWidth,
  defaultLineWrapping,
  defaultLineNumbers,
  onTogglePreferences,
  onClosePreferences,
  onTogglePlus,
  onClosePlus,
  onChangeNewFileViewMode,
  onChangeDefaultReadingWidth,
  onChangeDefaultLineWrapping,
  onChangeDefaultLineNumbers,
  onAddFile,
  onOpenMarkdownFile,
  onImportProject,
  onDownloadMarkdown,
  onDownloadProject,
  onOpenCollaboration,
  onOpenHelp,
}: WorkspaceMenuProps) {
  if (!isOpen) {
    return null;
  }

  const renderSegment = <Value extends string>(
    currentValue: Value,
    options: Array<{ value: Value; label: string }>,
    onChange: (value: Value) => void,
  ) => (
    <div className="workspace-preferences-segmented">
      {options.map((option) => (
        <button
          className={currentValue === option.value ? "active" : ""}
          type="button"
          key={option.value}
          aria-pressed={currentValue === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const renderSwitch = (active: boolean, label: string, onChange: (active: boolean) => void) => (
    <button
      className={`workspace-preferences-switch ${active ? "active" : ""}`}
      type="button"
      aria-pressed={active}
      onClick={() => onChange(!active)}
    >
      <span>{label}</span>
      <i aria-hidden="true" />
    </button>
  );

  return (
    <section className="workspace-menu-popover" role="dialog" aria-label="Workspace menu">
      <nav className="workspace-menu-list" aria-label="Workspace actions">
        <MenuRow icon={<FilePlus2 size={15} />} onClick={onAddFile}>
          New Markdown
        </MenuRow>
        <MenuRow icon={<FolderOpen size={15} />} onClick={onOpenMarkdownFile}>
          Open Markdown...
        </MenuRow>
        <MenuRow icon={<Upload size={15} />} onClick={onImportProject}>
          Import project...
        </MenuRow>

        <div className="workspace-menu-divider" role="separator" />

        <MenuRow icon={<FileDown size={15} />} disabled={!canExportCurrentFile} onClick={onDownloadMarkdown}>
          Save Markdown...
        </MenuRow>
        <MenuRow icon={<Download size={15} />} onClick={onDownloadProject}>
          Export project...
        </MenuRow>
        <MenuRow icon={<Users size={15} />} onClick={onOpenCollaboration}>
          Live collaboration...
        </MenuRow>

        <div className="workspace-menu-divider" role="separator" />

        <MenuRow
          className={plusOpen ? "workspace-menu-plus active" : "workspace-menu-plus"}
          icon={<Sparkles size={15} />}
          trailing={<ChevronRight size={14} />}
          onClick={onTogglePlus}
        >
          {PRODUCT_PLUS_NAME}
        </MenuRow>
        <MenuRow
          className={preferencesOpen ? "active" : ""}
          icon={<Settings2 size={15} />}
          trailing={<ChevronRight size={14} />}
          onClick={onTogglePreferences}
        >
          Settings
        </MenuRow>
        <MenuRow icon={<HelpCircle size={15} />} onClick={onOpenHelp}>
          Help
        </MenuRow>
      </nav>

      {plusOpen && (
        <section className="workspace-plus-popover" role="dialog" aria-label={PRODUCT_PLUS_NAME}>
          <header className="workspace-plus-popover-header">
            <span>{PRODUCT_PLUS_NAME}</span>
            <button type="button" aria-label={`Close ${PRODUCT_PLUS_NAME}`} onClick={onClosePlus}>
              <X size={14} />
            </button>
          </header>
          <p>Cloud publishing and agent handoff for work that needs a durable public surface.</p>
          <div className="workspace-plus-feature-list" aria-label={`${PRODUCT_PLUS_NAME} features`}>
            <span>Durable public URLs</span>
            <span>Project publish</span>
            <span>Agent-readable endpoints</span>
          </div>
          <div className="workspace-plus-status">
            {plusEnabled ? "Enabled in this build" : "Not connected in this local build"}
          </div>
        </section>
      )}

      {preferencesOpen && (
        <section className="workspace-preferences-popover" aria-label="Settings">
          <header className="workspace-preferences-header">
            <h2>Settings</h2>
            <button type="button" aria-label="Close Settings" onClick={onClosePreferences}>
              <X size={14} />
            </button>
          </header>
          <section className="workspace-preferences-section" aria-labelledby="workspace-preferences-writing">
            <h3 id="workspace-preferences-writing">Writing</h3>
            <div className="workspace-preferences-setting">
              <span>New files open in</span>
              {renderSegment<FileViewMode>(
                newFileViewMode,
                [
                  { value: "edit", label: "Edit" },
                  { value: "split", label: "Split" },
                  { value: "preview", label: "Preview" },
                ],
                onChangeNewFileViewMode,
              )}
            </div>
          </section>
          <section className="workspace-preferences-section" aria-labelledby="workspace-preferences-reading">
            <h3 id="workspace-preferences-reading">Reading</h3>
            <div className="workspace-preferences-setting">
              <span>Text width</span>
              {renderSegment<ReadingWidth>(
                defaultReadingWidth,
                [
                  { value: "narrow", label: "Focus" },
                  { value: "standard", label: "Standard" },
                  { value: "wide", label: "Fill" },
                ],
                onChangeDefaultReadingWidth,
              )}
            </div>
          </section>
          <section className="workspace-preferences-section" aria-labelledby="workspace-preferences-editor">
            <h3 id="workspace-preferences-editor">Editor</h3>
            <div className="workspace-preferences-switches">
              {renderSwitch(defaultLineWrapping, "Line wrapping", onChangeDefaultLineWrapping)}
              {renderSwitch(defaultLineNumbers, "Line numbers", onChangeDefaultLineNumbers)}
            </div>
          </section>
        </section>
      )}
    </section>
  );
}
