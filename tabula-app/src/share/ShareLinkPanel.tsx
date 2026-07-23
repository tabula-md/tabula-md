import {
  Bot,
  Check,
  LockKeyhole,
  RefreshCw,
  Radio,
  Square,
} from "lucide-react";
import type { ShareViewModel } from "@tabula-md/tabula";
import { type ReactNode, useId } from "react";
import type {
  ConnectionStatus,
} from "../collaboration/liveCollaboration";
import type { WorkspaceShareCopy } from "../workspace/workspaceLocale";
import { ShareModeHeader } from "./ShareModeHeader";
import { ShareChoiceAction } from "./ShareChoiceAction";
import { ShareResultDetails } from "./ShareResultDetails";

type ShareLinkPanelProps = {
  agentInviteCopied: boolean;
  copied: boolean;
  copy: WorkspaceShareCopy;
  currentUserName: string;
  connectionStatus: ConnectionStatus;
  exportPanel: ReactNode;
  choiceLocked: boolean;
  isLive: boolean;
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
  copied,
  copy,
  currentUserName,
  connectionStatus,
  exportPanel,
  choiceLocked,
  isLive,
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
  const canRetrySession = connectionStatus === "disconnected";
  const liveMetadata = connectionStatus === "suspended"
    ? copy.live.pausedDescription
    : undefined;

  const livePanel = (
    <div
      className={`share-link-section share-live-section ${isLive ? "share-result-surface" : "share-choice-row"}`}
    >
      {!isLive ? (
        <ShareChoiceAction
          actionLabel={copy.live.startSession}
          description={copy.live.description}
          icon={<Radio size={18} />}
          locked={choiceLocked}
          onClick={onStartWorkspaceRoom}
          title={copy.live.title}
        />
      ) : (
        <>
          <ShareModeHeader
            description={copy.live.description}
            headingLevel={3}
            icon={<Radio size={18} />}
            title={copy.live.title}
          />
          <ShareResultDetails
            copied={copied}
            copy={copy}
            link={{
              canCopy: shareView.live.link.canCopy,
              display: shareView.live.link.display,
              disabledTitle: copy.live.invalidInviteTitle,
            }}
            linkActions={(
              <button
                className="share-copy-prompt"
                type="button"
                onClick={onCopyAgentInvite}
                disabled={!shareView.live.link.canCopy}
                title={shareView.live.link.canCopy
                  ? undefined
                  : copy.live.invalidInviteTitle}
              >
                {agentInviteCopied ? <Check size={18} /> : <Bot size={18} />}
                <span>
                  {agentInviteCopied ? copy.live.copied : copy.live.copyAgentInvite}
                </span>
              </button>
            )}
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
          </ShareResultDetails>
        </>
      )}
    </div>
  );

  if (isLive) return livePanel;

  return (
    <>
      <div className="share-chooser-options">
        {livePanel}
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
