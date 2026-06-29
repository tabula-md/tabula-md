import type { ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileDown,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  Github,
  Info,
  Monitor,
  Moon,
  SlidersHorizontal,
  Sun,
  Upload,
  Users,
} from "lucide-react";
import type {
  WorkspaceLanguage,
  WorkspaceTheme,
} from "../hooks/useWorkspacePreferences";
import {
  getWorkspaceMenuCopy,
  WORKSPACE_LANGUAGE_OPTIONS,
} from "../workspaceLocale";

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
  onOpenFile: () => void;
  onImportProject: () => void;
  onDownloadFile: () => void;
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

function MenuRow({
  children,
  icon,
  onClick,
  className = "",
  disabled = false,
  trailing,
}: MenuRowProps) {
  return (
    <button
      className={`workspace-menu-row ${className}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
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
    <a
      className="workspace-menu-row"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={ariaLabel}
    >
      {icon}
      <span>{children}</span>
    </a>
  );
}

function XLogoIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      focusable="false"
    >
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
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
  onOpenFile,
  onImportProject,
  onDownloadFile,
  onDownloadProject,
  onOpenCollaboration,
  onOpenAbout,
  onOpenHelp,
}: WorkspaceMenuProps) {
  if (!isOpen) {
    return null;
  }

  const copy = getWorkspaceMenuCopy(language);

  const renderSegment = <Value extends string>(
    currentValue: Value,
    options: Array<{ value: Value; label: string; icon?: ReactNode }>,
    onChange: (value: Value) => void,
  ) => (
    <div className="workspace-preferences-segmented">
      {options.map((option) => (
        <button
          className={`${currentValue === option.value ? "active" : ""} ${option.icon ? "icon-only" : ""}`}
          type="button"
          key={option.value}
          title={option.label}
          aria-label={option.label}
          aria-pressed={currentValue === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? option.icon : option.label}
        </button>
      ))}
    </div>
  );

  return (
    <section
      className="workspace-menu-popover"
      role="dialog"
      aria-label="Workspace menu"
    >
      <nav className="workspace-menu-list" aria-label="Workspace actions">
        <MenuRow icon={<FilePlus2 size={15} />} onClick={onAddFile}>
          {copy.actions.newFile}
        </MenuRow>
        <MenuRow icon={<FolderOpen size={15} />} onClick={onOpenFile}>
          {copy.actions.openFile}
        </MenuRow>
        <MenuRow icon={<Upload size={15} />} onClick={onImportProject}>
          {copy.actions.importProject}
        </MenuRow>

        <div className="workspace-menu-divider" role="separator" />

        <MenuRow
          icon={<FileDown size={15} />}
          disabled={!canExportCurrentFile}
          onClick={onDownloadFile}
        >
          {copy.actions.saveFile}
        </MenuRow>
        <MenuRow icon={<Download size={15} />} onClick={onDownloadProject}>
          {copy.actions.exportProject}
        </MenuRow>
        <MenuRow icon={<Users size={15} />} onClick={onOpenCollaboration}>
          {copy.actions.liveCollaboration}
        </MenuRow>

        <div className="workspace-menu-divider" role="separator" />

        <MenuRow
          className={preferencesOpen ? "active" : ""}
          icon={<SlidersHorizontal size={15} />}
          trailing={
            preferencesOpen ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          }
          onClick={onTogglePreferences}
        >
          {copy.actions.preferences}
        </MenuRow>
        {preferencesOpen && (
          <section
            className="workspace-preferences-panel"
            aria-label={copy.actions.preferences}
          >
            <div className="workspace-preferences-setting">
              <span>{copy.preferences.theme}</span>
              {renderSegment<WorkspaceTheme>(
                theme,
                [
                  {
                    value: "system",
                    label: copy.preferences.system,
                    icon: <Monitor size={15} />,
                  },
                  {
                    value: "light",
                    label: copy.preferences.light,
                    icon: <Sun size={15} />,
                  },
                  {
                    value: "dark",
                    label: copy.preferences.dark,
                    icon: <Moon size={15} />,
                  },
                ],
                onChangeTheme,
              )}
            </div>
            <div className="workspace-preferences-setting">
              <span>{copy.preferences.language}</span>
              <label className="workspace-preferences-select">
                <select
                  aria-label={copy.preferences.language}
                  value={language}
                  onChange={(event) =>
                    onChangeLanguage(
                      event.currentTarget.value as WorkspaceLanguage,
                    )
                  }
                >
                  {WORKSPACE_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </label>
            </div>
          </section>
        )}
        <MenuRow icon={<Info size={15} />} onClick={onOpenAbout}>
          {copy.actions.about}
        </MenuRow>
        <MenuRow icon={<HelpCircle size={15} />} onClick={onOpenHelp}>
          {copy.actions.help}
        </MenuRow>

        <div className="workspace-menu-divider" role="separator" />

        <MenuLink
          href="https://x.com/tabula_md"
          icon={<XLogoIcon size={15} />}
          ariaLabel={copy.aria.openX}
        >
          {copy.actions.followUs}
        </MenuLink>
        <MenuLink
          href="https://github.com/tabula-md/tabula-md"
          icon={<Github size={15} />}
          ariaLabel={copy.aria.openGithub}
        >
          {copy.actions.github}
        </MenuLink>
      </nav>
    </section>
  );
}
