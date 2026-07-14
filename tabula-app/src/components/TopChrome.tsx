import type { ReactNode } from "react";
import { Menu, PanelRightClose, PanelRightOpen, Users } from "lucide-react";
import type { Collaborator } from "../collaboration";
import type { FollowState } from "../collaboration/followModel";
import { getLineNumberForSelection } from "../collaboration/collaborationPresence";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceChromeCopy } from "../workspaceLocale";

type TopChromeProps = {
  workspaceMenuOpen: boolean;
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
  onToggleWorkspaceMenu: () => void;
  onToggleRightPanel: () => void;
  onToggleFollowing: (actorId: string) => void;
};

export function TopChrome({
  workspaceMenuOpen,
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
  onToggleWorkspaceMenu,
  onToggleRightPanel,
  onToggleFollowing,
}: TopChromeProps) {
  const copy = getWorkspaceChromeCopy(language).topChrome;
  const workspaceMenuLabel = workspaceMenuOpen
    ? copy.closeWorkspaceMenu
    : copy.openWorkspaceMenu;
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
    return [
      collaborator.name,
      collaborator.kind === "agent" ? copy.agent : null,
      collaborator.fileTitle,
      lineNumber ? copy.line(lineNumber) : null,
    ].filter(Boolean).join(" · ");
  };
  return (
    <header className="top-chrome">
      <div className="top-left-zone">
        <button
          className={`panel-toggle top-panel-toggle workspace-menu-button ${workspaceMenuOpen ? "active" : ""}`}
          type="button"
          aria-label={workspaceMenuLabel}
          data-tooltip={workspaceMenuLabel}
          aria-expanded={workspaceMenuOpen}
          onClick={onToggleWorkspaceMenu}
        >
          <Menu size={16} />
        </button>
      </div>

      <div className="top-document-zone">
        {fileTabs}

        <div className="top-right-zone">
          {isLiveConnected && (
            <div
              className="presence sharing-presence"
              aria-label={sharingTooltip}
              data-tooltip={sharingTooltip}
            >
              <Users size={16} aria-hidden="true" />
              <div className="avatars" aria-label={copy.collaborators}>
                <span
                  className={`avatar self ${identity.kind === "agent" ? "agent" : "human"}`}
                  style={{ background: identity.color }}
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
                      className={`avatar participant ${collaborator.kind === "agent" ? "agent" : "human"} ${isFollowing ? "following" : ""}`}
                      key={collaborator.id}
                      type="button"
                      style={{ background: collaborator.color }}
                      aria-pressed={isFollowing}
                      aria-label={actionLabel}
                      data-tooltip={`${actionLabel} · ${getTooltip(collaborator)}`}
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
