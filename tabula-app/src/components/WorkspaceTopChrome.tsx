import { lazy, Suspense, type ComponentProps } from "react";
import { FileTabs } from "./FileTabs";
import { ShareTrigger } from "./ShareTrigger";
import { TopChrome } from "./TopChrome";
import type { Collaborator } from "../collaboration";
import type { JsonShareController } from "../hooks/useJsonShareController";
import type { WorkspaceLanguage } from "../hooks/useWorkspacePreferences";
import type { SharePanel } from "../uiTypes";
import type { WorkspaceFile } from "../workspaceStorage";

type FileTabsProps = ComponentProps<typeof FileTabs>;

const ShareControls = lazy(() =>
  import("./ShareControls").then(({ ShareControls }) => ({
    default: ShareControls,
  })),
);

export type WorkspaceTopChromeProps = {
  activeFile?: WorkspaceFile;
  activeFileTitle: string;
  activeText: string;
  canStartSession: boolean;
  collaborators: Collaborator[];
  copied: boolean;
  currentUserName: string;
  files: WorkspaceFile[];
  getFileStatus: FileTabsProps["getFileStatus"];
  identity: Collaborator;
  isLive: boolean;
  jsonShare: JsonShareController;
  language: WorkspaceLanguage;
  openFiles: WorkspaceFile[];
  rightPanelOpen: boolean;
  shareOpen: boolean;
  sharePanelTarget?: SharePanel;
  startSessionUnavailableReason: string;
  workspaceMenuOpen: boolean;
  onAddFile: FileTabsProps["onAddFile"];
  onChangeUserName: (nextName: string) => void;
  onChromeInteraction: NonNullable<FileTabsProps["onChromeInteraction"]>;
  onCloseFile: FileTabsProps["onCloseFile"];
  onCloseShare: () => void;
  onCommitUserName: () => void;
  onCopyFile: () => void;
  onCopyShareUrl: () => void;
  onDownloadFile: () => void;
  onDownloadProjectArchive: () => void;
  onReorderFiles: FileTabsProps["onReorderFiles"];
  onRenameFile: FileTabsProps["onRenameFile"];
  onSelectFile: FileTabsProps["onSelectFile"];
  onStartSession: () => void;
  onStopSession: () => void;
  onToggleRightPanel: () => void;
  onToggleShare: () => void;
  onToggleWorkspaceMenu: () => void;
};

export function WorkspaceTopChrome({
  activeFile,
  activeFileTitle,
  activeText,
  canStartSession,
  collaborators,
  copied,
  currentUserName,
  files,
  getFileStatus,
  identity,
  isLive,
  jsonShare,
  language,
  openFiles,
  rightPanelOpen,
  shareOpen,
  sharePanelTarget,
  startSessionUnavailableReason,
  workspaceMenuOpen,
  onAddFile,
  onChangeUserName,
  onChromeInteraction,
  onCloseFile,
  onCloseShare,
  onCommitUserName,
  onCopyFile,
  onCopyShareUrl,
  onDownloadFile,
  onDownloadProjectArchive,
  onReorderFiles,
  onRenameFile,
  onSelectFile,
  onStartSession,
  onStopSession,
  onToggleRightPanel,
  onToggleShare,
  onToggleWorkspaceMenu,
}: WorkspaceTopChromeProps) {
  const fileTabs = (
    <FileTabs
      files={openFiles}
      activeFile={activeFile}
      activeCollaboratorCount={collaborators.length}
      getFileStatus={getFileStatus}
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
        activeFileTitle={activeFileTitle}
        language={language}
        shareOpen={shareOpen}
        onToggleShare={onToggleShare}
      />

      {shareOpen && (
        <Suspense fallback={null}>
          <ShareControls
            activeFile={activeFile}
            files={files}
            activeFileTitle={activeFileTitle}
            language={language}
            currentUserName={currentUserName}
            canStartSession={canStartSession}
            isLive={isLive}
            shareOpen={shareOpen}
            sharePanelTarget={sharePanelTarget}
            copied={copied}
            jsonShare={jsonShare}
            startSessionUnavailableReason={startSessionUnavailableReason}
            onCloseShare={onCloseShare}
            onStartSession={onStartSession}
            onCopyShareUrl={onCopyShareUrl}
            onCopyFile={onCopyFile}
            onDownloadFile={onDownloadFile}
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
      isLive={isLive}
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
