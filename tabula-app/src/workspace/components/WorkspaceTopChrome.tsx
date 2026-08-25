import { lazy, Suspense, useMemo, type ComponentProps } from "react";
import { FileTabs } from "./FileTabs";
import { ShareControlsBoundary } from "../../share/ShareControlsBoundary";
import { ShareTrigger } from "../../share/ShareTrigger";
import { TopChrome } from "./TopChrome";
import type {
  Collaborator,
  ConnectionStatus,
} from "../../collaboration/liveCollaboration";
import type { FollowState } from "../../collaboration/followModel";
import type { LeftPanelView } from "../../ui/uiTypes";
import type { JsonShareController } from "../../share/useJsonShareController";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import { getCollaboratorDisplayList } from "../../collaboration/collabCollaborators";
import { OpenTabsMenu } from "./OpenTabsMenu";
import {
  type LocationRoom,
  type WorkspaceFile,
  type WorkspaceFolder,
} from "../workspaceStorage";
import type { RoomExitLocalWorkspaceStrategy } from "../workspaceSessionTransition";

type FileTabsProps = ComponentProps<typeof FileTabs>;

const ShareControls = lazy(() =>
  import("../../share/ShareControls").then((module) => ({
    default: module.ShareControls,
  })),
);

export type WorkspaceTopChromeProps = {
  activeFile?: WorkspaceFile;
  activeText: string;
  collaborators: Collaborator[];
  followState: FollowState;
  connectionStatus: ConnectionStatus;
  copied: boolean;
  canChooseRoomExitStrategy: boolean;
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
  room?: LocationRoom | null;
  roomExitStrategy: RoomExitLocalWorkspaceStrategy;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  shareOpen: boolean;
  workspaceMenuOpen: boolean;
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
  onStopSession: (strategy: RoomExitLocalWorkspaceStrategy) => void;
  onRetrySession: () => void;
  onToggleLeftPanel: (view: LeftPanelView) => void;
  onOpenWorkspaceLauncher: () => void;
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
  canChooseRoomExitStrategy,
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
  room,
  roomExitStrategy,
  leftPanelOpen,
  rightPanelOpen,
  shareOpen,
  workspaceMenuOpen,
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
  onOpenWorkspaceLauncher,
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
      leadingControl={
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
      }
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
          <Suspense fallback={null}>
            <ShareControls
              room={room}
              language={language}
              currentUserName={currentUserName}
              connectionStatus={connectionStatus}
              isStartingLive={isStartingLive}
              isLive={isLive}
              shareOpen={shareOpen}
              copied={copied}
              canChooseRoomExitStrategy={canChooseRoomExitStrategy}
              jsonShare={jsonShare}
              roomExitStrategy={roomExitStrategy}
              onCloseShare={onCloseShare}
              onCopyFailed={onShareCopyFailed}
              onStartSession={onStartSession}
              onRetrySession={onRetrySession}
              onCopyShareUrl={onCopyShareUrl}
              onChangeUserName={onChangeUserName}
              onCommitUserName={onCommitUserName}
              onStopSession={onStopSession}
            />
          </Suspense>
        </ShareControlsBoundary>
      )}
    </>
  );

  return (
    <TopChrome
      workspaceMenuOpen={workspaceMenuOpen}
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
      onToggleWorkspaceMenu={onToggleWorkspaceMenu}
      onToggleLeftPanel={onToggleLeftPanel}
      onOpenWorkspaceLauncher={onOpenWorkspaceLauncher}
      onToggleRightPanel={onToggleRightPanel}
      onToggleFollowing={onToggleFollowing}
    />
  );
}
