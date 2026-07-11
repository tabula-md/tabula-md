import { useEffect, useMemo, useState } from "react";
import type { JsonShareController } from "./useJsonShareController";
import type { WorkspaceLanguage } from "./useWorkspacePreferences";
import { buildLocalAgentPrompt } from "../shareAgentHandoff";
import { buildShareViewModel } from "../share";
import {
  getWorkspaceChromeCopy,
  getWorkspaceMenuCopy,
} from "../workspaceLocale";
import type { WorkspaceFile } from "../workspaceStorage";

type UseShareDialogRuntimeOptions = {
  activeFile?: WorkspaceFile;
  roomFile?: WorkspaceFile;
  activeText: string;
  canStartSession: boolean;
  files: WorkspaceFile[];
  isLive: boolean;
  isLiveConnected: boolean;
  jsonShare: JsonShareController;
  language: WorkspaceLanguage;
  shareExcludedFileIds: readonly string[];
  shareOpen: boolean;
  startSessionUnavailableReason: string;
  onCloseShare: () => void;
  onStopSession: () => void;
};

export function useShareDialogRuntime({
  activeFile,
  roomFile,
  activeText,
  canStartSession,
  files,
  isLive,
  isLiveConnected,
  jsonShare,
  language,
  shareExcludedFileIds,
  shareOpen,
  startSessionUnavailableReason,
  onCloseShare,
  onStopSession,
}: UseShareDialogRuntimeOptions) {
  const [agentPromptCopied, setAgentPromptCopied] = useState(false);
  const [exportLinkCopied, setExportLinkCopied] = useState(false);
  const copy = getWorkspaceMenuCopy(language).share;
  const chromeCopy = getWorkspaceChromeCopy(language);
  const shareModalTitle = copy.modalTitle;
  const promptFiles = useMemo(
    () =>
      activeFile
        ? files.map((file) =>
            file.id === activeFile.id
              ? { ...file, text: activeText }
              : file,
          )
        : files,
    [activeFile, activeText, files],
  );
  const excludedFileIds = useMemo(
    () => new Set(shareExcludedFileIds),
    [shareExcludedFileIds],
  );
  const includedFileIds = useMemo(
    () =>
      files
        .filter((file) => !excludedFileIds.has(file.id))
        .map((file) => file.id),
    [excludedFileIds, files],
  );
  const roomPromptFiles = useMemo(() => {
    if (roomFile?.roomId) {
      return promptFiles.filter((file) => file.roomId === roomFile.roomId);
    }
    const includedIds = new Set(includedFileIds);
    return promptFiles.filter((file) => includedIds.has(file.id));
  }, [includedFileIds, promptFiles, roomFile?.roomId]);
  const includedFileCount = useMemo(
    () => includedFileIds.length,
    [includedFileIds],
  );
  const shareView = buildShareViewModel({
    canStartSession,
    isLive,
    labels: {
      exportToLink: copy.shareable.exportToLink,
      exporting: copy.shareable.exporting,
    },
    jsonShareCanExport: jsonShare.canExport,
    jsonShareDisabledReason: jsonShare.disabledReason,
    jsonShareExporting: jsonShare.exporting,
    jsonShareUrl: jsonShare.url,
    roomId: roomFile?.roomId ?? activeFile?.roomId,
    shareUrl: roomFile?.shareUrl ?? activeFile?.shareUrl,
    startSessionUnavailableReason,
  });

  useEffect(() => {
    if (!shareOpen) {
      setAgentPromptCopied(false);
      setExportLinkCopied(false);
    }
  }, [shareOpen]);

  useEffect(() => {
    if (!shareOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseShare();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onCloseShare, shareOpen]);

  const stopSession = () => onStopSession();

  const exportToJsonLink = () => {
    void jsonShare
      .exportLink(includedFileIds)
      .then((exported) => {
        if (!exported) {
          onCloseShare();
        }
      })
      .finally(() => setExportLinkCopied(false));
  };

  const copyShareableLink = async () => {
    await jsonShare.copyLink();
    setExportLinkCopied(true);
    window.setTimeout(() => setExportLinkCopied(false), 1200);
  };

  const copyLocalAgentPrompt = async () => {
    const promptActiveFile = activeFile && roomFile?.roomId && activeFile.roomId === roomFile.roomId
      ? { ...activeFile, text: activeText }
      : roomPromptFiles[0];
    const prompt = buildLocalAgentPrompt({
      activeFile: promptActiveFile,
      files: roomPromptFiles,
      instruction: "",
      liveRoomUrl: isLiveConnected ? (roomFile?.shareUrl ?? activeFile?.shareUrl) : undefined,
      scope: "project",
    });

    await navigator.clipboard.writeText(prompt);
    setAgentPromptCopied(true);
    window.setTimeout(() => setAgentPromptCopied(false), 1200);
  };

  return {
    agentPromptCopied,
    chromeCopy,
    copy,
    copyLocalAgentPrompt,
    copyShareableLink,
    excludedFileIds,
    exportLinkCopied,
    exportToJsonLink,
    includedFileCount,
    includedFileIds,
    shareModalTitle,
    shareView,
    stopSession,
  };
}
