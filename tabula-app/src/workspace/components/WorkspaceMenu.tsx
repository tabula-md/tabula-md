import type { ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileInput,
  FileOutput,
  FilePlus2,
  FolderArchive,
  FolderInput,
  HelpCircle,
  Github,
  Info,
  Monitor,
  Moon,
  SlidersHorizontal,
  Sun,
  Trash2,
} from "lucide-react";
import type {
  WorkspaceLanguage,
  WorkspaceTheme,
} from "../state/useWorkspacePreferences";
import {
  getWorkspaceMenuCopy,
  WORKSPACE_LANGUAGE_OPTIONS,
} from "../workspaceLocale";

type WorkspaceMenuProps = {
  isOpen: boolean;
  preferencesOpen: boolean;
  theme: WorkspaceTheme;
  language: WorkspaceLanguage;
  onTogglePreferences: () => void;
  onChangeTheme: (theme: WorkspaceTheme) => void;
  onChangeLanguage: (language: WorkspaceLanguage) => void;
  onAddFile: () => void;
  onImportFile: () => void;
  onImportWorkspace?: () => void;
  onExportFile: () => void;
  onExportWorkspace: () => void;
  canExportFile: boolean;
  canExportWorkspace: boolean;
  onClearWorkspace?: () => void;
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
  theme,
  language,
  onTogglePreferences,
  onChangeTheme,
  onChangeLanguage,
  onAddFile,
  onImportFile,
  onImportWorkspace,
  onExportFile,
  onExportWorkspace,
  canExportFile,
  canExportWorkspace,
  onClearWorkspace,
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
    <div className="workspace-preferences-segmented ui-segmented">
      {options.map((option) => (
        <button
          className={`${currentValue === option.value ? "active" : ""} ${option.icon ? "icon-only" : ""}`}
          type="button"
          key={option.value}
          aria-label={option.label}
          data-tooltip={option.icon ? option.label : undefined}
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
      aria-label={copy.aria.workspaceMenu}
    >
      <nav className="workspace-menu-list" aria-label={copy.aria.workspaceActions}>
        <MenuRow icon={<FilePlus2 size={16} />} onClick={onAddFile}>
          {copy.actions.newFile}
        </MenuRow>
        <MenuRow icon={<FileInput size={16} />} onClick={onImportFile}>
          {copy.actions.importFile}
        </MenuRow>
        {onImportWorkspace && (
          <MenuRow icon={<FolderInput size={16} />} onClick={onImportWorkspace}>
            {copy.actions.importWorkspace}
          </MenuRow>
        )}
        <div className="workspace-menu-divider" role="separator" />
        <MenuRow
          icon={<FileOutput size={16} />}
          disabled={!canExportFile}
          onClick={onExportFile}
        >
          {copy.actions.exportFile}
        </MenuRow>
        <MenuRow
          icon={<FolderArchive size={16} />}
          disabled={!canExportWorkspace}
          onClick={onExportWorkspace}
        >
          {copy.actions.exportWorkspace}
        </MenuRow>
        <div className="workspace-menu-divider" role="separator" />

        <MenuRow
          className={preferencesOpen ? "active" : ""}
          icon={<SlidersHorizontal size={16} />}
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
                    icon: <Monitor size={16} />,
                  },
                  {
                    value: "light",
                    label: copy.preferences.light,
                    icon: <Sun size={16} />,
                  },
                  {
                    value: "dark",
                    label: copy.preferences.dark,
                    icon: <Moon size={16} />,
                  },
                ],
                onChangeTheme,
              )}
            </div>
            <div className="workspace-preferences-setting">
              <span>{copy.preferences.language}</span>
              <label className="workspace-preferences-select ui-select">
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
        <MenuRow icon={<Info size={16} />} onClick={onOpenAbout}>
          {copy.actions.about}
        </MenuRow>
        <MenuRow icon={<HelpCircle size={16} />} onClick={onOpenHelp}>
          {copy.actions.help}
        </MenuRow>

        <div className="workspace-menu-divider" role="separator" />

        <MenuLink
          href="https://x.com/tabula_md"
          icon={<XLogoIcon size={16} />}
          ariaLabel={copy.aria.openX}
        >
          {copy.actions.followUs}
        </MenuLink>
        <MenuLink
          href="https://github.com/tabula-md/tabula-md"
          icon={<Github size={16} />}
          ariaLabel={copy.aria.openGithub}
        >
          {copy.actions.github}
        </MenuLink>
        {onClearWorkspace && (
          <>
            <div className="workspace-menu-divider" role="separator" />
            <MenuRow icon={<Trash2 size={16} />} onClick={onClearWorkspace}>
              {copy.actions.clearWorkspace}
            </MenuRow>
          </>
        )}
      </nav>
    </section>
  );
}
