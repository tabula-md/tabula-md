import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ShareExportPanel } from "./share/ShareExportPanel";
import { ShareLinkPanel } from "./share/ShareLinkPanel";
import { ShareSendToPanel } from "./share/ShareSendToPanel";
import type { JsonShareController } from "../hooks/useJsonShareController";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { useShareDialogRuntime } from "../hooks/useShareDialogRuntime";
import type { SharePanel } from "../uiTypes";
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
  const shareRuntime = useShareDialogRuntime({
    activeFile,
    activeFileTitle,
    canStartSession,
    files,
    isLive,
    jsonShare,
    language,
    shareOpen,
    sharePanelTarget,
    startSessionUnavailableReason,
    onCloseShare,
    onStopSession,
  });

  return (
    shareOpen
      ? createPortal(
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
                aria-label={shareRuntime.chromeCopy.common.closeShareDialog}
                onClick={onCloseShare}
              >
                <X size={17} />
              </button>

              <header className="share-modal-header">
                <h2 id="share-modal-title">{shareRuntime.shareModalTitle}</h2>
              </header>

              <nav
                className="share-modal-tabs"
                role="tablist"
                aria-label={shareRuntime.copy.purposeAria}
              >
                {shareRuntime.shareView.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={shareRuntime.shareView.activePanel === tab.id ? "active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={shareRuntime.shareView.activePanel === tab.id}
                    onClick={() => shareRuntime.setSharePanel(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              <section className="share-modal-panel" role="tabpanel">
                {shareRuntime.shareView.activePanel === "share-link" && (
                  <ShareLinkPanel
                    chromeCopy={shareRuntime.chromeCopy}
                    copied={copied}
                    copy={shareRuntime.copy}
                    currentUserName={currentUserName}
                    exportLinkCopied={shareRuntime.exportLinkCopied}
                    isLive={isLive}
                    jsonShare={jsonShare}
                    shareView={shareRuntime.shareView}
                    onChangeUserName={onChangeUserName}
                    onCommitUserName={onCommitUserName}
                    onCopyShareUrl={onCopyShareUrl}
                    onCopyShareableLink={shareRuntime.copyShareableLink}
                    onExportToJsonLink={shareRuntime.exportToJsonLink}
                    onStartSession={onStartSession}
                    onStopSession={shareRuntime.stopSession}
                  />
                )}

                {shareRuntime.shareView.activePanel === "export" && (
                  <ShareExportPanel
                    copy={shareRuntime.copy}
                    onCopyFile={onCopyFile}
                    onDownloadFile={onDownloadFile}
                    onDownloadProjectArchive={onDownloadProjectArchive}
                  />
                )}

                {shareRuntime.shareView.activePanel === "send-to" && (
                  <ShareSendToPanel
                    activeFileDisplayTitle={shareRuntime.activeFileDisplayTitle}
                    agentInstruction={shareRuntime.agentInstruction}
                    agentPromptCopied={shareRuntime.agentPromptCopied}
                    agentScope={shareRuntime.agentScope}
                    copy={shareRuntime.copy}
                    onChangeAgentInstruction={shareRuntime.setAgentInstruction}
                    onChangeAgentScope={shareRuntime.setAgentScope}
                    onCopyLocalAgentPrompt={shareRuntime.copyLocalAgentPrompt}
                  />
                )}
              </section>
            </section>
          </div>,
          document.body,
        )
      : null
  );
}
