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
import { OpenTabsMenu } from "./OpenTabsMenu";
import {
  getWorkspaceName,
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
  lastClosedFile?: WorkspaceFile;
  openFiles: WorkspaceFile[];
  hasDocuments: boolean;
  room?: LocationRoom | null;
  leftPanelOpen: boolean;
  workspaceSearchOpen: boolean;
  workspaceMenuOpen: boolean;
  rightPanelOpen: boolean;
  shareOpen: boolean;
  onAddFile: FileTabsProps["onAddFile"];
  onChangeUserName: (nextName: string) => void;
  onChromeInteraction: NonNullable<FileTabsProps["onChromeInteraction"]>;
  onCloseAllFiles: () => void;
  onCloseOtherFiles: () => void;
  onCloseFile: FileTabsProps["onCloseFile"];
  onCloseShare: () => void;
  onShareLoadError: () => void;
  onShareCopyFailed: () => void;
  onCommitUserName: () => void;
  onCopyShareUrl: () => void;
  onReorderFiles: FileTabsProps["onReorderFiles"];
  onRenameFile: FileTabsProps["onRenameFile"];
  onReopenLastClosedFile: () => void;
  onSelectFile: FileTabsProps["onSelectFile"];
  onStartSession: () => void;
  onStopSession: () => void;
  onRetrySession: () => void;
  onToggleLeftPanel: () => void;
  onToggleWorkspaceMenu: () => void;
  onToggleWorkspaceSearch: () => void;
  onToggleRightPanel: () => void;
  onToggleFollowing: (actorId: string) => void;
  onToggleShare: () => void;
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
  lastClosedFile,
  openFiles,
  hasDocuments,
  room,
  leftPanelOpen,
  workspaceSearchOpen,
  workspaceMenuOpen,
  rightPanelOpen,
  shareOpen,
  onAddFile,
  onChangeUserName,
  onChromeInteraction,
  onCloseAllFiles,
  onCloseOtherFiles,
  onCloseFile,
  onCloseShare,
  onShareLoadError,
  onShareCopyFailed,
  onCommitUserName,
  onCopyShareUrl,
  onReorderFiles,
  onRenameFile,
  onReopenLastClosedFile,
  onSelectFile,
  onStartSession,
  onStopSession,
  onRetrySession,
  onToggleLeftPanel,
  onToggleWorkspaceMenu,
  onToggleWorkspaceSearch,
  onToggleRightPanel,
  onToggleFollowing,
  onToggleShare,
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
      leadingControl={(openFiles.length > 0 || lastClosedFile) ? (
        <OpenTabsMenu
          activeFile={activeFile}
          folders={folders}
          language={language}
          lastClosedFile={lastClosedFile}
          openFiles={openFiles}
          onCloseAllFiles={onCloseAllFiles}
          onCloseOtherFiles={onCloseOtherFiles}
          onOpen={onChromeInteraction}
          onReopenLastClosedFile={onReopenLastClosedFile}
          onSelectFile={onSelectFile}
        />
      ) : undefined}
      onAddFile={onAddFile}
      onSelectFile={onSelectFile}
      onRenameFile={onRenameFile}
      onCloseFile={onCloseFile}
      onReorderFiles={onReorderFiles}
      onChromeInteraction={onChromeInteraction}
    />
  );

  const shareControls = hasDocuments ? (
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
  ) : null;
  return (
    <TopChrome
      workspaceSearchOpen={workspaceSearchOpen}
      workspaceMenuOpen={workspaceMenuOpen}
      workspaceName={getWorkspaceName(folders)}
      leftPanelOpen={leftPanelOpen}
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
      onToggleLeftPanel={onToggleLeftPanel}
      onToggleWorkspaceMenu={onToggleWorkspaceMenu}
      onToggleWorkspaceSearch={onToggleWorkspaceSearch}
      onToggleRightPanel={onToggleRightPanel}
      onToggleFollowing={onToggleFollowing}
    />
  );
}
