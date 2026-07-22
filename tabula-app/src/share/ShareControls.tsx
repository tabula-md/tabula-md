import { X } from "lucide-react";
import { ShareExportPanel } from "./ShareExportPanel";
import { ShareExportResult } from "./ShareExportResult";
import { ShareLinkPanel } from "./ShareLinkPanel";
import { ShareStopSessionConfirm } from "./ShareStopSessionConfirm";
import type { JsonShareController } from "./useJsonShareController";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { useShareDialogController } from "./useShareDialogController";
import type { ConnectionStatus, RoomRecoveryMode } from "../collaboration/liveCollaboration";
import type { LocationRoom } from "../workspace/workspaceStorage";
import { ModalSurface } from "../ui/ModalSurface";

type ShareControlsProps = {
  room?: LocationRoom | null;
  language: WorkspaceLanguage;
  currentUserName: string;
  canStartSession: boolean;
  connectionStatus: ConnectionStatus;
  isLive: boolean;
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
  canStartSession,
  connectionStatus,
  isLive,
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
  const shareController = useShareDialogController({
    room,
    isLive: showLiveRoomPanel,
    jsonShare,
    language,
    onCloseShare,
    onStopSession,
  });

  if (!shareOpen) return null;

  if (shareController.view === "stop-confirm") {
    return (
      <ModalSurface
        key="stop-confirm"
        ariaLabelledBy="share-stop-session-title"
        className="share-confirm-modal"
        onClose={shareController.cancelStopSession}
      >
        <ShareStopSessionConfirm
          copy={shareController.copy}
          onCancel={shareController.cancelStopSession}
          onConfirm={shareController.confirmStopSession}
        />
      </ModalSurface>
    );
  }

  if (shareController.view === "export-result") {
    return (
      <ModalSurface
        key="export-result"
        ariaLabelledBy="share-export-result-title"
        className="share-export-result-modal"
        onClose={shareController.closeShare}
      >
        <button
          className="share-modal-close"
          type="button"
          aria-label={shareController.chromeCopy.common.closeShareDialog}
          onClick={shareController.closeShare}
        >
          <X size={18} />
        </button>
        <ShareExportResult
          copy={shareController.copy}
          exportLinkCopied={shareController.exportLinkCopied}
          jsonShare={jsonShare}
          onCopyShareableLink={shareController.copyShareableLink}
        />
      </ModalSurface>
    );
  }

  return (
    <ModalSurface
      key="chooser"
      ariaLabelledBy="share-modal-title"
      onClose={shareController.closeShare}
    >
      <button
        className="share-modal-close"
        type="button"
        aria-label={shareController.chromeCopy.common.closeShareDialog}
        data-modal-initial-focus
        onClick={shareController.closeShare}
      >
        <X size={18} />
      </button>

      <h2 className="share-modal-title-hidden" id="share-modal-title">
        {shareController.shareModalTitle}
      </h2>

      <section className={`share-modal-panel ${showLiveRoomPanel ? "live" : "chooser"}`}>
        <div className="share-modal-actions-column">
          <ShareLinkPanel
            agentInviteCopied={shareController.agentInviteCopied}
            chromeCopy={shareController.chromeCopy}
            copied={copied}
            copy={shareController.copy}
            currentUserName={currentUserName}
            canStartSession={canStartSession}
            connectionStatus={connectionStatus}
            isLive={showLiveRoomPanel}
            recoveryMode={recoveryMode}
            shareView={shareController.shareView}
            exportPanel={
              <ShareExportPanel
                copy={shareController.copy}
                jsonShare={jsonShare}
                shareView={shareController.shareView}
                onExportToJsonLink={shareController.exportToJsonLink}
              />
            }
            onChangeUserName={onChangeUserName}
            onCommitUserName={onCommitUserName}
            onCopyAgentInvite={shareController.copyAgentInvite}
            onCopyShareUrl={onCopyShareUrl}
            onRetrySession={onRetrySession}
            onStartWorkspaceRoom={onStartSession}
            onStopSession={shareController.requestStopSession}
          />
        </div>
      </section>
    </ModalSurface>
  );
}
