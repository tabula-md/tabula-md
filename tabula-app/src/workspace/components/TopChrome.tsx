import type { ReactNode } from "react";
import {
  ChevronDown,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Users,
} from "lucide-react";
import { getLineNumberForPresenceSelection as getLineNumberForSelection } from "@tabula-md/tabula";
import type { Collaborator } from "../../collaboration/liveCollaboration";
import type { FollowState } from "../../collaboration/followModel";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getWorkspaceChromeCopy } from "../workspaceLocale";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";

type TopChromeProps = {
  workspaceSearchOpen: boolean;
  workspaceMenuOpen: boolean;
  workspaceName: string;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  isLiveConnected: boolean;
  language: WorkspaceLanguage;
  identity: Collaborator;
  collaborators: Collaborator[];
  followState: FollowState;
  activeDocumentId?: string;
  activeText: string;
  fileTabs: ReactNode;
  shareControls: ReactNode;
  onToggleLeftPanel: () => void;
  onToggleWorkspaceMenu: () => void;
  onToggleWorkspaceSearch: () => void;
  onToggleRightPanel: () => void;
  onToggleFollowing: (actorId: string) => void;
};

export function TopChrome({
  workspaceSearchOpen,
  workspaceMenuOpen,
  workspaceName,
  leftPanelOpen,
  rightPanelOpen,
  isLiveConnected,
  language,
  identity,
  collaborators,
  followState,
  activeDocumentId,
  activeText,
  fileTabs,
  shareControls,
  onToggleLeftPanel,
  onToggleWorkspaceMenu,
  onToggleWorkspaceSearch,
  onToggleRightPanel,
  onToggleFollowing,
}: TopChromeProps) {
  const copy = getWorkspaceChromeCopy(language).topChrome;
  const panelCopy = getWorkspaceInterfaceCopy(language).sidePanel;
  const sidePanelLabel = copy.toggleSidePanel;
  const liveCollaborators = isLiveConnected ? [identity, ...collaborators] : [];
  const getInitial = (collaborator: Collaborator) =>
    (collaborator.name || "?").trim().slice(0, 1) || "?";
  const sharingTooltip =
    liveCollaborators.length > 1
      ? copy.liveWith(
          liveCollaborators.map((collaborator) => collaborator.name).join(", "),
        )
      : copy.liveAs(identity.name);
  const getPresenceLine = (collaborator: Collaborator) => {
    const collaboratorDocumentId =
      collaborator.selection?.documentId ?? collaborator.activeDocumentId;
    return activeDocumentId && collaboratorDocumentId === activeDocumentId
      ? getLineNumberForSelection(activeText, collaborator.selection)
      : undefined;
  };
  const getTooltip = (collaborator: Collaborator) => {
    const lineNumber = getPresenceLine(collaborator);
    const presenceLabel = copy[collaborator.presenceState ?? "active"];
    return [
      collaborator.name,
      collaborator.kind === "agent" ? copy.agent : null,
      presenceLabel,
      collaborator.fileTitle,
      lineNumber ? copy.line(lineNumber) : null,
    ].filter(Boolean).join(" · ");
  };
  return (
    <header className="top-chrome">
      <div className="top-document-zone">
        <div className="workspace-controls" aria-label={panelCopy.label}>
          <button
            className={`panel-toggle top-panel-toggle left-panel-trigger ${leftPanelOpen ? "active" : ""}`}
            type="button"
            aria-label={copy.workspacePanel}
            data-tooltip={copy.workspacePanel}
            aria-pressed={leftPanelOpen}
            onClick={onToggleLeftPanel}
          >
            {leftPanelOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
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
            className={`panel-toggle top-panel-toggle workspace-search-trigger ${
              workspaceSearchOpen ? "active" : ""
            }`}
            type="button"
            aria-label={panelCopy.tabs.search}
            data-tooltip={`${panelCopy.tabs.search} · ⌘K`}
            aria-expanded={workspaceSearchOpen}
            onClick={onToggleWorkspaceSearch}
          >
            <Search size={16} />
          </button>
        </div>

        {fileTabs}

        <div className="top-right-zone">
          {isLiveConnected && (
            <div className="presence sharing-presence" aria-label={sharingTooltip}>
              <Users size={16} aria-hidden="true" />
              <div className="avatars" aria-label={copy.collaborators}>
                <span
                  className={`avatar self ${identity.kind === "agent" ? "agent" : "human"} ${identity.presenceState ?? "active"}`}
                  style={{ background: identity.color }}
                  aria-label={getTooltip(identity)}
                  data-tooltip={getTooltip(identity)}
                >
                  {getInitial(identity)}
                </span>
                {collaborators.map((collaborator) => {
                  const isFollowing =
                    followState.status === "following" &&
                    followState.actorId === collaborator.id;
                  const actionLabel = isFollowing
                    ? copy.stopFollowing(collaborator.name)
                    : copy.follow(collaborator.name);
                  return (
                    <button
                      className={`avatar participant ${collaborator.kind === "agent" ? "agent" : "human"} ${collaborator.presenceState ?? "active"} ${isFollowing ? "following" : ""}`}
                      key={collaborator.id}
                      type="button"
                      style={{ background: collaborator.color }}
                      aria-pressed={isFollowing}
                      aria-label={`${actionLabel}. ${getTooltip(collaborator)}`}
                      data-tooltip={`${getTooltip(collaborator)} · ${actionLabel}`}
                      onClick={() => onToggleFollowing(collaborator.id)}
                    >
                      {getInitial(collaborator)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {shareControls}

          <button
            className={`panel-toggle top-panel-toggle ${rightPanelOpen ? "active" : ""}`}
            type="button"
            aria-label={sidePanelLabel}
            data-tooltip={sidePanelLabel}
            aria-pressed={rightPanelOpen}
            onClick={onToggleRightPanel}
          >
            {rightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
}
