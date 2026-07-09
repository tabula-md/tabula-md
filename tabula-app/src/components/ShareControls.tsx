import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ShareExportPanel } from "./share/ShareExportPanel";
import { ShareIncludedDocuments } from "./share/ShareIncludedDocuments";
import { ShareLinkPanel } from "./share/ShareLinkPanel";
import type { JsonShareController } from "../hooks/useJsonShareController";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { useShareDialogRuntime } from "../hooks/useShareDialogRuntime";
import type { ConnectionStatus } from "../collaboration";
import type { WorkspaceFile } from "../workspaceStorage";

type ShareControlsProps = {
  activeFile?: WorkspaceFile;
  files: WorkspaceFile[];
  activeText: string;
  language: WorkspaceLanguage;
  currentUserName: string;
  canStartSession: boolean;
  connectionStatus: ConnectionStatus;
  isLive: boolean;
  isLiveConnected: boolean;
  shareExcludedFileIds: readonly string[];
  shareOpen: boolean;
  copied: boolean;
  jsonShare: JsonShareController;
  startSessionUnavailableReason: string;
  onCloseShare: () => void;
  onStartSession: () => void;
  onRetrySession: () => void;
  onCopyShareUrl: () => void;
  onDownloadProjectArchive: (fileIds?: readonly string[]) => void;
  onChangeUserName: (nextName: string) => void;
  onCommitUserName: () => void;
  onStopSession: () => void;
  onToggleShareFileExcluded: (fileId: string) => void;
};

export function ShareControls({
  activeFile,
  files,
  activeText,
  language,
  currentUserName,
  canStartSession,
  connectionStatus,
  isLive,
  isLiveConnected,
  shareExcludedFileIds,
  shareOpen,
  copied,
  jsonShare,
  startSessionUnavailableReason,
  onCloseShare,
  onStartSession,
  onRetrySession,
  onCopyShareUrl,
  onDownloadProjectArchive,
  onChangeUserName,
  onCommitUserName,
  onStopSession,
  onToggleShareFileExcluded,
}: ShareControlsProps) {
  const showLiveRoomPanel =
    isLive &&
    (isLiveConnected ||
      connectionStatus === "reconnecting" ||
      connectionStatus === "disconnected");
  const shareRuntime = useShareDialogRuntime({
    activeFile,
    activeText,
    canStartSession: canStartSession && !isLive,
    files,
    isLive: showLiveRoomPanel,
    isLiveConnected,
    jsonShare,
    language,
    shareExcludedFileIds,
    shareOpen,
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
              className={`share-modal ${showLiveRoomPanel ? "share-modal-live" : "share-modal-chooser"}`}
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

              <h2 className="share-modal-title-hidden" id="share-modal-title">
                {shareRuntime.shareModalTitle}
              </h2>

              <section className={`share-modal-panel ${showLiveRoomPanel ? "live" : "chooser"}`}>
                <div className="share-modal-actions-column">
                  <ShareLinkPanel
                    agentPromptCopied={shareRuntime.agentPromptCopied}
                    chromeCopy={shareRuntime.chromeCopy}
                    copied={copied}
                    copy={shareRuntime.copy}
                    currentUserName={currentUserName}
                    connectionStatus={connectionStatus}
                    isLive={showLiveRoomPanel}
                    isLiveConnected={isLiveConnected}
                    shareView={shareRuntime.shareView}
                    exportPanel={
                      <ShareExportPanel
                        copy={shareRuntime.copy}
                        exportLinkCopied={shareRuntime.exportLinkCopied}
                        includedFileCount={shareRuntime.includedFileCount}
                        includedFileIds={shareRuntime.includedFileIds}
                        jsonShare={jsonShare}
                        shareView={shareRuntime.shareView}
                        onCopyShareableLink={shareRuntime.copyShareableLink}
                        onDownloadProjectArchive={onDownloadProjectArchive}
                        onExportToJsonLink={shareRuntime.exportToJsonLink}
                      />
                    }
                    onChangeUserName={onChangeUserName}
                    onCommitUserName={onCommitUserName}
                    onCopyLocalAgentPrompt={shareRuntime.copyLocalAgentPrompt}
                    onCopyShareUrl={onCopyShareUrl}
                    onRetrySession={onRetrySession}
                    onStartWorkspaceRoom={onStartSession}
                    onStopSession={shareRuntime.stopSession}
                  />
                </div>

                {!showLiveRoomPanel && (
                  <aside className="share-modal-scope-column">
                    <ShareIncludedDocuments
                      copy={shareRuntime.copy}
                      excludedFileIds={shareRuntime.excludedFileIds}
                      files={files}
                      includedFileCount={shareRuntime.includedFileCount}
                      onToggleFileExcluded={onToggleShareFileExcluded}
                    />
                  </aside>
                )}
              </section>
            </section>
          </div>,
          document.body,
        )
      : null
  );
}
