import type { ReactNode } from "react";
import {
  ChevronRight,
  Download,
  FileDown,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  Github,
  Info,
  Settings2,
  Upload,
  Users,
  X,
} from "lucide-react";
import type { FileViewMode, ReadingWidth } from "../workspaceStorage";

type WorkspaceMenuProps = {
  isOpen: boolean;
  preferencesOpen: boolean;
  canExportCurrentFile: boolean;
  newFileViewMode: FileViewMode;
  defaultReadingWidth: ReadingWidth;
  defaultLineWrapping: boolean;
  defaultLineNumbers: boolean;
  onTogglePreferences: () => void;
  onClosePreferences: () => void;
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
  onOpenAbout: () => void;
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

type MenuLinkProps = {
  children: ReactNode;
  href: string;
  icon: ReactNode;
  ariaLabel?: string;
};

function MenuLink({ children, href, icon, ariaLabel }: MenuLinkProps) {
  return (
    <a className="workspace-menu-row" href={href} target="_blank" rel="noreferrer" aria-label={ariaLabel}>
      {icon}
      <span>{children}</span>
    </a>
  );
}

export function WorkspaceMenu({
  isOpen,
  preferencesOpen,
  canExportCurrentFile,
  newFileViewMode,
  defaultReadingWidth,
  defaultLineWrapping,
  defaultLineNumbers,
  onTogglePreferences,
  onClosePreferences,
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
  onOpenAbout,
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
          className={preferencesOpen ? "active" : ""}
          icon={<Settings2 size={15} />}
          trailing={<ChevronRight size={14} />}
          onClick={onTogglePreferences}
        >
          Settings
        </MenuRow>
        <MenuRow icon={<Info size={15} />} onClick={onOpenAbout}>
          About
        </MenuRow>
        <MenuRow icon={<HelpCircle size={15} />} onClick={onOpenHelp}>
          Help
        </MenuRow>

        <div className="workspace-menu-divider" role="separator" />

        <MenuLink
          href="https://x.com/tabula_md"
          icon={<span className="workspace-menu-brand-icon">X</span>}
          ariaLabel="Open Tabula.md on X"
        >
          X
        </MenuLink>
        <MenuLink
          href="https://github.com/tabula-md/tabula-md"
          icon={<Github size={15} />}
          ariaLabel="Open Tabula.md on GitHub"
        >
          GitHub
        </MenuLink>
      </nav>

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
