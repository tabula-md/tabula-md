import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, PanelRight, Users } from "lucide-react";
import type { Collaborator } from "../collaboration";
import {
  getCollaboratorPresenceDetail,
  getCollaboratorPresenceLabel,
  isCollaboratorInFile,
} from "../collaboration";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceChromeCopy } from "../workspaceLocale";

type TopChromeProps = {
  workspaceMenuOpen: boolean;
  rightPanelOpen: boolean;
  isLive: boolean;
  language: WorkspaceLanguage;
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
  language,
  identity,
  collaborators,
  activeText,
  fileTabs,
  shareControls,
  onToggleWorkspaceMenu,
  onToggleRightPanel,
}: TopChromeProps) {
  const copy = getWorkspaceChromeCopy(language).topChrome;
  const workspaceMenuLabel = workspaceMenuOpen
    ? copy.closeWorkspaceMenu
    : copy.openWorkspaceMenu;
  const rightPanelLabel = rightPanelOpen
    ? copy.closeProjectContext
    : copy.openProjectContext;
  const liveCollaborators = [identity, ...collaborators];
  const sharingTooltip =
    liveCollaborators.length > 1
      ? copy.liveWith(
          liveCollaborators.map((collaborator) => collaborator.name).join(", "),
        )
      : copy.liveAs(identity.name);
  const getTooltip = (collaborator: Collaborator) =>
    getCollaboratorPresenceLabel(collaborator, activeText);
  const currentFileTitle = identity.fileTitle;
  const currentRoomId = identity.roomId;
  const [presenceOpen, setPresenceOpen] = useState(false);
  const presenceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isLive) {
      setPresenceOpen(false);
    }
  }, [isLive]);

  useEffect(() => {
    if (!presenceOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && presenceRef.current?.contains(target)) {
        return;
      }

      setPresenceOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPresenceOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [presenceOpen]);

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
            <div className="presence-wrap" ref={presenceRef}>
              <button
                className={`presence sharing-presence ${presenceOpen ? "active" : ""}`}
                type="button"
                aria-label={sharingTooltip}
                aria-expanded={presenceOpen}
                data-tooltip={sharingTooltip}
                onClick={() => setPresenceOpen((isOpen) => !isOpen)}
              >
                <Users size={15} />
                <div className="avatars">
                  <span
                    className="avatar self"
                    style={{ background: identity.color }}
                    data-tooltip={getTooltip(identity)}
                  >
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
              </button>

              {presenceOpen && (
                <div
                  className="presence-popover"
                  role="dialog"
                  aria-label={copy.collaborators}
                >
                  <header>
                    <span>{copy.collaborators}</span>
                    <strong>{liveCollaborators.length}</strong>
                  </header>
                  <div className="presence-list">
                    {liveCollaborators.map((collaborator) => {
                      const isCurrentFile = isCollaboratorInFile(
                        collaborator,
                        currentFileTitle,
                        currentRoomId,
                      );
                      return (
                        <div
                          className={`presence-row ${collaborator.id === identity.id ? "self" : ""}`}
                          key={collaborator.id}
                        >
                          <span
                            className="presence-row-avatar"
                            style={{ background: collaborator.color }}
                          >
                            {collaborator.name.slice(0, 1)}
                          </span>
                          <div>
                            <span>{collaborator.name}</span>
                            <p className={isCurrentFile ? "" : "other-file"}>
                              {getCollaboratorPresenceDetail(
                                collaborator,
                                activeText,
                                currentFileTitle,
                                currentRoomId,
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
