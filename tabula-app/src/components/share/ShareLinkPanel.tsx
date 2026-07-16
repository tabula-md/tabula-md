import {
  Bot,
  Check,
  Copy,
  ExternalLink,
  LockKeyhole,
  Play,
  RefreshCw,
  Square,
  Users,
} from "lucide-react";
import { type ReactNode, useId } from "react";
import type { ConnectionStatus, RoomRecoveryMode } from "../../collaboration";
import type { ShareViewModel } from "../../share";
import type {
  WorkspaceChromeCopy,
  WorkspaceShareCopy,
} from "../../workspaceLocale";
import { TABULA_MCP_SETUP_URL } from "../../shareAgentHandoff";

type ShareLinkPanelProps = {
  agentInviteCopied: boolean;
  chromeCopy: WorkspaceChromeCopy;
  copied: boolean;
  copy: WorkspaceShareCopy;
  currentUserName: string;
  connectionStatus: ConnectionStatus;
  exportPanel: ReactNode;
  isLive: boolean;
  isLiveConnected: boolean;
  recoveryMode: RoomRecoveryMode;
  shareView: ShareViewModel;
  onChangeUserName: (nextName: string) => void;
  onCommitUserName: () => void;
  onCopyAgentInvite: () => void;
  onCopyShareUrl: () => void;
  onRetrySession: () => void;
  onStartWorkspaceRoom: () => void;
  onStopSession: () => void;
};

export function ShareLinkPanel({
  agentInviteCopied,
  chromeCopy,
  copied,
  copy,
  currentUserName,
  connectionStatus,
  exportPanel,
  isLive,
  isLiveConnected,
  recoveryMode,
  shareView,
  onChangeUserName,
  onCommitUserName,
  onCopyAgentInvite,
  onCopyShareUrl,
  onRetrySession,
  onStartWorkspaceRoom,
  onStopSession,
}: ShareLinkPanelProps) {
  const startDescriptionId = useId();
  const nameInputId = useId();
  const inviteLabelId = useId();
  const agentDescriptionId = useId();
  const canRetrySession = connectionStatus === "disconnected";
  const showTransientLiveStatus = !isLiveConnected && (connectionStatus === "reconnecting" || connectionStatus === "disconnected");
  const showTemporarySession = isLiveConnected && recoveryMode === "temporary";
  const connectionCopy = showTransientLiveStatus
    ? connectionStatus === "reconnecting"
      ? {
          title: copy.live.reconnectingTitle,
          description: copy.live.reconnectingDescription,
        }
      : {
          title: copy.live.disconnectedTitle,
          description: copy.live.disconnectedDescription,
        }
    : null;

  return (
    <>
      <div className="share-link-section">
        <div className="share-panel-heading">
          <span className="share-modal-option-icon">
            <Users size={18} />
          </span>
          <div>
            <h3>{copy.live.title}</h3>
            <p>{copy.live.description}</p>
          </div>
        </div>

        {!isLive && (
          <div className="share-session-start">
            <button
              className="share-modal-primary"
              type="button"
              aria-describedby={startDescriptionId}
              onClick={onStartWorkspaceRoom}
            >
              <Play size={16} />
              <span>{copy.live.startSession}</span>
            </button>
            <p id={startDescriptionId}>{copy.live.startDescription}</p>
          </div>
        )}

        {isLive && (
          <div className="live-room-box">
            {showTemporarySession && (
              <div className="share-live-status temporary">
                <p>{copy.live.temporarySessionDescription}</p>
              </div>
            )}
            {connectionCopy && (
              <div className={`share-live-status ${connectionStatus}`}>
                <strong>{connectionCopy.title}</strong>
                <p>{connectionCopy.description}</p>
              </div>
            )}

            {isLiveConnected && (
              <>
                <div className="share-modal-field">
                  <label htmlFor={nameInputId}>{copy.live.nameLabel}</label>
                  <input
                    id={nameInputId}
                    value={currentUserName}
                    aria-label={copy.live.nameAria}
                    placeholder={copy.live.anonymousPlaceholder}
                    maxLength={40}
                    onBlur={onCommitUserName}
                    onChange={(event) => onChangeUserName(event.target.value)}
                  />
                </div>

                <div className="share-modal-field">
                  <span className="share-modal-field-label" id={inviteLabelId}>
                    {copy.live.inviteLabel}
                  </span>
                  <div className="share-modal-link-row">
                    <div
                      className="share-link-display"
                      aria-labelledby={inviteLabelId}
                      title={shareView.live.link.title}
                    >
                      <span>{shareView.live.link.display}</span>
                    </div>
                    <button
                      type="button"
                      onClick={onCopyShareUrl}
                      disabled={!shareView.live.link.canCopy}
                      title={
                        shareView.live.link.canCopy
                          ? undefined
                          : copy.live.invalidInviteTitle
                      }
                    >
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                      <span>{copied ? copy.live.copied : copy.live.copyLink}</span>
                    </button>
                  </div>
                </div>

                <div className="share-live-agent-box">
                  <div>
                    <strong>{copy.live.inviteAgent}</strong>
                    <p id={agentDescriptionId}>{copy.live.inviteAgentDescription}</p>
                    <a
                      className="share-live-agent-setup-link"
                      href={TABULA_MCP_SETUP_URL}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>{copy.live.setupAgent}</span>
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                    <p className="share-live-agent-warning">
                      {copy.live.agentAccessWarning}
                    </p>
                  </div>
                  <button
                    className="share-modal-secondary"
                    type="button"
                    aria-describedby={agentDescriptionId}
                    onClick={onCopyAgentInvite}
                  >
                    {agentInviteCopied ? <Check size={16} /> : <Bot size={16} />}
                    <span>
                      {agentInviteCopied ? copy.live.copied : copy.live.copyAgentInvite}
                    </span>
                  </button>
                </div>
              </>
            )}

            <p className="share-live-stop-description">{copy.live.stopDescription}</p>

            <div className="share-live-session-actions">
              {canRetrySession && (
                <button
                  className="share-modal-secondary"
                  type="button"
                  onClick={onRetrySession}
                >
                  <RefreshCw size={16} />
                  <span>{copy.live.retrySession}</span>
                </button>
              )}
              <button
                className="share-modal-danger"
                type="button"
                onClick={onStopSession}
              >
                <Square size={14} />
                <span>{copy.live.stopSession}</span>
              </button>
            </div>
          </div>
        )}

        <div className="share-modal-note">
          <LockKeyhole size={15} aria-hidden="true" />
          <p>{copy.live.securityDescription}</p>
        </div>
      </div>

      {!isLive && (
        <>
          <div className="share-section-divider" aria-hidden="true">
            <span />
            <strong>{chromeCopy.common.or}</strong>
            <span />
          </div>

          <div className="share-link-section share-export-section">
            {exportPanel}
          </div>
        </>
      )}
    </>
  );
}
