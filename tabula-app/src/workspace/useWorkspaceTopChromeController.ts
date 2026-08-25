import { useCallback } from "react";
import type {
  Collaborator,
  ConnectionStatus,
} from "../collaboration/liveCollaboration";
import type { WorkspaceTopChromeProps } from "./components/WorkspaceTopChrome";
import type { JsonShareController } from "../share/useJsonShareController";
import type { RenameFileResult } from "./state/useWorkspaceFiles";
import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";
import type { TopPopover } from "../ui/uiTypes";
import type { LeftPanelView } from "../ui/uiTypes";
import type { LocationRoom, WorkspaceFile, WorkspaceFolder } from "./workspaceStorage";
import type { FollowState } from "../collaboration/followModel";
import type { RoomExitLocalWorkspaceStrategy } from "./workspaceSessionTransition";
import type { WorkspaceContextSummaryViewModel } from "./workspaceContextSummary";

type SetTopPopover = (popover: TopPopover) => void;
type SetCenterPopover = (popover: null) => void;
type SetWorkspaceMenuOpen = (isOpen: boolean) => void;
type SetPreferencesOpen = (isOpen: boolean) => void;

type UseWorkspaceTopChromeControllerOptions = {
  activeFile?: WorkspaceFile;
  activeText: string;
  collaborators: Collaborator[];
  followState: FollowState;
  connectionStatus: ConnectionStatus;
  copiedFileId: string | null;
  canChooseRoomExitStrategy: boolean;
  currentUserName: string;
  files: WorkspaceFile[];
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
  topPopover: TopPopover;
  workspaceMenuOpen: boolean;
  workspaceName: string;
  workspaceContextSummary: WorkspaceContextSummaryViewModel;
  onAddFile: () => void;
  onChangeUserName: (nextName: string) => void;
  onCloseAllFiles: () => void;
  onCloseOtherFiles: () => void;
  onCloseFile: (fileId: string) => void;
  onShareLoadError: () => void;
  onShareCopyFailed: () => void;
  onCommitUserName: () => void;
  onCopyShareUrl: () => void;
  onEmptyShare: () => void;
  onReorderFiles: (sourceFileId: string, targetFileId: string) => void;
  onRenameFile: (fileId: string, nextTitle: string) => Promise<RenameFileResult>;
  onReopenLastClosedFile: () => void;
  onSelectFile: (fileId: string) => void;
  onShareOpened: () => void;
  onStartSession: () => void;
  onStopSession: (strategy: RoomExitLocalWorkspaceStrategy) => void;
  onRetrySession: () => void;
  onToggleLeftPanel: (view: LeftPanelView) => void;
  onOpenWorkspaceLauncher: () => void;
  onToggleRightPanel: () => void;
  onToggleFollowing: (actorId: string) => void;
  onToggleWorkspaceMenu: () => void;
  setCenterPopover: SetCenterPopover;
  setPreferencesOpen: SetPreferencesOpen;
  setTopPopover: SetTopPopover;
  setWorkspaceMenuOpen: SetWorkspaceMenuOpen;
};

export function useWorkspaceTopChromeController({
  activeFile,
  activeText,
  collaborators,
  followState,
  connectionStatus,
  copiedFileId,
  canChooseRoomExitStrategy,
  currentUserName,
  files,
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
  topPopover,
  workspaceMenuOpen,
  workspaceName,
  workspaceContextSummary,
  onAddFile,
  onChangeUserName,
  onCloseAllFiles,
  onCloseOtherFiles,
  onCloseFile,
  onShareLoadError,
  onShareCopyFailed,
  onCommitUserName,
  onCopyShareUrl,
  onEmptyShare,
  onReorderFiles,
  onRenameFile,
  onReopenLastClosedFile,
  onSelectFile,
  onShareOpened,
  onStartSession,
  onStopSession,
  onRetrySession,
  onToggleLeftPanel,
  onOpenWorkspaceLauncher,
  onToggleRightPanel,
  onToggleFollowing,
  onToggleWorkspaceMenu,
  setCenterPopover,
  setPreferencesOpen,
  setTopPopover,
  setWorkspaceMenuOpen,
}: UseWorkspaceTopChromeControllerOptions) {
  const shareOpen = topPopover === "share";
  const copied = copiedFileId === (activeFile?.id ?? room?.roomId);

  const closeDocumentChrome = useCallback(() => {
    setTopPopover(null);
    setCenterPopover(null);
  }, [setCenterPopover, setTopPopover]);

  const closeShare = useCallback(() => {
    setTopPopover(null);
  }, [setTopPopover]);

  const toggleShare = useCallback(() => {
    if (!shareOpen) {
      onShareOpened();
      if (!isLive && files.length === 0) {
        onEmptyShare();
        setTopPopover(null);
        setCenterPopover(null);
        setWorkspaceMenuOpen(false);
        setPreferencesOpen(false);
        return;
      }
    }
    setTopPopover(shareOpen ? null : "share");
    setCenterPopover(null);
    setWorkspaceMenuOpen(false);
    setPreferencesOpen(false);
  }, [
    setCenterPopover,
    setPreferencesOpen,
    setTopPopover,
    setWorkspaceMenuOpen,
    files.length,
    isLive,
    onEmptyShare,
    onShareOpened,
    shareOpen,
  ]);

  const topChromeProps: WorkspaceTopChromeProps = {
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
    workspaceName,
    workspaceContextSummary,
    onAddFile,
    onChangeUserName,
    onChromeInteraction: closeDocumentChrome,
    onCloseAllFiles,
    onCloseOtherFiles,
    onCloseFile,
    onCloseShare: closeShare,
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
    onToggleShare: toggleShare,
    onToggleWorkspaceMenu,
  };

  return {
    shareOpen,
    topChromeProps,
  };
}
