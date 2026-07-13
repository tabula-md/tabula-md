import { lazy, Suspense, useMemo, type ComponentProps } from "react";
import { FileTabs } from "./FileTabs";
import { ShareControlsBoundary } from "./ShareControlsBoundary";
import { ShareTrigger } from "./ShareTrigger";
import { TopChrome } from "./TopChrome";
import type { Collaborator, ConnectionStatus } from "../collaboration";
import type { FollowState } from "../collaboration/followModel";
import type { JsonShareController } from "../hooks/useJsonShareController";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getCollaboratorDisplayList } from "../collaboration/collabCollaborators";
import {
  type LocationRoom,
  type WorkspaceFile,
  type WorkspaceFolder,
} from "../workspaceStorage";

type FileTabsProps = ComponentProps<typeof FileTabs>;

const ShareControls = lazy(() =>
  import("./ShareControls").then(({ ShareControls }) => ({
    default: ShareControls,
  })),
);

export type WorkspaceTopChromeProps = {
  activeFile?: WorkspaceFile;
  activeText: string;
  canStartSession: boolean;
  collaborators: Collaborator[];
  followState: FollowState;
  connectionStatus: ConnectionStatus;
  copied: boolean;
  currentUserName: string;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  identity: Collaborator;
  isLive: boolean;
  isLiveConnected: boolean;
  jsonShare: JsonShareController;
  language: WorkspaceLanguage;
  openFiles: WorkspaceFile[];
  room?: LocationRoom | null;
  rightPanelOpen: boolean;
  shareOpen: boolean;
  startSessionUnavailableReason: string;
  workspaceMenuOpen: boolean;
  onAddFile: FileTabsProps["onAddFile"];
  onChangeUserName: (nextName: string) => void;
  onChromeInteraction: NonNullable<FileTabsProps["onChromeInteraction"]>;
  onCloseFile: FileTabsProps["onCloseFile"];
  onCloseShare: () => void;
  onShareLoadError: () => void;
  onCommitUserName: () => void;
  onCopyShareUrl: () => void;
  onDownloadProjectArchive: () => void;
  onReorderFiles: FileTabsProps["onReorderFiles"];
  onRenameFile: FileTabsProps["onRenameFile"];
  onSelectFile: FileTabsProps["onSelectFile"];
  onStartSession: () => void;
  onStopSession: () => void;
  onRetrySession: () => void;
  onToggleRightPanel: () => void;
  onToggleFollowing: (actorId: string) => void;
  onToggleShare: () => void;
  onToggleWorkspaceMenu: () => void;
};

export function WorkspaceTopChrome({
  activeFile,
  activeText,
  canStartSession,
  collaborators,
  followState,
  connectionStatus,
  copied,
  currentUserName,
  files,
  folders,
  identity,
  isLive,
  isLiveConnected,
  jsonShare,
  language,
  openFiles,
  room,
  rightPanelOpen,
  shareOpen,
  startSessionUnavailableReason,
  workspaceMenuOpen,
  onAddFile,
  onChangeUserName,
  onChromeInteraction,
  onCloseFile,
  onCloseShare,
  onShareLoadError,
  onCommitUserName,
  onCopyShareUrl,
  onDownloadProjectArchive,
  onReorderFiles,
  onRenameFile,
  onSelectFile,
  onStartSession,
  onStopSession,
  onRetrySession,
  onToggleRightPanel,
  onToggleFollowing,
  onToggleShare,
  onToggleWorkspaceMenu,
}: WorkspaceTopChromeProps) {
  const displayedParticipants = useMemo(
    () => getCollaboratorDisplayList([identity, ...collaborators]),
    [collaborators, identity],
  );
  const displayedIdentity =
    displayedParticipants.find((participant) => participant.id === identity.id) ?? identity;
  const displayedCollaborators = displayedParticipants.filter(
    (participant) => participant.id !== identity.id,
  );

  const fileTabs = (
    <FileTabs
      files={openFiles}
      folders={folders}
      activeFile={activeFile}
      collaborators={displayedCollaborators}
      roomId={room?.roomId}
      language={language}
      onAddFile={onAddFile}
      onSelectFile={onSelectFile}
      onRenameFile={onRenameFile}
      onCloseFile={onCloseFile}
      onReorderFiles={onReorderFiles}
      onChromeInteraction={onChromeInteraction}
    />
  );

  const shareControls = activeFile || room ? (
    <>
      <ShareTrigger
        connectionStatus={connectionStatus}
        isLive={isLive}
        language={language}
        shareOpen={shareOpen}
        onToggleShare={onToggleShare}
      />

      {shareOpen && (
        <ShareControlsBoundary onError={onShareLoadError}>
          <Suspense fallback={null}>
            <ShareControls
              activeFile={activeFile}
              room={room}
              files={files}
              activeText={activeText}
              language={language}
              currentUserName={currentUserName}
              canStartSession={canStartSession}
              connectionStatus={connectionStatus}
              isLive={isLive}
              isLiveConnected={isLiveConnected}
              shareOpen={shareOpen}
              copied={copied}
              jsonShare={jsonShare}
              startSessionUnavailableReason={startSessionUnavailableReason}
              onCloseShare={onCloseShare}
              onStartSession={onStartSession}
              onRetrySession={onRetrySession}
              onCopyShareUrl={onCopyShareUrl}
              onDownloadProjectArchive={onDownloadProjectArchive}
              onChangeUserName={onChangeUserName}
              onCommitUserName={onCommitUserName}
              onStopSession={onStopSession}
            />
          </Suspense>
        </ShareControlsBoundary>
      )}
    </>
  ) : null;

  return (
    <TopChrome
      workspaceMenuOpen={workspaceMenuOpen}
      rightPanelOpen={rightPanelOpen}
      isLiveConnected={isLiveConnected}
      language={language}
      identity={displayedIdentity}
      collaborators={displayedCollaborators}
      followState={followState}
      activeDocumentId={activeFile?.id}
      activeText={activeText}
      fileTabs={fileTabs}
      shareControls={shareControls}
      onToggleWorkspaceMenu={onToggleWorkspaceMenu}
      onToggleRightPanel={onToggleRightPanel}
      onToggleFollowing={onToggleFollowing}
    />
  );
}
