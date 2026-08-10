import {
  ChevronDown,
  MoreHorizontal,
  PanelLeft,
  Search,
} from "lucide-react";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getWorkspaceChromeCopy } from "../workspaceLocale";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";

type WorkspaceNavigationControlsProps = {
  language: WorkspaceLanguage;
  leftPanelOpen: boolean;
  workspaceMenuOpen: boolean;
  workspaceName: string;
  workspaceSearchOpen: boolean;
  onToggleLeftPanel: () => void;
  onToggleWorkspaceMenu: () => void;
  onToggleWorkspaceSearch: () => void;
};

export function WorkspaceNavigationControls({
  language,
  leftPanelOpen,
  workspaceMenuOpen,
  workspaceName,
  workspaceSearchOpen,
  onToggleLeftPanel,
  onToggleWorkspaceMenu,
  onToggleWorkspaceSearch,
}: WorkspaceNavigationControlsProps) {
  const copy = getWorkspaceChromeCopy(language).topChrome;
  const panelCopy = getWorkspaceInterfaceCopy(language).sidePanel;

  return (
    <div className="workspace-controls" aria-label={panelCopy.label}>
      <button
        className={`panel-toggle top-panel-toggle left-panel-trigger ${leftPanelOpen ? "active" : ""}`}
        type="button"
        aria-label={copy.workspacePanel}
        data-tooltip={copy.workspacePanel}
        aria-pressed={leftPanelOpen}
        onClick={onToggleLeftPanel}
      >
        <PanelLeft size={16} />
      </button>
      <button
        className={`workspace-name-trigger workspace-menu-button ${workspaceMenuOpen ? "active" : ""}`}
        type="button"
        aria-label={workspaceMenuOpen ? copy.closeWorkspaceMenu : copy.openWorkspaceMenu}
        aria-expanded={workspaceMenuOpen}
        onClick={onToggleWorkspaceMenu}
      >
        <span>{workspaceName}</span>
        <ChevronDown className="workspace-menu-chevron" size={14} aria-hidden="true" />
        <MoreHorizontal className="workspace-menu-mobile-icon" size={18} aria-hidden="true" />
      </button>
      <button
        className={`panel-toggle top-panel-toggle workspace-search-trigger ${workspaceSearchOpen ? "active" : ""}`}
        type="button"
        aria-label={panelCopy.tabs.search}
        data-tooltip={`${panelCopy.tabs.search} · ⌘K`}
        aria-expanded={workspaceSearchOpen}
        onClick={onToggleWorkspaceSearch}
      >
        <Search size={16} />
      </button>
    </div>
  );
}
