import { useEffect, useState, type ReactNode } from "react";
import { Menu, PanelRight, Users } from "lucide-react";
import type { Collaborator } from "../collaboration";
import {
  getLineNumberForSelection,
  isCollaboratorInFile,
} from "../collaboration/collaborationPresence";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getWorkspaceChromeCopy } from "../workspaceLocale";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "./ui/Popover";

type TopChromeProps = {
  workspaceMenuOpen: boolean;
  rightPanelOpen: boolean;
  isLiveConnected: boolean;
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
  isLiveConnected,
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
  const liveCollaborators = isLiveConnected ? [identity, ...collaborators] : [];
  const getInitial = (collaborator: Collaborator) =>
    (collaborator.name || "?").trim().slice(0, 1) || "?";
  const sharingTooltip =
    liveCollaborators.length > 1
      ? copy.liveWith(
          liveCollaborators.map((collaborator) => collaborator.name).join(", "),
        )
      : copy.liveAs(identity.name);
  const getPresenceLine = (collaborator: Collaborator) =>
    getLineNumberForSelection(activeText, collaborator.selection);
  const getTooltip = (collaborator: Collaborator) => {
    const lineNumber = getPresenceLine(collaborator);
    return [
      collaborator.name,
      collaborator.kind === "agent" ? copy.agent : null,
      collaborator.fileTitle,
      lineNumber ? copy.line(lineNumber) : null,
    ].filter(Boolean).join(" · ");
  };
  const getPresenceDetail = (collaborator: Collaborator) => {
    const collaboratorDocumentId = collaborator.activeDocumentId ?? collaborator.selection?.documentId;
    if (!collaboratorDocumentId && !collaborator.fileTitle) {
      return collaborator.kind === "agent" ? copy.agentInWorkspace : copy.inWorkspace;
    }
    if (!isCollaboratorInFile(
      collaborator,
      currentFileTitle,
      currentRoomId,
      currentDocumentId,
    )) {
      const fileTitle = collaborator.fileTitle ?? copy.inWorkspace;
      return collaborator.kind === "agent"
        ? copy.agentViewing(fileTitle)
        : copy.viewing(fileTitle);
    }
    const lineNumber = getPresenceLine(collaborator);
    const detail = lineNumber ? copy.line(lineNumber) : copy.inThisFile;
    return collaborator.kind === "agent" ? `${copy.agent} · ${detail}` : detail;
  };
  const currentFileTitle = identity.fileTitle;
  const currentRoomId = identity.roomId;
  const currentDocumentId = identity.activeDocumentId;
  const [presenceOpen, setPresenceOpen] = useState(false);

  useEffect(() => {
    if (!isLiveConnected) {
      setPresenceOpen(false);
    }
  }, [isLiveConnected]);

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
            <div className="presence-wrap">
              <PopoverRoot open={presenceOpen} onOpenChange={setPresenceOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={`presence sharing-presence ${presenceOpen ? "active" : ""}`}
                    type="button"
                    aria-label={sharingTooltip}
                    data-tooltip={sharingTooltip}
                  >
                    <Users size={16} />
                    <div className="avatars">
                      <span
                        className={`avatar self ${identity.kind === "agent" ? "agent" : "human"}`}
                        style={{ background: identity.color }}
                        data-tooltip={getTooltip(identity)}
                      >
                        {getInitial(identity)}
                      </span>
                      {collaborators.slice(0, 4).map((collaborator) => (
                        <span
                          className={`avatar ${collaborator.kind === "agent" ? "agent" : "human"}`}
                          key={collaborator.id}
                          style={{ background: collaborator.color }}
                          data-tooltip={getTooltip(collaborator)}
                        >
                          {getInitial(collaborator)}
                        </span>
                      ))}
                    </div>
                  </button>
                </PopoverTrigger>

                <PopoverContent
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
                        currentDocumentId,
                      );
                      return (
                        <div
                          className={`presence-row ${collaborator.id === identity.id ? "self" : ""} ${
                            collaborator.kind === "agent" ? "agent" : "human"
                          }`}
                          key={collaborator.id}
                        >
                          <span
                            className="presence-row-avatar"
                            style={{ background: collaborator.color }}
                          >
                            {getInitial(collaborator)}
                          </span>
                          <div>
                            <span>
                              {collaborator.name}
                              {collaborator.kind === "agent" && (
                                <small className="presence-kind-badge">{copy.agent}</small>
                              )}
                            </span>
                            <p className={isCurrentFile ? "" : "other-file"}>
                              {getPresenceDetail(collaborator)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              </PopoverRoot>
            </div>
          )}

          {shareControls}

          {!rightPanelOpen && (
            <button
              className="panel-toggle top-panel-toggle"
              type="button"
              aria-label={rightPanelLabel}
              data-tooltip={rightPanelLabel}
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
