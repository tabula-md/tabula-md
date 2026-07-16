import {
  Bot,
  Check,
  Copy,
  Play,
  RefreshCw,
  Square,
  Users,
} from "lucide-react";
import { type ReactNode, useId } from "react";
import type { ConnectionStatus } from "../../collaboration";
import type { ShareViewModel } from "../../share";
import type {
  WorkspaceChromeCopy,
  WorkspaceShareCopy,
} from "../../workspaceLocale";
import { tabulaServiceConfig } from "../../serviceConfig";

type ShareLinkPanelProps = {
  agentPromptCopied: boolean;
  chromeCopy: WorkspaceChromeCopy;
  copied: boolean;
  copy: WorkspaceShareCopy;
  currentUserName: string;
  connectionStatus: ConnectionStatus;
  exportPanel: ReactNode;
  isLive: boolean;
  isLiveConnected: boolean;
  shareView: ShareViewModel;
  onChangeUserName: (nextName: string) => void;
  onCommitUserName: () => void;
  onCopyLocalAgentPrompt: () => void;
  onCopyShareUrl: () => void;
  onRetrySession: () => void;
  onStartWorkspaceRoom: () => void;
  onStopSession: () => void;
};

export function ShareLinkPanel({
  agentPromptCopied,
  chromeCopy,
  copied,
  copy,
  currentUserName,
  connectionStatus,
  exportPanel,
  isLive,
  isLiveConnected,
  shareView,
  onChangeUserName,
  onCommitUserName,
  onCopyLocalAgentPrompt,
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
  const showTemporarySession = isLiveConnected && !tabulaServiceConfig.firebaseConfig;
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
              disabled={!shareView.live.canStart}
              aria-describedby={startDescriptionId}
              title={shareView.live.disabledReason || undefined}
              onClick={onStartWorkspaceRoom}
            >
              <Play size={16} />
              <span>{copy.live.startSession}</span>
            </button>
            <p id={startDescriptionId}>{shareView.live.disabledReason || copy.live.startDescription}</p>
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
                  </div>
                  <button
                    className="share-modal-secondary"
                    type="button"
                    aria-describedby={agentDescriptionId}
                    onClick={onCopyLocalAgentPrompt}
                  >
                    {agentPromptCopied ? <Check size={16} /> : <Bot size={16} />}
                    <span>
                      {agentPromptCopied ? copy.live.copied : copy.live.inviteAgent}
                    </span>
                  </button>
                </div>
              </>
            )}

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
