import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  Square,
  Users,
  X,
} from "lucide-react";
import type { JsonShareController } from "../hooks/useJsonShareController";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import {
  buildShareViewModel,
  normalizeSharePanel,
  type VisibleSharePanel,
} from "../shareViewModel";
import type { SharePanel } from "../uiTypes";
import {
  getWorkspaceChromeCopy,
  getWorkspaceMenuCopy,
} from "../workspaceLocale";
import type { WorkspaceFile } from "../workspaceStorage";

type ShareControlsProps = {
  activeFile?: WorkspaceFile;
  files: WorkspaceFile[];
  activeFileTitle: string;
  language: WorkspaceLanguage;
  currentUserName: string;
  canStartSession: boolean;
  isLive: boolean;
  shareOpen: boolean;
  sharePanelTarget?: SharePanel;
  copied: boolean;
  jsonShare: JsonShareController;
  startSessionUnavailableReason: string;
  onToggleShare: () => void;
  onCloseShare: () => void;
  onStartSession: () => void;
  onCopyShareUrl: () => void;
  onCopyFile: () => void;
  onDownloadFile: () => void;
  onDownloadProjectArchive: () => void;
  onChangeUserName: (nextName: string) => void;
  onCommitUserName: () => void;
  onStopSession: () => void;
};

export type { SharePanel } from "../uiTypes";

type AgentHandoffScope = "file" | "project";

const buildLocalAgentPrompt = ({
  activeFile,
  files,
  instruction,
  scope,
}: {
  activeFile?: WorkspaceFile;
  files: WorkspaceFile[];
  instruction: string;
  scope: AgentHandoffScope;
}) => {
  const trimmedInstruction = instruction.trim();
  const visibleFiles =
    scope === "project" ? files : activeFile ? [activeFile] : [];
  const fileSections = visibleFiles
    .map(
      (file) =>
        `## ${file.title}\n\n\`\`\`markdown\n${file.text.trimEnd()}\n\`\`\``,
    )
    .join("\n\n");

  return [
    "Use the following Tabula.md file context.",
    trimmedInstruction
      ? `Task: ${trimmedInstruction}`
      : "Task: Help me continue from this context.",
    "",
    `Scope: ${scope === "project" ? "project" : "current file"}`,
    "",
    fileSections || "No file content is available.",
  ].join("\n");
};

