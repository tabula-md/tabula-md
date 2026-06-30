import { useCallback } from "react";
import type { Collaborator } from "../collaboration";
import type { WorkspaceTopChromeProps } from "../components/WorkspaceTopChrome";
import type { JsonShareController } from "./useJsonShareController";
import type { RenameFileResult } from "./useWorkspaceFiles";
import type { WorkspaceLanguage } from "./useWorkspacePreferences";
import type { SharePanel, TopPopover } from "../uiTypes";
import type { WorkspaceFile } from "../workspaceStorage";

type SetTopPopover = (popover: TopPopover) => void;
type SetCenterPopover = (popover: null) => void;
type SetWorkspaceMenuOpen = (isOpen: boolean) => void;
type SetPreferencesOpen = (isOpen: boolean) => void;
type SetSharePanelTarget = (target: SharePanel | undefined) => void;

type UseWorkspaceTopChromeRuntimeOptions = {
  activeFile?: WorkspaceFile;
  activeFileTitle: string;
  activeText: string;
  canStartSession: boolean;
  collaborators: Collaborator[];
  copiedFileId: string | null;
  currentUserName: string;
  files: WorkspaceFile[];
  getFileStatus: WorkspaceTopChromeProps["getFileStatus"];
  identity: Collaborator;
  isLive: boolean;
  jsonShare: JsonShareController;
  language: WorkspaceLanguage;
  openFiles: WorkspaceFile[];
  rightPanelOpen: boolean;
  sharePanelTarget?: SharePanel;
  startSessionUnavailableReason: string;
  topPopover: TopPopover;
  workspaceMenuOpen: boolean;
  onAddFile: () => void;
  onChangeUserName: (nextName: string) => void;
  onCloseFile: (fileId: string) => void;
  onCommitUserName: () => void;
  onCopyFile: () => void;
  onCopyShareUrl: () => void;
  onDownloadFile: () => void;
  onDownloadProjectArchive: () => void;
  onReorderFiles: (sourceFileId: string, targetFileId: string) => void;
  onRenameFile: (fileId: string, nextTitle: string) => RenameFileResult;
  onSelectFile: (fileId: string) => void;
  onStartSession: () => void;
  onStopSession: () => void;
  onToggleRightPanel: () => void;
  onToggleWorkspaceMenu: () => void;
  setCenterPopover: SetCenterPopover;
  setPreferencesOpen: SetPreferencesOpen;
  setSharePanelTarget: SetSharePanelTarget;
  setTopPopover: SetTopPopover;
  setWorkspaceMenuOpen: SetWorkspaceMenuOpen;
};

export function useWorkspaceTopChromeRuntime({
  activeFile,
  activeFileTitle,
  activeText,
  canStartSession,
  collaborators,
  copiedFileId,
  currentUserName,
  files,
  getFileStatus,
  identity,
  isLive,
  jsonShare,
  language,
  openFiles,
  rightPanelOpen,
  sharePanelTarget,
  startSessionUnavailableReason,
  topPopover,
  workspaceMenuOpen,
  onAddFile,
  onChangeUserName,
  onCloseFile,
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
  onToggleWorkspaceMenu,
  setCenterPopover,
  setPreferencesOpen,
  setSharePanelTarget,
  setTopPopover,
  setWorkspaceMenuOpen,
}: UseWorkspaceTopChromeRuntimeOptions) {
  const shareOpen = topPopover === "share";
  const copied = copiedFileId === activeFile?.id;

  const closeDocumentChrome = useCallback(() => {
    setTopPopover(null);
    setCenterPopover(null);
  }, [setCenterPopover, setTopPopover]);

  const closeShare = useCallback(() => {
    setTopPopover(null);
    setSharePanelTarget(undefined);
  }, [setSharePanelTarget, setTopPopover]);

  const toggleShare = useCallback(() => {
    setSharePanelTarget(undefined);
    setTopPopover(shareOpen ? null : "share");
    setCenterPopover(null);
    setWorkspaceMenuOpen(false);
    setPreferencesOpen(false);
  }, [
    setCenterPopover,
    setPreferencesOpen,
    setSharePanelTarget,
    setTopPopover,
    setWorkspaceMenuOpen,
    shareOpen,
  ]);

  const topChromeProps: WorkspaceTopChromeProps = {
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
    onChromeInteraction: closeDocumentChrome,
    onCloseFile,
    onCloseShare: closeShare,
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
    onToggleShare: toggleShare,
    onToggleWorkspaceMenu,
  };

  return {
    shareOpen,
    topChromeProps,
  };
}
