import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Link,
  Play,
  RefreshCw,
  Share2,
  Sparkles,
  Square,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { ConnectionStatus } from "../collab";
import { PRODUCT_PLUS_NAME } from "../product";
import type { PublishScope } from "../publish";
import { buildPublishViewModel } from "../publishViewModel";
import type { MarkdownFile } from "../workspaceStorage";

type ShareControlsProps = {
  activeFile?: MarkdownFile;
  activeFileTitle: string;
  currentUserName: string;
  activeStatus: ConnectionStatus;
  isLive: boolean;
  shareOpen: boolean;
  sharePanelTarget?: SharePanel;
  tabulaPlusEnabled: boolean;
  copied: boolean;
  onToggleShare: () => void;
  onCloseShare: () => void;
  onOpenTabulaPlus: () => void;
  onStartSession: () => void;
  onCopyShareUrl: () => void;
  onCopyMarkdown: () => void;
  onDownloadMarkdown: () => void;
  publishScope: PublishScope;
  publishFileCount: number;
  publishedScope?: PublishScope;
  publishedFileTitle?: string;
  publishedFileCount?: number;
  publishedAt?: string;
  publishPageUrl?: string;
  publishBlockerMessage?: string;
  canRepublishSnapshot: boolean;
  publishing: boolean;
  unpublishing: boolean;
  onChangePublishScope: (nextScope: PublishScope) => void;
  onPublishSnapshot: () => void;
  onUnpublishSnapshot: () => void;
  onCopyPublishPageUrl: () => void;
  onChangeUserName: (nextName: string) => void;
  onCommitUserName: () => void;
  onStopSession: () => void;
};

export type SharePanel = "collaborate" | "send" | "publish";

const formatShareUrlPreview = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    const roomId = parsedUrl.pathname.match(/^\/r\/([^/]+)/)?.[1];
    if (!roomId) {
      return url;
    }

    const compactRoomId = roomId.length > 12 ? `${roomId.slice(0, 8)}...` : roomId;
    return `${parsedUrl.origin}/r/${compactRoomId}${parsedUrl.hash ? "#key=..." : ""}`;
  } catch {
    return url;
  }
};

