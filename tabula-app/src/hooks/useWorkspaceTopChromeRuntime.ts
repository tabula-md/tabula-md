import { useCallback } from "react";
import type { Collaborator } from "../collaboration";
import type { ConnectionStatus } from "../collaboration";
import type { WorkspaceTopChromeProps } from "../components/WorkspaceTopChrome";
import type { JsonShareController } from "./useJsonShareController";
import type { RenameFileResult } from "./useWorkspaceFiles";
import type { WorkspaceLanguage } from "./useWorkspacePreferences";
import type { TopPopover } from "../uiTypes";
import type { WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";

type SetTopPopover = (popover: TopPopover) => void;
type SetCenterPopover = (popover: null) => void;
type SetWorkspaceMenuOpen = (isOpen: boolean) => void;
type SetPreferencesOpen = (isOpen: boolean) => void;

type UseWorkspaceTopChromeRuntimeOptions = {
  activeFile?: WorkspaceFile;
  activeText: string;
  canStartSession: boolean;
  collaborators: Collaborator[];
  connectionStatus: ConnectionStatus;
  copiedFileId: string | null;
  currentUserName: string;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  identity: Collaborator;
  isLive: boolean;
  isLiveConnected: boolean;
  jsonShare: JsonShareController;
  language: WorkspaceLanguage;
  openFiles: WorkspaceFile[];
  roomFile?: WorkspaceFile;
  rightPanelOpen: boolean;
  startSessionUnavailableReason: string;
  topPopover: TopPopover;
  workspaceMenuOpen: boolean;
  onAddFile: () => void;
  onChangeUserName: (nextName: string) => void;
  onCloseFile: (fileId: string) => void;
  onCommitUserName: () => void;
  onCopyShareUrl: () => void;
  onDownloadProjectArchive: () => void;
  onReorderFiles: (sourceFileId: string, targetFileId: string) => void;
  onRenameFile: (fileId: string, nextTitle: string) => RenameFileResult;
  onSelectFile: (fileId: string) => void;
  onStartSession: () => void;
  onStopSession: () => void;
  onRetrySession: () => void;
  onToggleRightPanel: () => void;
  onToggleWorkspaceMenu: () => void;
  setCenterPopover: SetCenterPopover;
  setPreferencesOpen: SetPreferencesOpen;
  setTopPopover: SetTopPopover;
  setWorkspaceMenuOpen: SetWorkspaceMenuOpen;
};

export function useWorkspaceTopChromeRuntime({
  activeFile,
  activeText,
  canStartSession,
  collaborators,
  connectionStatus,
  copiedFileId,
  currentUserName,
  files,
  folders,
  identity,
  isLive,
  isLiveConnected,
  jsonShare,
  language,
  openFiles,
  roomFile,
  rightPanelOpen,
  startSessionUnavailableReason,
  topPopover,
  workspaceMenuOpen,
  onAddFile,
  onChangeUserName,
  onCloseFile,
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
  onToggleWorkspaceMenu,
  setCenterPopover,
  setPreferencesOpen,
  setTopPopover,
  setWorkspaceMenuOpen,
}: UseWorkspaceTopChromeRuntimeOptions) {
  const shareOpen = topPopover === "share";
  const copied = copiedFileId === (roomFile ?? activeFile)?.id;

  const closeDocumentChrome = useCallback(() => {
    setTopPopover(null);
    setCenterPopover(null);
  }, [setCenterPopover, setTopPopover]);

  const closeShare = useCallback(() => {
    setTopPopover(null);
  }, [setTopPopover]);

  const toggleShare = useCallback(() => {
    setTopPopover(shareOpen ? null : "share");
    setCenterPopover(null);
    setWorkspaceMenuOpen(false);
    setPreferencesOpen(false);
  }, [
    setCenterPopover,
    setPreferencesOpen,
    setTopPopover,
    setWorkspaceMenuOpen,
    shareOpen,
  ]);

  const topChromeProps: WorkspaceTopChromeProps = {
    activeFile,
    activeText,
    canStartSession,
    collaborators,
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
    roomFile,
    rightPanelOpen,
    shareOpen,
    startSessionUnavailableReason,
    workspaceMenuOpen,
    onAddFile,
    onChangeUserName,
    onChromeInteraction: closeDocumentChrome,
    onCloseFile,
    onCloseShare: closeShare,
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
    onToggleShare: toggleShare,
    onToggleWorkspaceMenu,
  };

  return {
    shareOpen,
    topChromeProps,
  };
}
