import { lazy, Suspense, useMemo, type ComponentProps } from "react";
import { FileTabs } from "./FileTabs";
import { ShareTrigger } from "./ShareTrigger";
import { TopChrome } from "./TopChrome";
import type { Collaborator } from "../collaboration";
import type { JsonShareController } from "../hooks/useJsonShareController";
import { getLiveWorkspaceFileIds } from "../liveWorkspaceScope";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import type { WorkspaceFile } from "../workspaceStorage";

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
  copied: boolean;
  currentUserName: string;
  files: WorkspaceFile[];
  getFileStatus: FileTabsProps["getFileStatus"];
  identity: Collaborator;
  isLive: boolean;
  isLiveConnected: boolean;
  jsonShare: JsonShareController;
  language: WorkspaceLanguage;
  openFiles: WorkspaceFile[];
  rightPanelOpen: boolean;
  shareExcludedFileIds: readonly string[];
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
  onDownloadProjectArchive: (fileIds?: readonly string[]) => void;
  onReorderFiles: FileTabsProps["onReorderFiles"];
  onRenameFile: FileTabsProps["onRenameFile"];
  onSelectFile: FileTabsProps["onSelectFile"];
  onStartSession: () => void;
  onStopSession: () => void;
  onRetrySession: () => void;
  onToggleRightPanel: () => void;
  onToggleShareFileExcluded: (fileId: string) => void;
  onToggleShare: () => void;
  onToggleWorkspaceMenu: () => void;
};

export function WorkspaceTopChrome({
  activeFile,
  activeText,
  canStartSession,
  collaborators,
  copied,
  currentUserName,
  files,
  getFileStatus,
  identity,
  isLive,
  isLiveConnected,
  jsonShare,
  language,
  openFiles,
  rightPanelOpen,
  shareExcludedFileIds,
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
  onToggleShareFileExcluded,
  onToggleShare,
  onToggleWorkspaceMenu,
}: WorkspaceTopChromeProps) {
  const liveFileIds = useMemo(
    () =>
      getLiveWorkspaceFileIds({
        activeFile,
        excludedFileIds: shareExcludedFileIds,
        files,
        isLive: isLiveConnected,
      }),
    [activeFile, files, isLiveConnected, shareExcludedFileIds],
  );

  const fileTabs = (
    <FileTabs
      files={openFiles}
      activeFile={activeFile}
      activeCollaboratorCount={collaborators.length}
      getFileStatus={getFileStatus}
      liveFileIds={liveFileIds}
      onAddFile={onAddFile}
      onSelectFile={onSelectFile}
      onRenameFile={onRenameFile}
      onCloseFile={onCloseFile}
      onReorderFiles={onReorderFiles}
      onChromeInteraction={onChromeInteraction}
    />
  );

  const shareControls = activeFile ? (
    <>
      <ShareTrigger
        isLive={isLiveConnected}
        language={language}
        shareOpen={shareOpen}
        onToggleShare={onToggleShare}
      />

      {shareOpen && (
        <Suspense fallback={null}>
          <ShareControls
            activeFile={activeFile}
            files={files}
            activeText={activeText}
            language={language}
            currentUserName={currentUserName}
            canStartSession={canStartSession}
            connectionStatus={getFileStatus(activeFile)}
            isLive={isLive}
            isLiveConnected={isLiveConnected}
            shareExcludedFileIds={shareExcludedFileIds}
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
            onToggleShareFileExcluded={onToggleShareFileExcluded}
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
      identity={identity}
      collaborators={collaborators}
      activeText={activeText}
      fileTabs={fileTabs}
      shareControls={shareControls}
      onToggleWorkspaceMenu={onToggleWorkspaceMenu}
      onToggleRightPanel={onToggleRightPanel}
    />
  );
}
