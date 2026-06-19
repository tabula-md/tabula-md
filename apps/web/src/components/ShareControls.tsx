import { useEffect, useState } from "react";
import { Check, Copy, Download, Link, Play, Share2, Square, Users, X } from "lucide-react";
import type { ConnectionStatus } from "../collab";
import type { MarkdownFile } from "../workspaceStorage";

type ShareControlsProps = {
  activeFile?: MarkdownFile;
  activeFileTitle: string;
  currentUserName: string;
  activeStatus: ConnectionStatus;
  isLive: boolean;
  shareOpen: boolean;
  copied: boolean;
  onToggleShare: () => void;
  onCloseShare: () => void;
  onStartSession: () => void;
  onCopyShareUrl: () => void;
  onCopyMarkdown: () => void;
  onDownloadMarkdown: () => void;
  publishFileCount: number;
  publishedAt?: string;
  publishPageUrl?: string;
  publishLlmsTxtUrl?: string;
  publishLlmsFullTxtUrl?: string;
  onPublishSnapshot: () => void;
  onCopyLlmsTxt: () => void;
  onCopyLlmsFullTxt: () => void;
  onCopyPublishPageUrl: () => void;
  onCopyPublishLlmsTxtUrl: () => void;
  onCopyPublishLlmsFullTxtUrl: () => void;
  onDownloadPublishBundle: () => void;
  onChangeUserName: (nextName: string) => void;
  onCommitUserName: () => void;
  onStopSession: () => void;
};

type SharePanel = "collaborate" | "send" | "publish";

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
  copied,
  onToggleShare,
  onCloseShare,
  onStartSession,
  onCopyShareUrl,
  onCopyMarkdown,
  onDownloadMarkdown,
  publishFileCount,
  publishedAt,
  publishPageUrl,
  publishLlmsTxtUrl,
  publishLlmsFullTxtUrl,
  onPublishSnapshot,
  onCopyLlmsTxt,
  onCopyLlmsFullTxt,
  onCopyPublishPageUrl,
  onCopyPublishLlmsTxtUrl,
  onCopyPublishLlmsFullTxtUrl,
  onDownloadPublishBundle,
  onChangeUserName,
  onCommitUserName,
  onStopSession,
}: ShareControlsProps) {
  const [sharePanel, setSharePanel] = useState<SharePanel>("collaborate");
  const shareUrl = activeFile?.shareUrl || window.location.href;
  const shareUrlPreview = formatShareUrlPreview(shareUrl);
  const activeFileDisplayTitle = activeFileTitle.replace(/\.(?:md|markdown)$/i, "");
  const shareModalTitle = sharePanel === "publish" ? "Publish project" : `Share ${activeFileDisplayTitle}`;
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
  const hasPublishedSnapshot = Boolean(publishPageUrl && publishLlmsTxtUrl && publishLlmsFullTxtUrl);
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
      setSharePanel("collaborate");
    }
  }, [activeFile?.id, shareOpen]);

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

                      <button className="share-modal-danger" type="button" onClick={onStopSession}>
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
                      <h3>Publish project</h3>
                      <p>Create a read-only page with agent-readable endpoints.</p>
                    </div>
                  </div>

                  <div className="publish-output-box">
                    <div className="publish-output-summary">
                      <span>{hasPublishedSnapshot ? "Published snapshot" : "Project snapshot"}</span>
                      <p>
                        {publishFileCount === 1 ? "1 project file included." : `${publishFileCount} project files included.`}
                        {publishedTime ? ` Published ${publishedTime}.` : ""}
                      </p>
                    </div>

                    <button className="share-modal-primary" type="button" onClick={onPublishSnapshot}>
                      <Link size={16} />
                      <span>Publish snapshot</span>
                    </button>

                    {hasPublishedSnapshot && (
                      <div className="publish-url-list" aria-label="Published URLs">
                        <div className="publish-url-row">
                          <span>Page</span>
                          <code title={publishPageUrl} data-testid="publish-page-url">
                            {publishPageUrl}
                          </code>
                          <button type="button" onClick={onCopyPublishPageUrl}>
                            <Copy size={15} />
                            <span>Copy page URL</span>
                          </button>
                        </div>
                        <div className="publish-url-row">
                          <span>llms.txt</span>
                          <code title={publishLlmsTxtUrl} data-testid="publish-llms-url">
                            {publishLlmsTxtUrl}
                          </code>
                          <button type="button" onClick={onCopyPublishLlmsTxtUrl}>
                            <Copy size={15} />
                            <span>Copy llms.txt URL</span>
                          </button>
                        </div>
                        <div className="publish-url-row">
                          <span>llms-full.txt</span>
                          <code title={publishLlmsFullTxtUrl} data-testid="publish-llms-full-url">
                            {publishLlmsFullTxtUrl}
                          </code>
                          <button type="button" onClick={onCopyPublishLlmsFullTxtUrl}>
                            <Copy size={15} />
                            <span>Copy llms-full.txt URL</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="share-modal-actions publish-actions">
                      <button className="share-modal-secondary" type="button" onClick={onCopyLlmsTxt}>
                        <Copy size={16} />
                        <span>Copy llms.txt</span>
                      </button>
                      <button className="share-modal-secondary" type="button" onClick={onCopyLlmsFullTxt}>
                        <Copy size={16} />
                        <span>Copy llms-full.txt</span>
                      </button>
                      <button className="share-modal-secondary" type="button" onClick={onDownloadPublishBundle}>
                        <Download size={16} />
                        <span>Download bundle</span>
                      </button>
                    </div>
                    <div className="publish-after-row" aria-label="Publish outputs">
                      <span>Outputs</span>
                      <code>llms.txt</code>
                      <code>llms-full.txt</code>
                      <code>bundle.md</code>
                    </div>
                  </div>
                </>
              )}
            </section>
          </section>
        </div>
      )}
    </>
  );
}
