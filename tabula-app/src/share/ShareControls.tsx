import { ShareExportPanel } from "./ShareExportPanel";
import { ShareExportResult } from "./ShareExportResult";
import { ShareLinkPanel } from "./ShareLinkPanel";
import { ShareStopSessionConfirm } from "./ShareStopSessionConfirm";
import type { JsonShareController } from "./useJsonShareController";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { useShareDialogController } from "./useShareDialogController";
import type { ConnectionStatus } from "../collaboration/liveCollaboration";
import type { LocationRoom } from "../workspace/workspaceStorage";
import { ModalSurface } from "../ui/ModalSurface";
import { X } from "lucide-react";

type ShareControlsProps = {
  room?: LocationRoom | null;
  language: WorkspaceLanguage;
  currentUserName: string;
  connectionStatus: ConnectionStatus;
  isStartingLive: boolean;
  isLive: boolean;
  shareOpen: boolean;
  copied: boolean;
  jsonShare: JsonShareController;
  onCloseShare: () => void;
  onCopyFailed: () => void;
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
  isStartingLive,
  isLive,
  shareOpen,
  copied,
  jsonShare,
  onCloseShare,
  onCopyFailed,
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
    onCopyFailed,
    onStopSession,
  });
  const choiceLocked = isStartingLive || jsonShare.exporting;

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
        className="share-main-modal share-export-result-modal"
        onClose={shareController.closeShare}
      >
        <button
          className="share-modal-close share-main-mobile-close"
          type="button"
          aria-label={shareController.copy.close}
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
      className={`share-main-modal ${showLiveRoomPanel ? "share-live-result-modal" : "share-chooser-modal"}`}
      onClose={shareController.closeShare}
    >
      <button
        className="share-modal-close share-main-mobile-close"
        type="button"
        aria-label={shareController.copy.close}
        onClick={shareController.closeShare}
      >
        <X size={18} />
      </button>
      <h2
        className="share-modal-title-hidden"
        data-modal-initial-focus={showLiveRoomPanel ? undefined : true}
        id="share-modal-title"
        tabIndex={-1}
      >
        {shareController.shareModalTitle}
      </h2>

      <section className={`share-modal-panel ${showLiveRoomPanel ? "live" : "chooser"}`}>
        <div className="share-modal-actions-column">
          <ShareLinkPanel
            agentInviteCopied={shareController.agentInviteCopied}
            copied={copied}
            copy={shareController.copy}
            currentUserName={currentUserName}
            connectionStatus={connectionStatus}
            choiceLocked={choiceLocked}
            isLive={showLiveRoomPanel}
            shareView={shareController.shareView}
            exportPanel={
              <ShareExportPanel
                copy={shareController.copy}
                jsonShare={jsonShare}
                locked={choiceLocked}
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
