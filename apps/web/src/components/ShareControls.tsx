import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Share2,
  X,
} from "lucide-react";
import { ShareExportPanel } from "./share/ShareExportPanel";
import { ShareLinkPanel } from "./share/ShareLinkPanel";
import { ShareSendToPanel } from "./share/ShareSendToPanel";
import type { JsonShareController } from "../hooks/useJsonShareController";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import {
  buildLocalAgentPrompt,
  type AgentHandoffScope,
} from "../shareAgentHandoff";
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
                  <ShareLinkPanel
                    chromeCopy={chromeCopy}
                    copied={copied}
                    copy={copy}
                    currentUserName={currentUserName}
                    exportLinkCopied={exportLinkCopied}
                    isLive={isLive}
                    jsonShare={jsonShare}
                    shareView={shareView}
                    onChangeUserName={onChangeUserName}
                    onCommitUserName={onCommitUserName}
                    onCopyShareUrl={onCopyShareUrl}
                    onCopyShareableLink={copyShareableLink}
                    onExportToJsonLink={handleExportToJsonLink}
                    onStartSession={onStartSession}
                    onStopSession={handleStopSession}
                  />
                )}

                {shareView.activePanel === "export" && (
                  <ShareExportPanel
                    copy={copy}
                    onCopyFile={onCopyFile}
                    onDownloadFile={onDownloadFile}
                    onDownloadProjectArchive={onDownloadProjectArchive}
                  />
                )}

                {shareView.activePanel === "send-to" && (
                  <ShareSendToPanel
                    activeFileDisplayTitle={activeFileDisplayTitle}
                    agentInstruction={agentInstruction}
                    agentPromptCopied={agentPromptCopied}
                    agentScope={agentScope}
                    copy={copy}
                    onChangeAgentInstruction={setAgentInstruction}
                    onChangeAgentScope={setAgentScope}
                    onCopyLocalAgentPrompt={copyLocalAgentPrompt}
                  />
                )}
              </section>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