export function ShareControls({
  activeFile,
  files,
  activeFileTitle,
  language,
  currentUserName,
  canStartSession,
  isLive,
  shareOpen,
  sharePanelTarget,
  copied,
  jsonShare,
  startSessionUnavailableReason,
  onToggleShare,
  onCloseShare,
  onStartSession,
  onCopyShareUrl,
  onCopyFile,
  onDownloadFile,
  onDownloadProjectArchive,
  onChangeUserName,
  onCommitUserName,
  onStopSession,
}: ShareControlsProps) {
  const [sharePanel, setSharePanel] = useState<VisibleSharePanel>("share-link");
  const [agentScope, setAgentScope] = useState<AgentHandoffScope>("file");
  const [agentInstruction, setAgentInstruction] = useState("");
  const [agentPromptCopied, setAgentPromptCopied] = useState(false);
  const [exportLinkCopied, setExportLinkCopied] = useState(false);
  const activeFileDisplayTitle = activeFileTitle.replace(
    /\.(?:md|markdown)$/i,
    "",
  );
  const copy = getWorkspaceMenuCopy(language).share;
  const chromeCopy = getWorkspaceChromeCopy(language);
  const shareModalTitle = copy.modalTitle(activeFileDisplayTitle);
  const shareView = buildShareViewModel({
    activePanel: sharePanel,
    canStartSession,
    isLive,
    labels: {
      shareLink: copy.tabs.shareLink,
      export: copy.tabs.export,
      sendTo: copy.tabs.sendTo,
      exportToLink: copy.shareable.exportToLink,
      exporting: copy.shareable.exporting,
      updateLink: copy.shareable.updateLink,
    },
    jsonShareCanExport: jsonShare.canExport,
    jsonShareDisabledReason: jsonShare.disabledReason,
    jsonShareExporting: jsonShare.exporting,
    jsonShareUrl: jsonShare.url,
    roomId: activeFile?.roomId,
    shareUrl: activeFile?.shareUrl,
    startSessionUnavailableReason,
  });

  useEffect(() => {
    if (shareOpen) {
      setSharePanel(normalizeSharePanel(sharePanelTarget));
    }
  }, [activeFile?.id, shareOpen, sharePanelTarget]);

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
    const confirmed = window.confirm(copy.live.stopConfirm);

    if (confirmed) {
      onStopSession();
    }
  };

  const handleExportToJsonLink = () => {
    void jsonShare.exportLink().finally(() => setExportLinkCopied(false));
  };

  const copyShareableLink = async () => {
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

  return (
    <>
      <div className="share-wrap">
        <button
          className={`share-button share-trigger ${shareOpen ? "active" : ""}`}
          type="button"
          aria-label={shareModalTitle}
          title={copy.trigger}
          aria-expanded={shareOpen}
          onClick={onToggleShare}
        >
          <Share2 size={15} />
          <span className="share-label-visible">{copy.trigger}</span>
        </button>
      </div>

      {shareOpen &&
        createPortal(
          <div
            className="share-modal-layer"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) {
                onCloseShare();
              }
            }}
          >
            <section
              className="share-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="share-modal-title"
            >
              <button
                className="share-modal-close"
                type="button"
                aria-label={chromeCopy.common.closeShareDialog}
                onClick={onCloseShare}
              >
                <X size={17} />
              </button>

              <header className="share-modal-header">
                <h2 id="share-modal-title">{shareModalTitle}</h2>
              </header>

              <nav
                className="share-modal-tabs"
                role="tablist"
                aria-label={copy.purposeAria}
              >
                {shareView.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={shareView.activePanel === tab.id ? "active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={shareView.activePanel === tab.id}
                    onClick={() => setSharePanel(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              <section className="share-modal-panel" role="tabpanel">
                {shareView.activePanel === "share-link" && (
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
                          <p>
                            {shareView.live.disabledReason ||
                              copy.live.startDescription}
                          </p>
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
                              onChange={(event) =>
                                onChangeUserName(event.target.value)
                              }
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
                                {copied ? (
                                  <Check size={17} />
                                ) : (
                                  <Copy size={17} />
                                )}
                                <span>
                                  {copied
                                    ? copy.live.copied
                                    : copy.live.copyLink}
                                </span>
                              </button>
                            </div>
                          </div>

                          <button
                            className="share-modal-danger"
                            type="button"
                            onClick={handleStopSession}
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
                              <button type="button" onClick={copyShareableLink}>
                                {exportLinkCopied ? (
                                  <Check size={17} />
                                ) : (
                                  <Copy size={17} />
                                )}
                                <span>
                                  {exportLinkCopied
                                    ? copy.live.copied
                                    : copy.live.copyLink}
                                </span>
                              </button>
                            </div>
                          </div>

                          <div className="share-copy-actions">
                            <button
                              className="share-modal-primary"
                              type="button"
                              onClick={handleExportToJsonLink}
                              disabled={!jsonShare.canExport}
                              title={
                                shareView.shareable.disabledReason || undefined
                              }
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
                        </div>
                      ) : (
                        <div className="share-copy-box">
                          <button
                            className="share-modal-primary"
                            type="button"
                            onClick={handleExportToJsonLink}
                            disabled={!jsonShare.canExport}
                            title={
                              shareView.shareable.disabledReason || undefined
                            }
                          >
                            <Link size={16} />
                            <span>{shareView.shareable.primaryLabel}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {shareView.activePanel === "export" && (
                  <>
                    <div className="share-panel-heading">
                      <span className="share-modal-option-icon">
                        <Download size={17} />
                      </span>
                      <div>
                        <h3>{copy.exportPanel.title}</h3>
                        <p>{copy.exportPanel.description}</p>
                      </div>
                    </div>
                    <div
                      className="share-export-grid"
                      aria-label={copy.exportPanel.title}
                    >
                      <button
                        className="share-export-card"
                        type="button"
                        onClick={onDownloadFile}
                      >
                        <span className="share-export-icon">
                          <FileText size={18} />
                        </span>
                        <strong>
                          {copy.exportPanel.fileTitle} <span>.md</span>
                        </strong>
                        <p>{copy.exportPanel.fileDescription}</p>
                      </button>
                      <button
                        className="share-export-card"
                        type="button"
                        onClick={onCopyFile}
                      >
                        <span className="share-export-icon">
                          <Copy size={18} />
                        </span>
                        <strong>{copy.exportPanel.copyFileTitle}</strong>
                        <p>{copy.exportPanel.copyFileDescription}</p>
                      </button>
                      <button
                        className="share-export-card"
                        type="button"
                        onClick={onDownloadProjectArchive}
                      >
                        <span className="share-export-icon">
                          <FolderArchive size={18} />
                        </span>
                        <strong>
                          {copy.exportPanel.projectArchiveTitle}{" "}
                          <span>.zip</span>
                        </strong>
                        <p>{copy.exportPanel.projectArchiveDescription}</p>
                      </button>
                    </div>
                  </>
                )}

                {shareView.activePanel === "send-to" && (
                  <>
                    <div className="share-panel-heading">
                      <span className="share-modal-option-icon">
                        <Bot size={17} />
                      </span>
                      <div>
                        <h3>{copy.sendTo.title}</h3>
                        <p>{copy.sendTo.description}</p>
                      </div>
                    </div>

                    <div className="send-destination-row">
                      <div className="send-destination-mark" aria-hidden="true">
                        <Bot size={20} />
                      </div>
                      <div>
                        <strong>{copy.sendTo.destinationTitle}</strong>
                        <p>{copy.sendTo.destinationDescription}</p>
                      </div>
                      <button
                        className="share-modal-primary"
                        type="button"
                        onClick={copyLocalAgentPrompt}
                      >
                        {agentPromptCopied ? (
                          <Check size={16} />
                        ) : (
                          <Clipboard size={16} />
                        )}
                        <span>
                          {agentPromptCopied
                            ? copy.live.copied
                            : copy.sendTo.copyPrompt}
                        </span>
                      </button>
                    </div>

                    <div
                      className="send-scope-control"
                      role="group"
                      aria-label="Agent handoff scope"
                    >
                      <button
                        className={agentScope === "file" ? "active" : ""}
                        type="button"
                        onClick={() => setAgentScope("file")}
                      >
                        {copy.sendTo.currentFile}
                      </button>
                      <button
                        className={agentScope === "project" ? "active" : ""}
                        type="button"
                        onClick={() => setAgentScope("project")}
                      >
                        {copy.sendTo.project}
                      </button>
                    </div>

                    <label className="send-instruction-field">
                      <span>{copy.sendTo.instructionLabel}</span>
                      <textarea
                        value={agentInstruction}
                        placeholder={copy.sendTo.instructionPlaceholder(
                          activeFileDisplayTitle,
                        )}
                        rows={3}
                        onChange={(event) =>
                          setAgentInstruction(event.target.value)
                        }
                      />
                    </label>
                  </>
                )}
              </section>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
