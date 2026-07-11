import { lazy, Suspense, useMemo, type ComponentProps } from "react";
import { FileTabs } from "./FileTabs";
import { ShareTrigger } from "./ShareTrigger";
import { TopChrome } from "./TopChrome";
import type { Collaborator, ConnectionStatus } from "../collaboration";
import type { JsonShareController } from "../hooks/useJsonShareController";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import { getCollaboratorDisplayList } from "../collaboration/collabCollaborators";
import {
  isEmptyGeneratedLivePlaceholder,
  type WorkspaceFile,
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
  connectionStatus: ConnectionStatus;
  copied: boolean;
  currentUserName: string;
  files: WorkspaceFile[];
  identity: Collaborator;
  isLive: boolean;
  isLiveConnected: boolean;
  jsonShare: JsonShareController;
  language: WorkspaceLanguage;
  openFiles: WorkspaceFile[];
  roomFile?: WorkspaceFile;
  rightPanelOpen: boolean;
  shareOpen: boolean;
  startSessionUnavailableReason: string;
  workspaceMenuOpen: boolean;
  onAddFile: FileTabsProps["onAddFile"];
  onChangeUserName: (nextName: string) => void;
  onChromeInteraction: NonNullable<FileTabsProps["onChromeInteraction"]>;
  onCloseFile: FileTabsProps["onCloseFile"];
  onCloseShare: () => void;
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
  onToggleShare: () => void;
  onToggleWorkspaceMenu: () => void;
};

export function WorkspaceTopChrome({
  activeFile,
  activeText,
  canStartSession,
  collaborators,
  connectionStatus,
  copied,
  currentUserName,
  files,
  identity,
  isLive,
  isLiveConnected,
  jsonShare,
  language,
  openFiles,
  roomFile,
  rightPanelOpen,
  shareOpen,
  startSessionUnavailableReason,
  workspaceMenuOpen,
  onAddFile,
  onChangeUserName,
  onChromeInteraction,
  onCloseFile,
  onCloseShare,
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
  onToggleShare,
  onToggleWorkspaceMenu,
}: WorkspaceTopChromeProps) {
  const visibleFiles = useMemo(
    () => files.filter((file) => !isEmptyGeneratedLivePlaceholder(file)),
    [files],
  );
  const visibleOpenFiles = useMemo(
    () => openFiles.filter((file) => !isEmptyGeneratedLivePlaceholder(file)),
    [openFiles],
  );
  const visibleActiveFile =
    activeFile && !isEmptyGeneratedLivePlaceholder(activeFile) ? activeFile : undefined;
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
      files={visibleOpenFiles}
      activeFile={visibleActiveFile}
      collaborators={displayedCollaborators}
      onAddFile={onAddFile}
      onSelectFile={onSelectFile}
      onRenameFile={onRenameFile}
      onCloseFile={onCloseFile}
      onReorderFiles={onReorderFiles}
      onChromeInteraction={onChromeInteraction}
    />
  );

  const shareSubjectFile = activeFile ?? roomFile;
  const shareControls = shareSubjectFile ? (
    <>
      <ShareTrigger
        connectionStatus={connectionStatus}
        isLive={isLive}
        language={language}
        shareOpen={shareOpen}
        onToggleShare={onToggleShare}
      />

      {shareOpen && (
        <Suspense fallback={null}>
          <ShareControls
            activeFile={shareSubjectFile}
            roomFile={roomFile}
            files={visibleFiles}
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
      activeText={activeText}
      fileTabs={fileTabs}
      shareControls={shareControls}
      onToggleWorkspaceMenu={onToggleWorkspaceMenu}
      onToggleRightPanel={onToggleRightPanel}
    />
  );
}
