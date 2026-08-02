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
import type { LocationRoom, WorkspaceFile, WorkspaceFolder } from "./workspaceStorage";
import type { FollowState } from "../collaboration/followModel";

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
  leftPanelOpen: boolean;
  workspaceSearchOpen: boolean;
  workspaceMenuOpen: boolean;
  rightPanelOpen: boolean;
  topPopover: TopPopover;
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
  onStopSession: () => void;
  onRetrySession: () => void;
  onToggleLeftPanel: () => void;
  onToggleWorkspaceMenu: () => void;
  onToggleWorkspaceSearch: () => void;
  onToggleRightPanel: () => void;
  onToggleFollowing: (actorId: string) => void;
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
  leftPanelOpen,
  workspaceSearchOpen,
  workspaceMenuOpen,
  rightPanelOpen,
  topPopover,
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
  onToggleWorkspaceMenu,
  onToggleWorkspaceSearch,
  onToggleRightPanel,
  onToggleFollowing,
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
    hasDocuments: files.length > 0,
    room,
    leftPanelOpen,
    workspaceSearchOpen,
    workspaceMenuOpen,
    rightPanelOpen,
    shareOpen,
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
    onToggleWorkspaceMenu,
    onToggleWorkspaceSearch,
    onToggleRightPanel,
    onToggleFollowing,
    onToggleShare: toggleShare,
  };

  return {
    shareOpen,
    topChromeProps,
  };
}
