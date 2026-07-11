import { useCallback } from "react";
import type { Collaborator } from "../collaboration";
import type { ConnectionStatus } from "../collaboration";
import type { WorkspaceTopChromeProps } from "../components/WorkspaceTopChrome";
import type { JsonShareController } from "./useJsonShareController";
import type { RenameFileResult } from "./useWorkspaceFiles";
import type { WorkspaceLanguage } from "./useWorkspacePreferences";
import type { TopPopover } from "../uiTypes";
import type { WorkspaceFile } from "../workspaceStorage";

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
  identity: Collaborator;
  isLive: boolean;
  isLiveConnected: boolean;
  jsonShare: JsonShareController;
  language: WorkspaceLanguage;
  openFiles: WorkspaceFile[];
  roomFile?: WorkspaceFile;
  rightPanelOpen: boolean;
  shareExcludedFileIds: readonly string[];
  startSessionUnavailableReason: string;
  topPopover: TopPopover;
  workspaceMenuOpen: boolean;
  onAddFile: () => void;
  onAddPrivateFile: () => void;
  onChangeUserName: (nextName: string) => void;
  onCloseFile: (fileId: string) => void;
  onCommitUserName: () => void;
  onCopyShareUrl: () => void;
  onDownloadProjectArchive: (fileIds?: readonly string[]) => void;
  onReorderFiles: (sourceFileId: string, targetFileId: string) => void;
  onRenameFile: (fileId: string, nextTitle: string) => RenameFileResult;
  onSelectFile: (fileId: string) => void;
  onStartSession: () => void;
  onStopSession: () => void;
  onRetrySession: () => void;
  onToggleRightPanel: () => void;
  onToggleShareFileExcluded: (fileId: string) => void;
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
  identity,
  isLive,
  isLiveConnected,
  jsonShare,
  language,
  openFiles,
  roomFile,
  rightPanelOpen,
  shareExcludedFileIds,
  startSessionUnavailableReason,
  topPopover,
  workspaceMenuOpen,
  onAddFile,
  onAddPrivateFile,
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
  onToggleShareFileExcluded,
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
    identity,
    isLive,
    isLiveConnected,
    jsonShare,
    language,
    openFiles,
    roomFile,
    rightPanelOpen,
    shareExcludedFileIds,
    shareOpen,
    startSessionUnavailableReason,
    workspaceMenuOpen,
    onAddFile,
    onAddPrivateFile,
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
    onToggleShareFileExcluded,
    onToggleShare: toggleShare,
    onToggleWorkspaceMenu,
  };

  return {
    shareOpen,
    topChromeProps,
  };
}
