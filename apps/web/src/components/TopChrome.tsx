import type { ReactNode } from "react";
import { Menu, PanelRight, Users } from "lucide-react";
import type { Collaborator } from "../collab";
import { getCollaboratorPresenceLabel } from "../collaborationPresence";

type TopChromeProps = {
  workspaceMenuOpen: boolean;
  rightPanelOpen: boolean;
  isLive: boolean;
  identity: Collaborator;
  collaborators: Collaborator[];
  activeText: string;
  fileTabs: ReactNode;
  shareControls: ReactNode;
  onToggleWorkspaceMenu: () => void;
  onToggleRightPanel: () => void;
};

export function TopChrome({
  workspaceMenuOpen,
  rightPanelOpen,
  isLive,
  identity,
  collaborators,
  activeText,
  fileTabs,
  shareControls,
  onToggleWorkspaceMenu,
  onToggleRightPanel,
}: TopChromeProps) {
  const workspaceMenuLabel = `${workspaceMenuOpen ? "Close" : "Open"} Workspace menu`;
  const rightPanelLabel = `${rightPanelOpen ? "Close" : "Open"} Project Context`;
  const liveCollaborators = [identity, ...collaborators];
  const sharingTooltip =
    liveCollaborators.length > 1
      ? `Live with ${liveCollaborators.map((collaborator) => collaborator.name).join(", ")}`
      : `Live as ${identity.name}`;
  const getTooltip = (collaborator: Collaborator) => getCollaboratorPresenceLabel(collaborator, activeText);

  return (
    <header className="top-chrome">
      <div className="top-left-zone">
        <button
          className={`panel-toggle top-panel-toggle workspace-menu-button ${workspaceMenuOpen ? "active" : ""}`}
          type="button"
          title={workspaceMenuLabel}
          aria-label={workspaceMenuLabel}
          aria-expanded={workspaceMenuOpen}
          onClick={onToggleWorkspaceMenu}
        >
          <Menu size={16} />
        </button>
      </div>

      <div className="top-document-zone">
        {fileTabs}

        <div className="top-right-zone">
          {isLive && (
            <div className="presence sharing-presence" aria-label={sharingTooltip} data-tooltip={sharingTooltip}>
              <Users size={15} />
              <div className="avatars">
                <span className="avatar self" style={{ background: identity.color }} data-tooltip={getTooltip(identity)}>
                  {identity.name.slice(0, 1)}
                </span>
                {collaborators.slice(0, 4).map((collaborator) => (
                  <span
                    className="avatar"
                    key={collaborator.id}
                    style={{ background: collaborator.color }}
                    data-tooltip={getTooltip(collaborator)}
                  >
                    {collaborator.name.slice(0, 1)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {shareControls}

          {!rightPanelOpen && (
            <button
              className="panel-toggle top-panel-toggle"
              type="button"
              title={rightPanelLabel}
              aria-label={rightPanelLabel}
              aria-expanded={rightPanelOpen}
              onClick={onToggleRightPanel}
            >
              <PanelRight size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
