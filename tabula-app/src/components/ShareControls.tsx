import { X } from "lucide-react";
import { ShareExportPanel } from "./share/ShareExportPanel";
import { ShareExportResult } from "./share/ShareExportResult";
import { ShareLinkPanel } from "./share/ShareLinkPanel";
import { ShareStopSessionConfirm } from "./share/ShareStopSessionConfirm";
import type { JsonShareController } from "../hooks/useJsonShareController";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { useShareDialogRuntime } from "../hooks/useShareDialogRuntime";
import type { ConnectionStatus, RoomRecoveryMode } from "../collaboration/liveCollaboration";
import type { LocationRoom } from "../workspaceStorage";
import { ModalSurface } from "./ui/ModalSurface";

type ShareControlsProps = {
  room?: LocationRoom | null;
  language: WorkspaceLanguage;
  currentUserName: string;
  connectionStatus: ConnectionStatus;
  isLive: boolean;
  isLiveConnected: boolean;
  recoveryMode: RoomRecoveryMode;
  shareOpen: boolean;
  copied: boolean;
  jsonShare: JsonShareController;
  onCloseShare: () => void;
  onStartSession: () => void;
  onRetrySession: () => void;
  onCopyShareUrl: () => void;
  onChangeUserName: (nextName: string) => void;
  onCommitUserName: () => void;
  onStopSession: () => void;
};

export function ShareControls({
  room,
  language,
  currentUserName,
  connectionStatus,
  isLive,
  isLiveConnected,
  recoveryMode,
  shareOpen,
  copied,
  jsonShare,
  onCloseShare,
  onStartSession,
  onRetrySession,
  onCopyShareUrl,
  onChangeUserName,
  onCommitUserName,
  onStopSession,
}: ShareControlsProps) {
  const showLiveRoomPanel = isLive;
  const shareRuntime = useShareDialogRuntime({
    room,
    isLive: showLiveRoomPanel,
    isLiveConnected,
    jsonShare,
    language,
    onCloseShare,
    onStopSession,
  });

  if (!shareOpen) return null;

  if (shareRuntime.view === "stop-confirm") {
    return (
      <ModalSurface
        key="stop-confirm"
        ariaLabelledBy="share-stop-session-title"
        className="share-confirm-modal"
        onClose={shareRuntime.cancelStopSession}
      >
        <ShareStopSessionConfirm
          copy={shareRuntime.copy}
          onCancel={shareRuntime.cancelStopSession}
          onConfirm={shareRuntime.confirmStopSession}
        />
      </ModalSurface>
    );
  }

  if (shareRuntime.view === "export-result") {
    return (
      <ModalSurface
        key="export-result"
        ariaLabelledBy="share-export-result-title"
        className="share-export-result-modal"
        onClose={shareRuntime.closeShare}
      >
        <button
          className="share-modal-close"
          type="button"
          aria-label={shareRuntime.chromeCopy.common.closeShareDialog}
          onClick={shareRuntime.closeShare}
        >
          <X size={18} />
        </button>
        <ShareExportResult
          copy={shareRuntime.copy}
          exportLinkCopied={shareRuntime.exportLinkCopied}
          jsonShare={jsonShare}
          onCopyShareableLink={shareRuntime.copyShareableLink}
        />
      </ModalSurface>
    );
  }

  return (
    <ModalSurface
      key="chooser"
      ariaLabelledBy="share-modal-title"
      onClose={shareRuntime.closeShare}
    >
      <button
        className="share-modal-close"
        type="button"
        aria-label={shareRuntime.chromeCopy.common.closeShareDialog}
        data-modal-initial-focus
        onClick={shareRuntime.closeShare}
      >
        <X size={18} />
      </button>

      <h2 className="share-modal-title-hidden" id="share-modal-title">
        {shareRuntime.shareModalTitle}
      </h2>

      <section className={`share-modal-panel ${showLiveRoomPanel ? "live" : "chooser"}`}>
        <div className="share-modal-actions-column">
          <ShareLinkPanel
            agentInviteCopied={shareRuntime.agentInviteCopied}
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
                jsonShare={jsonShare}
                shareView={shareRuntime.shareView}
                onExportToJsonLink={shareRuntime.exportToJsonLink}
              />
            }
            onChangeUserName={onChangeUserName}
            onCommitUserName={onCommitUserName}
            onCopyAgentInvite={shareRuntime.copyAgentInvite}
            onCopyShareUrl={onCopyShareUrl}
            onRetrySession={onRetrySession}
            onStartWorkspaceRoom={onStartSession}
            onStopSession={shareRuntime.requestStopSession}
          />
        </div>
      </section>
    </ModalSurface>
  );
}
