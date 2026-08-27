import type { ReactNode } from "react";
import { PanelLeft, PanelRight, Search, Users } from "lucide-react";
import { getLineNumberForPresenceSelection as getLineNumberForSelection } from "@tabula-md/tabula";
import type { Collaborator } from "../../collaboration/liveCollaboration";
import type { FollowState } from "../../collaboration/followModel";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getWorkspaceChromeCopy } from "../workspaceLocale";
import { getWorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";
import { IconButton } from "../../ui/IconButton";
import type { WorkspaceContextSummaryViewModel } from "../workspaceContextSummary";
import { getWorkspaceStatusIndicator } from "../workspaceStatusIndicator";

type TopChromeProps = {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  isLiveConnected: boolean;
  workspaceContextSummary: WorkspaceContextSummaryViewModel;
  language: WorkspaceLanguage;
  identity: Collaborator;
  collaborators: Collaborator[];
  followState: FollowState;
  activeDocumentId?: string;
  activeText: string;
  fileTabs: ReactNode;
  shareControls: ReactNode;
  onOpenWorkspaceLauncher: () => void;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
  onToggleFollowing: (actorId: string) => void;
};

export function TopChrome({
  leftPanelOpen,
  rightPanelOpen,
  isLiveConnected,
  workspaceContextSummary,
  language,
  identity,
  collaborators,
  followState,
  activeDocumentId,
  activeText,
  fileTabs,
  shareControls,
  onToggleLeftPanel,
  onOpenWorkspaceLauncher,
  onToggleRightPanel,
  onToggleFollowing,
}: TopChromeProps) {
  const copy = getWorkspaceChromeCopy(language).topChrome;
  const panelCopy = getWorkspaceInterfaceCopy(language).sidePanel;
  const sidePanelLabel = copy.toggleSidePanel;
  const workspaceStatus = getWorkspaceStatusIndicator(workspaceContextSummary);
  const showWorkspaceStatus = workspaceStatus.kind !== "collaboration" && (
    workspaceStatus.kind === "folder" || workspaceStatus.tone !== "quiet"
  );
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
      <div className="top-left-zone">
        <IconButton
          className={`panel-toggle top-panel-toggle left-panel-trigger${leftPanelOpen ? " active" : ""}`}
          label={copy.toggleWorkspacePanel}
          tooltip={showWorkspaceStatus
            ? `${copy.toggleWorkspacePanel} · ${workspaceStatus.description}`
            : copy.toggleWorkspacePanel}
          aria-pressed={leftPanelOpen}
          onClick={onToggleLeftPanel}
        >
          <PanelLeft size={16} />
          {showWorkspaceStatus && (
            <span
              className={`top-workspace-status-dot ${workspaceStatus.kind} ${workspaceStatus.tone}`}
              aria-hidden="true"
            />
          )}
        </IconButton>
        <IconButton
          className="panel-toggle top-panel-toggle"
          label={panelCopy.tabs.search}
          onClick={onOpenWorkspaceLauncher}
        >
          <Search size={16} />
        </IconButton>
      </div>

      <div className="top-document-zone">
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

          <IconButton
            className={`panel-toggle top-panel-toggle${rightPanelOpen ? " active" : ""}`}
            label={sidePanelLabel}
            aria-pressed={rightPanelOpen}
            onClick={onToggleRightPanel}
          >
            <PanelRight size={16} />
          </IconButton>
        </div>
      </div>
    </header>
  );
}