const formatRoomTime = (value?: string) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export function ShareControls({
  activeFile,
  activeFileTitle,
  currentUserName,
  activeStatus,
  isLive,
  shareOpen,
  sharePanelTarget,
  tabulaPlusEnabled,
  copied,
  onToggleShare,
  onCloseShare,
  onOpenTabulaPlus,
  onStartSession,
  onCopyShareUrl,
  onCopyMarkdown,
  onDownloadMarkdown,
  publishScope,
  publishFileCount,
  publishedScope,
  publishedFileTitle,
  publishedFileCount,
  publishedAt,
  publishPageUrl,
  publishBlockerMessage,
  canRepublishSnapshot,
  publishing,
  unpublishing,
  onChangePublishScope,
  onPublishSnapshot,
  onUnpublishSnapshot,
  onCopyPublishPageUrl,
  onChangeUserName,
  onCommitUserName,
  onStopSession,
}: ShareControlsProps) {
  const [sharePanel, setSharePanel] = useState<SharePanel>("collaborate");
  const [changingPublishScope, setChangingPublishScope] = useState(false);
  const shareUrl = activeFile?.shareUrl || window.location.href;
  const shareUrlPreview = formatShareUrlPreview(shareUrl);
  const activeFileDisplayTitle = activeFileTitle.replace(/\.(?:md|markdown)$/i, "");
  const shareModalTitle = sharePanel === "publish" ? "Publish" : `Share ${activeFileDisplayTitle}`;
  const lastSnapshotTime = formatRoomTime(activeFile?.lastSnapshotAt);
  const roomIssueMessage =
    activeFile?.lastRecoveryType === "invalid-message" ? (activeFile.lastRecoveryMessage ?? "") : "";
  const roomInfoMessage =
    activeFile?.lastRecoveryType === "reconnected" || activeFile?.lastRecoveryType === "snapshot-recovered"
      ? (activeFile.lastRecoveryMessage ?? "")
      : "";
  const isRecoverableOffline =
    roomIssueMessage.toLowerCase().includes("server disconnected") ||
    roomIssueMessage.toLowerCase().includes("not reachable");
  const hasRoomIssue = activeStatus === "offline" && Boolean(roomIssueMessage) && !isRecoverableOffline;
  const roomStatusLabel =
    activeStatus === "connected"
      ? "Live"
      : activeStatus === "connecting"
        ? "Connecting"
        : activeStatus === "offline"
          ? hasRoomIssue
            ? "Attention needed"
            : "Offline"
          : "Local";
  const roomStatusHint = roomIssueMessage
    ? hasRoomIssue
      ? roomIssueMessage
      : "Keep writing. Changes will sync when the room reconnects."
    : activeStatus === "connected"
      ? roomInfoMessage ||
        (activeFile?.snapshotCount
          ? `Encrypted snapshot saved${lastSnapshotTime ? ` ${lastSnapshotTime}` : ""}.`
          : "Encrypted snapshot pending.")
      : activeStatus === "connecting"
        ? "Joining the room and loading encrypted state."
        : activeStatus === "offline"
          ? "Offline edits stay local until the room reconnects."
          : "";
  const publishView = buildPublishViewModel({
    activeFileDisplayTitle,
    activeFileTitle,
    tabulaPlusEnabled,
    publishScope,
    publishFileCount,
    publishedScope,
    publishedFileTitle,
    publishedFileCount,
    publishedAt,
    publishPageUrl,
    publishBlockerMessage,
    canRepublishSnapshot,
    publishing,
    unpublishing,
  });

  useEffect(() => {
    if (shareOpen) {
      setSharePanel(sharePanelTarget ?? "collaborate");
      setChangingPublishScope(false);
    }
  }, [activeFile?.id, shareOpen, sharePanelTarget]);

  useEffect(() => {
    setChangingPublishScope(false);
  }, [publishPageUrl, publishedScope]);

  useEffect(() => {
    if (!shareOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseShare();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCloseShare, shareOpen]);

  const handleStopSession = () => {
    const confirmed = window.confirm(
      "Stop sharing this file?\n\nThis tab will leave the live room and keep the current Markdown local. Other collaborators can continue in the room.",
    );

    if (confirmed) {
      onStopSession();
    }
  };

  const showPublishScopePicker = () => {
    if (publishedScope) {
      onChangePublishScope(publishedScope);
    }
    setChangingPublishScope(true);
  };

  const hidePublishScopePicker = () => {
    if (publishedScope) {
      onChangePublishScope(publishedScope);
    }
    setChangingPublishScope(false);
  };

  const handlePublishSnapshot = () => {
    void Promise.resolve(onPublishSnapshot()).finally(() => setChangingPublishScope(false));
  };

  const renderPublishManagementAction = (action: (typeof publishView.managementActions)[number]) => {
    const actionTitle = action.disabledReason || undefined;

    switch (action.id) {
      case "update":
        return (
          <button
            key={action.id}
            className="share-modal-primary"
            type="button"
            onClick={handlePublishSnapshot}
            disabled={action.disabled}
            title={actionTitle}
          >
            <RefreshCw size={16} />
            <span>{action.label}</span>
          </button>
        );
      case "view":
        return (
          <a
            key={action.id}
            className="share-modal-secondary publish-page-link"
            href={publishPageUrl}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} />
            <span>{action.label}</span>
          </a>
        );
      case "copy":
        return (
          <button key={action.id} className="share-modal-secondary" type="button" onClick={onCopyPublishPageUrl}>
            <Copy size={16} />
            <span>{action.label}</span>
          </button>
        );
      case "changeScope":
        return (
          <button key={action.id} className="share-modal-secondary" type="button" onClick={showPublishScopePicker}>
            <Link size={16} />
            <span>{action.label}</span>
          </button>
        );
      case "unpublish":
        return (
          <button
            key={action.id}
            className="share-modal-secondary"
            type="button"
            onClick={onUnpublishSnapshot}
            disabled={action.disabled}
            title={actionTitle}
          >
            <Trash2 size={16} />
            <span>{action.label}</span>
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="share-wrap">
        <button
          className={`share-button share-trigger ${shareOpen ? "active" : ""}`}
          type="button"
          aria-label={`Share ${activeFileTitle}`}
          aria-expanded={shareOpen}
          onClick={onToggleShare}
        >
          <Share2 size={15} />
          <span className="share-label-visible">Share</span>
        </button>
      </div>

      {shareOpen && (
        <div
          className="share-modal-layer"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              onCloseShare();
            }
          }}
        >
          <section className="share-modal" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
            <button className="share-modal-close" type="button" aria-label="Close share dialog" onClick={onCloseShare}>
              <X size={17} />
            </button>

            <header className="share-modal-header">
              <h2 id="share-modal-title">{shareModalTitle}</h2>
            </header>

            <nav className="share-modal-tabs" role="tablist" aria-label="Share purpose">
              <button
                className={sharePanel === "collaborate" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={sharePanel === "collaborate"}
                onClick={() => setSharePanel("collaborate")}
              >
                Collaborate
              </button>
              <button
                className={sharePanel === "send" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={sharePanel === "send"}
                onClick={() => setSharePanel("send")}
              >
                Send
              </button>
              <button
                className={sharePanel === "publish" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={sharePanel === "publish"}
                onClick={() => setSharePanel("publish")}
              >
                Publish
              </button>
            </nav>

            <section className="share-modal-panel" role="tabpanel">
              {sharePanel === "collaborate" && (
                <>
                  <div className="share-panel-heading">
                    <span className="share-modal-option-icon">
                      <Users size={17} />
                    </span>
                    <div>
                      <h3>Collaborate with people</h3>
                      <p>Invite people to edit this file together.</p>
                    </div>
                  </div>

                  {!isLive && (
                    <div className="share-session-start">
                      <button className="share-modal-primary" type="button" onClick={onStartSession}>
                        <Play size={16} />
                        <span>Start session</span>
                      </button>
                      <p>An editable invite link will be created for this file.</p>
                    </div>
                  )}

                  {isLive && (
                    <div className="live-room-box">
                      {hasRoomIssue && (
                        <div className={`live-room-status ${activeStatus} attention`}>
                          <span className="live-room-status-dot" aria-hidden="true" />
                          <div>
                            <span>{roomStatusLabel}</span>
                            {roomStatusHint && <p>{roomStatusHint}</p>}
                          </div>
                        </div>
                      )}

                      <div className="share-modal-field">
                        <label>Your name</label>
                        <input
                          value={currentUserName}
                          aria-label="Your collaboration name"
                          placeholder="Anonymous"
                          maxLength={40}
                          onBlur={onCommitUserName}
                          onChange={(event) => onChangeUserName(event.target.value)}
                        />
                      </div>

                      <div className="share-modal-field">
                        <label>Invite link</label>
                        <div className="share-modal-link-row">
                          <div className="share-link-display" aria-label="Share link" title={shareUrl}>
                            <span>{shareUrlPreview}</span>
                          </div>
                          <button type="button" onClick={onCopyShareUrl}>
                            {copied ? <Check size={17} /> : <Copy size={17} />}
                            <span>{copied ? "Copied" : "Copy link"}</span>
                          </button>
                        </div>
                      </div>

                      <button className="share-modal-danger" type="button" onClick={handleStopSession}>
                        <Square size={14} />
                        <span>Stop session</span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {sharePanel === "send" && (
                <>
                  <div className="share-panel-heading">
                    <span className="share-modal-option-icon">
                      <Download size={17} />
                    </span>
                    <div>
                      <h3>Send the Markdown file</h3>
                      <p>Copy the source Markdown or download this file.</p>
                    </div>
                  </div>
                  <div className="share-modal-actions">
                    <button className="share-modal-secondary" type="button" onClick={onCopyMarkdown}>
                      <Copy size={16} />
                      <span>Copy Markdown</span>
                    </button>
                    <button className="share-modal-secondary" type="button" onClick={onDownloadMarkdown}>
                      <Download size={16} />
                      <span>Download .md</span>
                    </button>
                  </div>
                  <p className="share-modal-muted">Best for sending one file to a teammate, another editor, or an AI chat.</p>
                </>
              )}

              {sharePanel === "publish" && (
                <>
                  <div className="share-panel-heading">
                    <span className="share-modal-option-icon">
                      <Link size={17} />
                    </span>
                    <div>
                      <h3>{publishView.headingTitle}</h3>
                      <p>{publishView.headingDescription}</p>
                    </div>
                  </div>

                  {publishView.requiresPlus ? (
                    <div className="publish-plus-gate" aria-label={`${PRODUCT_PLUS_NAME} publish boundary`}>
                      <div className="publish-plus-card">
                        <span className="publish-plus-pill">
                          <Sparkles size={13} />
                          {PRODUCT_PLUS_NAME}
                        </span>
                        <strong>Public publishing is a Plus feature.</strong>
                        <p>Keep local writing free, then use Plus when work needs a durable public URL.</p>
                      </div>
                      <div className="publish-plus-features" aria-label={`${PRODUCT_PLUS_NAME} publish features`}>
                        <span>Current-page publish</span>
                        <span>Project publish</span>
                        <span>Stable agent-readable endpoints</span>
                      </div>
                      <button className="share-modal-primary" type="button" onClick={onOpenTabulaPlus}>
                        <Sparkles size={16} />
                        <span>View {PRODUCT_PLUS_NAME}</span>
                      </button>
                    </div>
                  ) : publishView.hasPublishedPage && !changingPublishScope ? (
                    <div className="publish-output-box publish-management-box">
                      <div className="publish-status-card">
                        <div className="publish-status-copy">
                          <div className="publish-status-topline">
                            <span className="publish-live-pill">Live</span>
                            {publishView.publishedTime && <time>Last updated {publishView.publishedTime}</time>}
                          </div>
                          <span className="publish-status-label">Published</span>
                          <p>{publishView.publishedScopeSummary}</p>
                        </div>
                      </div>

                      {publishView.blocked && publishView.disabledReason && (
                        <p className="publish-scope-summary attention">{publishView.disabledReason}</p>
                      )}

                      {publishPageUrl && (
                        <div className="publish-url-card">
                          <span>Public URL</span>
                          <a href={publishPageUrl} target="_blank" rel="noreferrer" title={publishPageUrl}>
                            {publishView.publicUrlPreview || publishPageUrl}
                          </a>
                        </div>
                      )}

                      <div className="publish-detail-grid" aria-label="Published page details">
                        <div>
                          <span>Scope</span>
                          <strong>{publishView.details.publishedScopeTitle}</strong>
                        </div>
                        <div>
                          <span>Files</span>
                          <strong>{publishView.details.publishedFilesLabel}</strong>
                        </div>
                      </div>

                      <div className="publish-management-actions" aria-label="Published page actions">
                        {publishView.managementActions.map(renderPublishManagementAction)}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="publish-scope-control" role="radiogroup" aria-label="Publish scope">
                        {publishView.scopeCards.map((scopeCard) => (
                          <button
                            key={scopeCard.scope}
                            className={scopeCard.active ? "active" : ""}
                            type="button"
                            role="radio"
                            aria-checked={scopeCard.active}
                            onClick={() => onChangePublishScope(scopeCard.scope)}
                          >
                            <span>{scopeCard.title}</span>
                            <small>{scopeCard.detail}</small>
                          </button>
                        ))}
                      </div>

                      <div className="publish-output-box">
                        <div className={`publish-plan-card ${publishView.blocked ? "blocked" : "ready"}`}>
                          <div>
                            <span>{publishView.readinessLabel}</span>
                            <p>{publishView.publishResultSummary}</p>
                          </div>
                          <strong>{publishView.details.filesLabel}</strong>
                        </div>

                        <p className={`publish-scope-summary ${publishView.blocked || publishView.selectedScopeChanged ? "attention" : ""}`}>
                          {publishView.summary}
                        </p>

                        <div className="publish-detail-grid" aria-label="Publish plan details">
                          <div>
                            <span>Scope</span>
                            <strong>{publishView.details.selectedScopeTitle}</strong>
                          </div>
                          <div>
                            <span>Files</span>
                            <strong>{publishView.details.filesLabel}</strong>
                          </div>
                        </div>

                        <div className="publish-scope-actions">
                          <button
                            className="share-modal-primary"
                            type="button"
                            onClick={handlePublishSnapshot}
                            disabled={!publishView.canSubmit}
                            title={publishView.disabledReason || undefined}
                          >
                            <Link size={16} />
                            <span>{publishView.primaryLabel}</span>
                          </button>
                          {publishView.hasPublishedPage && (
                            <button className="share-modal-secondary" type="button" onClick={hidePublishScopePicker}>
                              <X size={16} />
                              <span>Cancel</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          </section>
        </div>
      )}
    </>
  );
}
