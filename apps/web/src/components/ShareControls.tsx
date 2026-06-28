import { useEffect, useState } from "react";
import {
  Bot,
  Check,
  Clipboard,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderArchive,
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
import type { JsonShareController } from "../hooks/useJsonShareController";
import { PRODUCT_PLUS_NAME } from "../product";
import type { PublishController } from "../hooks/usePublishController";
import { getRoomShareLinkView } from "../shareLinkViewModel";
import type { SharePanel } from "../uiTypes";
import type { MarkdownFile } from "../workspaceStorage";

type ShareControlsProps = {
  activeFile?: MarkdownFile;
  files: MarkdownFile[];
  activeFileTitle: string;
  currentUserName: string;
  canStartSession: boolean;
  isLive: boolean;
  shareOpen: boolean;
  sharePanelTarget?: SharePanel;
  copied: boolean;
  jsonShare: JsonShareController;
  publish: PublishController;
  startSessionUnavailableReason: string;
  onToggleShare: () => void;
  onCloseShare: () => void;
  onOpenTabulaPlus: () => void;
  onStartSession: () => void;
  onCopyShareUrl: () => void;
  onCopyMarkdown: () => void;
  onDownloadMarkdown: () => void;
  onChangeUserName: (nextName: string) => void;
  onCommitUserName: () => void;
  onStopSession: () => void;
};

export type { SharePanel } from "../uiTypes";

type VisibleSharePanel = "share-link" | "export" | "send-to";
type AgentHandoffScope = "file" | "project";

const normalizeSharePanel = (panel?: SharePanel): VisibleSharePanel => {
  if (panel === "export" || panel === "send-to" || panel === "share-link") {
    return panel;
  }

  return "share-link";
};

const buildLocalAgentPrompt = ({
  activeFile,
  files,
  instruction,
  scope,
}: {
  activeFile?: MarkdownFile;
  files: MarkdownFile[];
  instruction: string;
  scope: AgentHandoffScope;
}) => {
  const trimmedInstruction = instruction.trim();
  const visibleFiles =
    scope === "project" ? files : activeFile ? [activeFile] : [];
  const fileSections = visibleFiles
    .map((file) => `## ${file.title}\n\n\`\`\`markdown\n${file.text.trimEnd()}\n\`\`\``)
    .join("\n\n");

  return [
    "Use the following Tabula.md Markdown context.",
    trimmedInstruction ? `Task: ${trimmedInstruction}` : "Task: Help me continue from this context.",
    "",
    `Scope: ${scope === "project" ? "project" : "current file"}`,
    "",
    fileSections || "No Markdown content is available.",
  ].join("\n");
};

export function ShareControls({
  activeFile,
  files,
  activeFileTitle,
  currentUserName,
  canStartSession,
  isLive,
  shareOpen,
  sharePanelTarget,
  copied,
  jsonShare,
  publish,
  startSessionUnavailableReason,
  onToggleShare,
  onCloseShare,
  onOpenTabulaPlus,
  onStartSession,
  onCopyShareUrl,
  onCopyMarkdown,
  onDownloadMarkdown,
  onChangeUserName,
  onCommitUserName,
  onStopSession,
}: ShareControlsProps) {
  const [sharePanel, setSharePanel] = useState<SharePanel>("share-link");
  const [changingPublishScope, setChangingPublishScope] = useState(false);
  const [agentScope, setAgentScope] = useState<AgentHandoffScope>("file");
  const [agentInstruction, setAgentInstruction] = useState("");
  const [agentPromptCopied, setAgentPromptCopied] = useState(false);
  const [exportLinkCopied, setExportLinkCopied] = useState(false);
  const shareUrlView = getRoomShareLinkView(activeFile?.shareUrl, activeFile?.roomId);
  const activeFileDisplayTitle = activeFileTitle.replace(/\.(?:md|markdown)$/i, "");
  const shareModalTitle = `Share ${activeFileDisplayTitle}`;
  const publishView = publish.view;

  useEffect(() => {
    if (shareOpen) {
      setSharePanel(normalizeSharePanel(sharePanelTarget));
      setChangingPublishScope(false);
    }
  }, [activeFile?.id, shareOpen, sharePanelTarget]);

  useEffect(() => {
    setChangingPublishScope(false);
  }, [publish.versionKey]);

  useEffect(() => {
    if (!shareOpen) {
      setAgentPromptCopied(false);
      setExportLinkCopied(false);
    }
  }, [shareOpen]);

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
    publish.resetScopeToPublished();
    setChangingPublishScope(true);
  };

  const hidePublishScopePicker = () => {
    publish.resetScopeToPublished();
    setChangingPublishScope(false);
  };

  const handlePublishSnapshot = () => {
    void publish.publish().finally(() => setChangingPublishScope(false));
  };

  const handleExportToJsonLink = () => {
    void jsonShare.exportLink().finally(() => setExportLinkCopied(false));
  };

  const copyReadOnlyLink = async () => {
    await jsonShare.copyLink();
    setExportLinkCopied(true);
    window.setTimeout(() => setExportLinkCopied(false), 1200);
  };

  const copyLocalAgentPrompt = async () => {
    const prompt = buildLocalAgentPrompt({
      activeFile,
      files,
      instruction: agentInstruction,
      scope: agentScope,
    });

    await navigator.clipboard.writeText(prompt);
    setAgentPromptCopied(true);
    window.setTimeout(() => setAgentPromptCopied(false), 1200);
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
            href={publish.pageUrl}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} />
            <span>{action.label}</span>
          </a>
        );
      case "copy":
        return (
          <button key={action.id} className="share-modal-secondary" type="button" onClick={publish.copyPageUrl}>
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
            onClick={publish.unpublish}
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
                className={sharePanel === "share-link" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={sharePanel === "share-link"}
                onClick={() => setSharePanel("share-link")}
              >
                Share link
              </button>
              <button
                className={sharePanel === "export" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={sharePanel === "export"}
                onClick={() => setSharePanel("export")}
              >
                Export
              </button>
              <button
                className={sharePanel === "send-to" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={sharePanel === "send-to"}
                onClick={() => setSharePanel("send-to")}
              >
                Send to...
              </button>
            </nav>

            <section className="share-modal-panel" role="tabpanel">
              {sharePanel === "share-link" && (
                <>
                  <div className="share-link-section">
                    <div className="share-panel-heading">
                      <span className="share-modal-option-icon">
                        <Users size={17} />
                      </span>
                      <div>
                        <h3>Live collaboration</h3>
                        <p>Invite people to edit this file together.</p>
                      </div>
                    </div>

                    {!isLive && (
                      <div className="share-session-start">
                        <button
                          className="share-modal-primary"
                          type="button"
                          disabled={!canStartSession}
                          title={startSessionUnavailableReason || undefined}
                          onClick={onStartSession}
                        >
                          <Play size={16} />
                          <span>Start session</span>
                        </button>
                        <p>{startSessionUnavailableReason || "Create an editable invite link for this file."}</p>
                      </div>
                    )}

                    {isLive && (
                      <div className="live-room-box">
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
                            <div className="share-link-display" aria-label="Share link" title={shareUrlView.title}>
                              <span>{shareUrlView.display}</span>
                            </div>
                            <button
                              type="button"
                              onClick={onCopyShareUrl}
                              disabled={!shareUrlView.canCopy}
                              title={shareUrlView.canCopy ? undefined : "This live file does not have a valid invite link."}
                            >
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
                  </div>

                  <div className="share-section-divider" aria-hidden="true">
                    <span />
                    <strong>Or</strong>
                    <span />
                  </div>

                  <div className="share-link-section">
                    <div className="share-panel-heading">
                      <span className="share-modal-option-icon">
                        <Link size={17} />
                      </span>
                      <div>
                        <h3>Shareable link</h3>
                        <p>Creates an encrypted snapshot link.</p>
                      </div>
                    </div>

                    {jsonShare.url ? (
                      <div className="share-readonly-box">
                        <div className="share-modal-field">
                          <label>Snapshot link</label>
                          <div className="share-modal-link-row">
                            <a
                              className="share-link-display"
                              href={jsonShare.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Snapshot link"
                              title={jsonShare.url}
                            >
                              <span>{jsonShare.urlPreview}</span>
                            </a>
                            <button type="button" onClick={copyReadOnlyLink}>
                              {exportLinkCopied ? <Check size={17} /> : <Copy size={17} />}
                              <span>{exportLinkCopied ? "Copied" : "Copy link"}</span>
                            </button>
                          </div>
                        </div>

                        <div className="share-readonly-actions">
                          <button
                            className="share-modal-primary"
                            type="button"
                            onClick={handleExportToJsonLink}
                            disabled={!jsonShare.canExport}
                            title={jsonShare.disabledReason || undefined}
                          >
                            <RefreshCw size={16} />
                            <span>{jsonShare.exporting ? "Exporting" : "Update link"}</span>
                          </button>
                          <a className="share-modal-secondary" href={jsonShare.url} target="_blank" rel="noreferrer">
                            <ExternalLink size={16} />
                            <span>Open link</span>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="share-readonly-box">
                        <button
                          className="share-modal-primary"
                          type="button"
                          onClick={handleExportToJsonLink}
                          disabled={!jsonShare.canExport}
                          title={jsonShare.disabledReason || undefined}
                        >
                          <Link size={16} />
                          <span>{jsonShare.exporting ? "Exporting" : "Export to link"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {sharePanel === "export" && (
                <>
                  <div className="share-panel-heading">
                    <span className="share-modal-option-icon">
                      <Download size={17} />
                    </span>
                    <div>
                      <h3>Export Markdown</h3>
                      <p>Take the current file out of Tabula.md.</p>
                    </div>
                  </div>
                  <div className="share-export-grid" aria-label="Export formats">
                    <button className="share-export-card" type="button" onClick={onDownloadMarkdown}>
                      <span className="share-export-icon">
                        <FileText size={18} />
                      </span>
                      <strong>Markdown <span>.md</span></strong>
                      <p>Download the current file as source Markdown.</p>
                    </button>
                    <button className="share-export-card" type="button" onClick={onCopyMarkdown}>
                      <span className="share-export-icon">
                        <Copy size={18} />
                      </span>
                      <strong>Copy Markdown</strong>
                      <p>Copy the current file to the clipboard.</p>
                    </button>
                    <button className="share-export-card disabled" type="button" disabled>
                      <span className="share-export-icon">
                        <FolderArchive size={18} />
                      </span>
                      <strong>Project archive <span>.zip</span></strong>
                      <p>Bundle every project file.</p>
                    </button>
                  </div>
                </>
              )}

              {sharePanel === "send-to" && (
                <>
                  <div className="share-panel-heading">
                    <span className="share-modal-option-icon">
                      <Bot size={17} />
                    </span>
                    <div>
                      <h3>Send to local coding agent</h3>
                      <p>Create a prompt for Codex, Claude Code, or another local coding agent.</p>
                    </div>
                  </div>

                  <div className="send-destination-row">
                    <div className="send-destination-mark" aria-hidden="true">
                      <Bot size={20} />
                    </div>
                    <div>
                      <strong>Local coding agent</strong>
                      <p>Hand off Markdown context as a paste-ready prompt.</p>
                    </div>
                    <button className="share-modal-primary" type="button" onClick={copyLocalAgentPrompt}>
                      {agentPromptCopied ? <Check size={16} /> : <Clipboard size={16} />}
                      <span>{agentPromptCopied ? "Copied" : "Copy prompt"}</span>
                    </button>
                  </div>

                  <div className="send-scope-control" role="group" aria-label="Agent handoff scope">
                    <button
                      className={agentScope === "file" ? "active" : ""}
                      type="button"
                      onClick={() => setAgentScope("file")}
                    >
                      Current file
                    </button>
                    <button
                      className={agentScope === "project" ? "active" : ""}
                      type="button"
                      onClick={() => setAgentScope("project")}
                    >
                      Project
                    </button>
                  </div>

                  <label className="send-instruction-field">
                    <span>What should the agent do?</span>
                    <textarea
                      value={agentInstruction}
                      placeholder={`Implement the next step for ${activeFileDisplayTitle}.`}
                      rows={3}
                      onChange={(event) => setAgentInstruction(event.target.value)}
                    />
                  </label>
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

                      {publish.pageUrl && (
                        <div className="publish-url-card">
                          <span>Public URL</span>
                          <a href={publish.pageUrl} target="_blank" rel="noreferrer" title={publish.pageUrl}>
                            {publishView.publicUrlPreview || publish.pageUrl}
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
                            onClick={() => publish.changeScope(scopeCard.scope)}
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
