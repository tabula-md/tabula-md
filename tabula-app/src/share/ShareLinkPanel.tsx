import {
  Bot,
  Check,
  ChevronDown,
  ExternalLink,
  LockKeyhole,
  Play,
  RefreshCw,
  Radio,
  Square,
} from "lucide-react";
import type { ShareViewModel } from "@tabula-md/tabula";
import { type ReactNode, useId } from "react";
import type {
  ConnectionStatus,
  RoomRecoveryMode,
} from "../collaboration/liveCollaboration";
import type {
  WorkspaceChromeCopy,
  WorkspaceShareCopy,
} from "../workspace/workspaceLocale";
import { TABULA_MCP_SETUP_URL } from "./shareAgentHandoff";
import { ShareModeHeader } from "./ShareModeHeader";
import { ShareResultDetails } from "./ShareResultDetails";

type ShareLinkPanelProps = {
  agentInviteCopied: boolean;
  chromeCopy: WorkspaceChromeCopy;
  copied: boolean;
  copy: WorkspaceShareCopy;
  currentUserName: string;
  documentCount: number;
  connectionStatus: ConnectionStatus;
  exportPanel: ReactNode;
  isLive: boolean;
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
  documentCount,
  connectionStatus,
  exportPanel,
  isLive,
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
  const nameInputId = useId();
  const agentDescriptionId = useId();
  const canRetrySession = connectionStatus === "disconnected";
  const liveMetadata = connectionStatus === "suspended"
    ? copy.live.pausedDescription
    : recoveryMode === "temporary"
      ? copy.live.temporarySessionDescription
      : copy.live.resultDescription;

  const livePanel = (
    <div
      className={`share-link-section share-live-section ${isLive ? "share-result-surface" : "share-choice-row"}`}
    >
      <ShareModeHeader
        description={copy.live.description}
        headingLevel={3}
        icon={<Radio size={18} />}
        title={copy.live.title}
      />

      {!isLive && (
        <div className="share-session-start">
          <button
            className="share-modal-primary"
            type="button"
            onClick={onStartWorkspaceRoom}
          >
            <Play size={16} />
            <span>{copy.live.startSession}</span>
          </button>
        </div>
      )}

      {isLive && (
        <ShareResultDetails
          copied={copied}
          copy={copy}
          documentCount={documentCount}
          link={{
            canCopy: shareView.live.link.canCopy,
            display: shareView.live.link.display,
            disabledTitle: copy.live.invalidInviteTitle,
            title: shareView.live.link.title,
          }}
          metadata={liveMetadata}
          onCopyLink={onCopyShareUrl}
        >
          <div className="share-live-management live-room-box">
            <div className="share-live-name-row">
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

            <div className="share-live-agent-row">
              <details className="share-live-agent-details">
                <summary>
                  <span>{copy.live.inviteAgent}</span>
                  <ChevronDown size={14} aria-hidden="true" />
                </summary>
                <div className="share-live-agent-copy">
                  <p id={agentDescriptionId}>{copy.live.inviteAgentDescription}</p>
                  <p className="share-live-agent-warning">
                    {copy.live.agentAccessWarning}
                  </p>
                </div>
              </details>
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

            <div className="share-live-stop-row">
              <a
                className="share-live-agent-setup-link"
                href={TABULA_MCP_SETUP_URL}
                target="_blank"
                rel="noreferrer"
              >
                <span>{copy.live.setupAgent}</span>
                <ExternalLink size={13} aria-hidden="true" />
              </a>
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
                  title={copy.live.stopDescription}
                  onClick={onStopSession}
                >
                  <Square size={14} />
                  <span>{copy.live.stopSession}</span>
                </button>
              </div>
            </div>
          </div>
        </ShareResultDetails>
      )}
    </div>
  );

  if (isLive) return livePanel;

  return (
    <>
      <div className="share-chooser-options">
        {livePanel}
        <span className="share-chooser-or" aria-hidden="true">
          {chromeCopy.common.or}
        </span>
        <div className="share-link-section share-export-section share-choice-row">
          {exportPanel}
        </div>
      </div>
      <div className="share-modal-note share-chooser-note">
        <LockKeyhole size={15} aria-hidden="true" />
        <p>{copy.chooserSecurityDescription}</p>
      </div>
    </>
  );
}
