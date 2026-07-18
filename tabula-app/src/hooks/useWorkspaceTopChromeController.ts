import { useCallback } from "react";
import type {
  Collaborator,
  ConnectionStatus,
  RoomRecoveryMode,
} from "../collaboration/liveCollaboration";
import type { WorkspaceTopChromeProps } from "../components/WorkspaceTopChrome";
import type { JsonShareController } from "../share/useJsonShareController";
import type { RenameFileResult } from "./useWorkspaceFiles";
import type { WorkspaceLanguage } from "./useWorkspacePreferences";
import type { TopPopover } from "../uiTypes";
import type { LocationRoom, WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";
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
  isLive: boolean;
  isLiveConnected: boolean;
  recoveryMode: RoomRecoveryMode;
  jsonShare: JsonShareController;
  language: WorkspaceLanguage;
  openFiles: WorkspaceFile[];
  room?: LocationRoom | null;
  rightPanelOpen: boolean;
  topPopover: TopPopover;
  workspaceMenuOpen: boolean;
  onAddFile: () => void;
  onChangeUserName: (nextName: string) => void;
  onCloseFile: (fileId: string) => void;
  onShareLoadError: () => void;
  onCommitUserName: () => void;
  onCopyShareUrl: () => void;
  onReorderFiles: (sourceFileId: string, targetFileId: string) => void;
  onRenameFile: (fileId: string, nextTitle: string) => RenameFileResult;
  onSelectFile: (fileId: string) => void;
  onShareOpened: () => void;
  onStartSession: () => void;
  onStopSession: () => void;
  onRetrySession: () => void;
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
  currentUserName,
  files,
  folders,
  identity,
  isLive,
  isLiveConnected,
  recoveryMode,
  jsonShare,
  language,
  openFiles,
  room,
  rightPanelOpen,
  topPopover,
  workspaceMenuOpen,
  onAddFile,
  onChangeUserName,
  onCloseFile,
  onShareLoadError,
  onCommitUserName,
  onCopyShareUrl,
  onReorderFiles,
  onRenameFile,
  onSelectFile,
  onShareOpened,
  onStartSession,
  onStopSession,
  onRetrySession,
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
    if (!shareOpen) onShareOpened();
    setTopPopover(shareOpen ? null : "share");
    setCenterPopover(null);
    setWorkspaceMenuOpen(false);
    setPreferencesOpen(false);
  }, [
    setCenterPopover,
    setPreferencesOpen,
    setTopPopover,
    setWorkspaceMenuOpen,
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
    files,
    folders,
    identity,
    isLive,
    isLiveConnected,
    recoveryMode,
    jsonShare,
    language,
    openFiles,
    room,
    rightPanelOpen,
    shareOpen,
    workspaceMenuOpen,
    onAddFile,
    onChangeUserName,
    onChromeInteraction: closeDocumentChrome,
    onCloseFile,
    onCloseShare: closeShare,
    onShareLoadError,
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
    onToggleShare: toggleShare,
    onToggleWorkspaceMenu,
  };

  return {
    shareOpen,
    topChromeProps,
  };
}
