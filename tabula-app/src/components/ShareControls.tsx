import { useEffect } from "react";
import { X } from "lucide-react";
import { ShareExportPanel } from "./share/ShareExportPanel";
import { ShareLinkPanel } from "./share/ShareLinkPanel";
import type { JsonShareController } from "../hooks/useJsonShareController";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { useShareDialogRuntime } from "../hooks/useShareDialogRuntime";
import type { ConnectionStatus, RoomRecoveryMode } from "../collaboration";
import type { LocationRoom, WorkspaceFile } from "../workspaceStorage";
import { ModalSurface } from "./ui/ModalSurface";
import { preloadCollaborationStart } from "../collaboration/preloadCollaboration";

type ShareControlsProps = {
  activeFile?: WorkspaceFile;
  room?: LocationRoom | null;
  files: WorkspaceFile[];
  activeText: string;
  language: WorkspaceLanguage;
  currentUserName: string;
  canStartSession: boolean;
  connectionStatus: ConnectionStatus;
  isLive: boolean;
  isLiveConnected: boolean;
  recoveryMode: RoomRecoveryMode;
  shareOpen: boolean;
  copied: boolean;
  jsonShare: JsonShareController;
  startSessionUnavailableReason: string;
  onCloseShare: () => void;
  onStartSession: () => void;
  onRetrySession: () => void;
  onCopyShareUrl: () => void;
  onChangeUserName: (nextName: string) => void;
  onCommitUserName: () => void;
  onStopSession: () => void;
};

export function ShareControls({
  activeFile,
  room,
  files,
  activeText,
  language,
  currentUserName,
  canStartSession,
  connectionStatus,
  isLive,
  isLiveConnected,
  recoveryMode,
  shareOpen,
  copied,
  jsonShare,
  startSessionUnavailableReason,
  onCloseShare,
  onStartSession,
  onRetrySession,
  onCopyShareUrl,
  onChangeUserName,
  onCommitUserName,
  onStopSession,
}: ShareControlsProps) {
  const showLiveRoomPanel =
    isLive &&
    (isLiveConnected ||
      connectionStatus === "reconnecting" ||
      connectionStatus === "disconnected");
  useEffect(() => {
    if (!shareOpen || isLive || !canStartSession) return;
    void preloadCollaborationStart().catch(() => undefined);
  }, [canStartSession, isLive, shareOpen]);
  const shareRuntime = useShareDialogRuntime({
    activeFile,
    room,
    activeText,
    canStartSession: canStartSession && !isLive,
    files,
    isLive: showLiveRoomPanel,
    isLiveConnected,
    jsonShare,
    language,
    shareOpen,
    startSessionUnavailableReason,
    onCloseShare,
    onStopSession,
  });

  return shareOpen ? (
    <ModalSurface ariaLabelledBy="share-modal-title" onClose={onCloseShare}>
              <button
                className="share-modal-close"
                type="button"
                aria-label={shareRuntime.chromeCopy.common.closeShareDialog}
                data-modal-initial-focus
                onClick={onCloseShare}
              >
                <X size={18} />
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
                    recoveryMode={recoveryMode}
                    shareView={shareRuntime.shareView}
                    exportPanel={
                      <ShareExportPanel
                        copy={shareRuntime.copy}
                        exportLinkCopied={shareRuntime.exportLinkCopied}
                        jsonShare={jsonShare}
                        shareView={shareRuntime.shareView}
                        onCopyShareableLink={shareRuntime.copyShareableLink}
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
              </section>
    </ModalSurface>
  ) : null;
}
