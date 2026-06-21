import { useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, Link, Play, RefreshCw, Share2, Square, Trash2, Users, X } from "lucide-react";
import type { ConnectionStatus } from "../collab";
import type { PublishScope } from "../publish";
import type { MarkdownFile } from "../workspaceStorage";

type ShareControlsProps = {
  activeFile?: MarkdownFile;
  activeFileTitle: string;
  currentUserName: string;
  activeStatus: ConnectionStatus;
  isLive: boolean;
  shareOpen: boolean;
  sharePanelTarget?: SharePanel;
  copied: boolean;
  onToggleShare: () => void;
  onCloseShare: () => void;
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

const formatPublicUrlPreview = (url?: string) => {
  if (!url) {
    return "";
  }

  try {
    const parsedUrl = new URL(url);
    const publishId = parsedUrl.pathname.match(/^\/p\/([^/]+)/)?.[1];
    if (!publishId) {
      return `${parsedUrl.origin}${parsedUrl.pathname}`;
    }

    const compactPublishId = publishId.length > 12 ? `${publishId.slice(0, 8)}...` : publishId;
    return `${parsedUrl.origin}/p/${compactPublishId}`;
  } catch {
    return url;
  }
};

export function ShareControls({
  activeFile,
  activeFileTitle,
  currentUserName,
  activeStatus,
  isLive,
  shareOpen,
  sharePanelTarget,
  copied,
  onToggleShare,
  onCloseShare,
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
  const hasPublishedPage = Boolean(publishPageUrl);
  const publishUrlPreview = formatPublicUrlPreview(publishPageUrl);
  const scopeFileLabel = activeFileDisplayTitle || activeFileTitle;
  const selectedScopeLabel = publishScope === "project" ? "project" : "current page";
  const selectedScopeTitle = publishScope === "project" ? "Project" : "Current page";
  const publishedScopeLabel = publishedScope === "project" ? "project" : "current-page";
  const publishedScopeTitle = publishedScope === "project" ? "Project" : "Current page";
  const selectedScopeChanged = hasPublishedPage && Boolean(publishedScope) && publishScope !== publishedScope;
  const publishBlocked = Boolean(publishBlockerMessage);
  const publishFileCountLabel =
    publishScope === "file"
      ? "1 file"
      : publishFileCount === 1
        ? "1 file"
        : `${publishFileCount} files`;
  const publishedFileCountLabel =
    publishedScope === "project"
      ? publishedFileCount === 1
        ? "1 file"
        : `${publishedFileCount ?? publishFileCount} files`
      : "1 file";
  const publishReadinessLabel = publishBlocked
    ? "Needs content"
    : selectedScopeChanged
      ? "Ready to replace"
      : hasPublishedPage
        ? "Ready to update"
        : "Ready to publish";
  const publishResultSummary =
    publishScope === "file"
      ? "Creates one read-only public URL for this page."
      : "Creates one read-only public URL for this project.";
  const publishScopeSummary =
    publishScope === "file"
      ? `${scopeFileLabel} will be published.`
      : publishFileCount === 1
        ? "1 project file will be published."
        : `${publishFileCount} project files will be published.`;
  const publishedScopeSummary =
    publishedScope === "project"
      ? publishedFileCount === 1
        ? "Published as a project: 1 file."
        : `Published as a project: ${publishedFileCount ?? publishFileCount} files.`
      : `Published as current page: ${publishedFileTitle?.replace(/\.(?:md|markdown)$/i, "") || scopeFileLabel}.`;
  const publishChangeSummary = selectedScopeChanged
    ? `This will replace the existing ${publishedScopeLabel} publish with a ${selectedScopeLabel} publish at the same URL.`
    : hasPublishedPage
      ? `This updates the existing ${publishedScopeLabel} publish at the same URL.`
      : publishScopeSummary;
  const publishSummary = publishBlockerMessage || publishChangeSummary;
  const publishPrimaryLabel = publishing
    ? "Publishing..."
    : !hasPublishedPage
      ? publishScope === "project"
        ? "Publish project"
        : "Publish current page"
      : selectedScopeChanged
        ? publishScope === "project"
          ? "Republish as project"
          : "Republish as current page"
        : publishedScope === "project"
          ? "Update project"
          : "Update current page";
  const publishedTime = publishedAt
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "numeric",
      }).format(new Date(publishedAt))
    : "";

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
                      <h3>{hasPublishedPage ? "Published page" : "Publish a public page"}</h3>
                      <p>
                        {hasPublishedPage
                          ? "Manage the read-only page at this URL."
                          : "Choose what goes live, then create a read-only page."}
                      </p>
                    </div>
                  </div>

                  {hasPublishedPage && !changingPublishScope ? (
                    <div className="publish-output-box publish-management-box">
                      <div className="publish-status-card">
                        <div className="publish-status-copy">
                          <div className="publish-status-topline">
                            <span className="publish-live-pill">Live</span>
                            {publishedTime && <time>Last updated {publishedTime}</time>}
                          </div>
                          <span className="publish-status-label">Published</span>
                          <p>{publishedScopeSummary}</p>
                        </div>
                      </div>

                      {publishBlockerMessage && <p className="publish-scope-summary attention">{publishBlockerMessage}</p>}

                      {publishPageUrl && (
                        <div className="publish-url-card">
                          <span>Public URL</span>
                          <a href={publishPageUrl} target="_blank" rel="noreferrer" title={publishPageUrl}>
                            {publishUrlPreview || publishPageUrl}
                          </a>
                        </div>
                      )}

                      <div className="publish-detail-grid" aria-label="Published page details">
                        <div>
                          <span>Scope</span>
                          <strong>{publishedScopeTitle}</strong>
                        </div>
                        <div>
                          <span>Files</span>
                          <strong>{publishedFileCountLabel}</strong>
                        </div>
                      </div>

                      <div className="publish-management-actions" aria-label="Published page actions">
                        {canRepublishSnapshot && (
                          <button
                            className="share-modal-primary"
                            type="button"
                            onClick={handlePublishSnapshot}
                            disabled={publishing || publishBlocked}
                          >
                            <RefreshCw size={16} />
                            <span>{publishPrimaryLabel}</span>
                          </button>
                        )}
                        <a className="share-modal-secondary publish-page-link" href={publishPageUrl} target="_blank" rel="noreferrer">
                          <ExternalLink size={16} />
                          <span>View page</span>
                        </a>
                        <button className="share-modal-secondary" type="button" onClick={onCopyPublishPageUrl}>
                          <Copy size={16} />
                          <span>Copy link</span>
                        </button>
                        {canRepublishSnapshot && (
                          <>
                            <button className="share-modal-secondary" type="button" onClick={showPublishScopePicker}>
                              <Link size={16} />
                              <span>Change scope</span>
                            </button>
                            <button className="share-modal-secondary" type="button" onClick={onUnpublishSnapshot} disabled={unpublishing}>
                              <Trash2 size={16} />
                              <span>{unpublishing ? "Unpublishing..." : "Unpublish"}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="publish-scope-control" role="radiogroup" aria-label="Publish scope">
                        <button
                          className={publishScope === "file" ? "active" : ""}
                          type="button"
                          role="radio"
                          aria-checked={publishScope === "file"}
                          onClick={() => onChangePublishScope("file")}
                        >
                          <span>Current page</span>
                          <small>{scopeFileLabel}</small>
                        </button>
                        <button
                          className={publishScope === "project" ? "active" : ""}
                          type="button"
                          role="radio"
                          aria-checked={publishScope === "project"}
                          onClick={() => onChangePublishScope("project")}
                        >
                          <span>Project</span>
                          <small>{publishFileCount === 1 ? "1 file" : `${publishFileCount} files`}</small>
                        </button>
                      </div>

                      <div className="publish-output-box">
                        <div className={`publish-plan-card ${publishBlocked ? "blocked" : "ready"}`}>
                          <div>
                            <span>{publishReadinessLabel}</span>
                            <p>{publishResultSummary}</p>
                          </div>
                          <strong>{publishFileCountLabel}</strong>
                        </div>

                        <p className={`publish-scope-summary ${publishBlocked || selectedScopeChanged ? "attention" : ""}`}>
                          {publishSummary}
                          {!publishBlocked && hasPublishedPage && publishedTime ? ` Published ${publishedTime}.` : ""}
                        </p>

                        <div className="publish-detail-grid" aria-label="Publish plan details">
                          <div>
                            <span>Scope</span>
                            <strong>{selectedScopeTitle}</strong>
                          </div>
                          <div>
                            <span>Files</span>
                            <strong>{publishFileCountLabel}</strong>
                          </div>
                        </div>

                        <div className="publish-scope-actions">
                          <button
                            className="share-modal-primary"
                            type="button"
                            onClick={handlePublishSnapshot}
                            disabled={publishing || publishBlocked}
                          >
                            <Link size={16} />
                            <span>{publishPrimaryLabel}</span>
                          </button>
                          {hasPublishedPage && (
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
