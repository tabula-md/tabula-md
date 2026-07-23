import { useMemo, type ComponentProps } from "react";
import { FileTabs } from "./FileTabs";
import { ShareControlsBoundary } from "../../share/ShareControlsBoundary";
import { ShareTrigger } from "../../share/ShareTrigger";
import { ShareControls } from "../../share/ShareControls";
import { TopChrome } from "./TopChrome";
import type {
  Collaborator,
  ConnectionStatus,
} from "../../collaboration/liveCollaboration";
import type { FollowState } from "../../collaboration/followModel";
import type { JsonShareController } from "../../share/useJsonShareController";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getCollaboratorDisplayList } from "../../collaboration/collabCollaborators";
import {
  type LocationRoom,
  type WorkspaceFile,
  type WorkspaceFolder,
} from "../workspaceStorage";

type FileTabsProps = ComponentProps<typeof FileTabs>;

export type WorkspaceTopChromeProps = {
  activeFile?: WorkspaceFile;
  activeText: string;
  collaborators: Collaborator[];
  followState: FollowState;
  connectionStatus: ConnectionStatus;
  copied: boolean;
  currentUserName: string;
  folders: WorkspaceFolder[];
  identity: Collaborator;
  isStartingLive: boolean;
  isLive: boolean;
  isLiveConnected: boolean;
  jsonShare: JsonShareController;
  language: WorkspaceLanguage;
  openFiles: WorkspaceFile[];
  room?: LocationRoom | null;
  rightPanelOpen: boolean;
  shareOpen: boolean;
  workspaceMenuOpen: boolean;
  onAddFile: FileTabsProps["onAddFile"];
  onChangeUserName: (nextName: string) => void;
  onChromeInteraction: NonNullable<FileTabsProps["onChromeInteraction"]>;
  onCloseFile: FileTabsProps["onCloseFile"];
  onCloseShare: () => void;
  onShareLoadError: () => void;
  onShareCopyFailed: () => void;
  onCommitUserName: () => void;
  onCopyShareUrl: () => void;
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
  collaborators,
  followState,
  connectionStatus,
  copied,
  currentUserName,
  folders,
  identity,
  isStartingLive,
  isLive,
  isLiveConnected,
  jsonShare,
  language,
  openFiles,
  room,
  rightPanelOpen,
  shareOpen,
  workspaceMenuOpen,
  onAddFile,
  onChangeUserName,
  onChromeInteraction,
  onCloseFile,
  onCloseShare,
  onShareLoadError,
  onShareCopyFailed,
  onCommitUserName,
  onCopyShareUrl,
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

  const shareControls = (
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
          <ShareControls
            room={room}
            language={language}
            currentUserName={currentUserName}
            connectionStatus={connectionStatus}
            isStartingLive={isStartingLive}
            isLive={isLive}
            shareOpen={shareOpen}
            copied={copied}
            jsonShare={jsonShare}
            onCloseShare={onCloseShare}
            onCopyFailed={onShareCopyFailed}
            onStartSession={onStartSession}
            onRetrySession={onRetrySession}
            onCopyShareUrl={onCopyShareUrl}
            onChangeUserName={onChangeUserName}
            onCommitUserName={onCommitUserName}
            onStopSession={onStopSession}
          />
        </ShareControlsBoundary>
      )}
    </>
  );

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
