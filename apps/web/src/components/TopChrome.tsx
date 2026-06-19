import type { ReactNode } from "react";
import { PanelLeft, PanelRight, Users } from "lucide-react";
import type { Collaborator } from "../collab";

type TopChromeProps = {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  isLive: boolean;
  identity: Collaborator;
  collaborators: Collaborator[];
  fileTabs: ReactNode;
  shareControls: ReactNode;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
};

export function TopChrome({
  leftPanelOpen,
  rightPanelOpen,
  isLive,
  identity,
  collaborators,
  fileTabs,
  shareControls,
  onToggleLeftPanel,
  onToggleRightPanel,
}: TopChromeProps) {
  const leftPanelLabel = `${leftPanelOpen ? "Close" : "Open"} Project Menu`;
  const rightPanelLabel = `${rightPanelOpen ? "Close" : "Open"} Project Context`;

  return (
    <header className="top-chrome">
      <div className="top-left-zone">
        {!leftPanelOpen && (
          <button
            className="panel-toggle top-panel-toggle"
            type="button"
            title={leftPanelLabel}
            aria-label={leftPanelLabel}
            aria-expanded={leftPanelOpen}
            onClick={onToggleLeftPanel}
          >
            <PanelLeft size={16} />
          </button>
        )}
        {fileTabs}
      </div>

      <div className="top-right-zone">
        {isLive && (
          <div className="presence sharing-presence" aria-label="Sharing">
            <Users size={15} />
            <span className="presence-label">Sharing</span>
            <div className="avatars">
              <span className="avatar self" style={{ background: identity.color }} title={identity.name}>
                {identity.name.slice(0, 1)}
              </span>
              {collaborators.slice(0, 4).map((collaborator) => (
                <span
                  className="avatar"
                  key={collaborator.id}
                  style={{ background: collaborator.color }}
                  title={collaborator.name}
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
    </header>
  );
}
