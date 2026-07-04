import {
  Check,
  Copy,
  ExternalLink,
  Link,
  Play,
  RefreshCw,
  Square,
  Users,
} from "lucide-react";
import type { JsonShareController } from "../../hooks/useJsonShareController";
import type { ShareViewModel } from "../../share";
import type {
  WorkspaceChromeCopy,
  WorkspaceShareCopy,
} from "../../workspaceLocale";

type ShareLinkPanelProps = {
  chromeCopy: WorkspaceChromeCopy;
  copied: boolean;
  copy: WorkspaceShareCopy;
  currentUserName: string;
  exportLinkCopied: boolean;
  isLive: boolean;
  jsonShare: JsonShareController;
  shareView: ShareViewModel;
  onChangeUserName: (nextName: string) => void;
  onCommitUserName: () => void;
  onCopyShareUrl: () => void;
  onCopyShareableLink: () => void;
  onExportToJsonLink: () => void;
  onStartSession: () => void;
  onStopSession: () => void;
};

export function ShareLinkPanel({
  chromeCopy,
  copied,
  copy,
  currentUserName,
  exportLinkCopied,
  isLive,
  jsonShare,
  shareView,
  onChangeUserName,
  onCommitUserName,
  onCopyShareUrl,
  onCopyShareableLink,
  onExportToJsonLink,
  onStartSession,
  onStopSession,
}: ShareLinkPanelProps) {
  return (
    <>
      <div className="share-link-section">
        <div className="share-panel-heading">
          <span className="share-modal-option-icon">
            <Users size={17} />
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
              title={shareView.live.disabledReason || undefined}
              onClick={onStartSession}
            >
              <Play size={16} />
              <span>{copy.live.startSession}</span>
            </button>
            <p>{shareView.live.disabledReason || copy.live.startDescription}</p>
          </div>
        )}

        {isLive && (
          <div className="live-room-box">
            <div className="share-modal-field">
              <label>{copy.live.nameLabel}</label>
              <input
                value={currentUserName}
                aria-label={copy.live.nameAria}
                placeholder={copy.live.anonymousPlaceholder}
                maxLength={40}
                onBlur={onCommitUserName}
                onChange={(event) => onChangeUserName(event.target.value)}
              />
            </div>

            <div className="share-modal-field">
              <label>{copy.live.inviteLabel}</label>
              <div className="share-modal-link-row">
                <div
                  className="share-link-display"
                  aria-label={copy.live.inviteLabel}
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
                  {copied ? <Check size={17} /> : <Copy size={17} />}
                  <span>{copied ? copy.live.copied : copy.live.copyLink}</span>
                </button>
              </div>
            </div>

            <button
              className="share-modal-danger"
              type="button"
              onClick={onStopSession}
            >
              <Square size={14} />
              <span>{copy.live.stopSession}</span>
            </button>
          </div>
        )}
      </div>

      <div className="share-section-divider" aria-hidden="true">
        <span />
        <strong>{chromeCopy.common.or}</strong>
        <span />
      </div>

      <div className="share-link-section">
        <div className="share-panel-heading">
          <span className="share-modal-option-icon">
            <Link size={17} />
          </span>
          <div>
            <h3>{copy.shareable.title}</h3>
            <p>{copy.shareable.description}</p>
          </div>
        </div>

        {shareView.shareable.hasLink && jsonShare.url ? (
          <div className="share-copy-box">
            <div className="share-modal-field">
              <label>{copy.shareable.linkLabel}</label>
              <div className="share-modal-link-row">
                <a
                  className="share-link-display"
                  href={jsonShare.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={copy.shareable.linkLabel}
                  title={jsonShare.url}
                >
                  <span>{jsonShare.urlPreview}</span>
                </a>
                <button type="button" onClick={onCopyShareableLink}>
                  {exportLinkCopied ? <Check size={17} /> : <Copy size={17} />}
                  <span>
                    {exportLinkCopied ? copy.live.copied : copy.live.copyLink}
                  </span>
                </button>
              </div>
            </div>

            <div className="share-copy-actions">
              <button
                className="share-modal-primary"
                type="button"
                onClick={onExportToJsonLink}
                disabled={!jsonShare.canExport}
                title={shareView.shareable.disabledReason || undefined}
              >
                <RefreshCw size={16} />
                <span>{shareView.shareable.primaryLabel}</span>
              </button>
              <a
                className="share-modal-secondary"
                href={jsonShare.url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} />
                <span>{copy.shareable.openLink}</span>
              </a>
            </div>
            {shareView.shareable.disabledReason && (
              <p className="share-modal-muted">
                {shareView.shareable.disabledReason}
              </p>
            )}
          </div>
        ) : (
          <div className="share-copy-box">
            <button
              className="share-modal-primary"
              type="button"
              onClick={onExportToJsonLink}
              disabled={!jsonShare.canExport}
              title={shareView.shareable.disabledReason || undefined}
            >
              <Link size={16} />
              <span>{shareView.shareable.primaryLabel}</span>
            </button>
            {shareView.shareable.disabledReason && (
              <p className="share-modal-muted">
                {shareView.shareable.disabledReason}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
