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
  SlidersHorizontal,
  Upload,
  Users,
  X,
} from "lucide-react";
import type { WorkspaceLanguage, WorkspaceTheme } from "../hooks/useWorkspacePreferences";

type WorkspaceMenuProps = {
  isOpen: boolean;
  preferencesOpen: boolean;
  canExportCurrentFile: boolean;
  theme: WorkspaceTheme;
  language: WorkspaceLanguage;
  onTogglePreferences: () => void;
  onChangeTheme: (theme: WorkspaceTheme) => void;
  onChangeLanguage: (language: WorkspaceLanguage) => void;
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
  theme,
  language,
  onTogglePreferences,
  onChangeTheme,
  onChangeLanguage,
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
          icon={<SlidersHorizontal size={15} />}
          trailing={<ChevronRight size={14} />}
          onClick={onTogglePreferences}
        >
          Preferences
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
          icon={<X size={15} />}
          ariaLabel="Open Tabula.md on X"
        >
          Follow us
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
        <section className="workspace-preferences-popover" aria-label="Preferences">
          <div className="workspace-preferences-setting">
            <span>Theme</span>
            {renderSegment<WorkspaceTheme>(
              theme,
              [
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ],
              onChangeTheme,
            )}
          </div>
          <div className="workspace-preferences-setting">
            <span>Language</span>
            {renderSegment<WorkspaceLanguage>(
              language,
              [
                { value: "en", label: "English" },
                { value: "ko", label: "Korean" },
              ],
              onChangeLanguage,
            )}
          </div>
        </section>
      )}
    </section>
  );
}
