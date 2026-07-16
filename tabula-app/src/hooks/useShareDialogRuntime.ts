import { useEffect, useMemo, useState } from "react";
import type { JsonShareController } from "./useJsonShareController";
import type { WorkspaceLanguage } from "./useWorkspacePreferences";
import { buildLocalAgentPrompt } from "../shareAgentHandoff";
import { buildShareViewModel } from "../share";
import {
  getWorkspaceChromeCopy,
  getWorkspaceMenuCopy,
} from "../workspaceLocale";
import type { LocationRoom, WorkspaceFile } from "../workspaceStorage";

type UseShareDialogRuntimeOptions = {
  activeFile?: WorkspaceFile;
  room?: LocationRoom | null;
  activeText: string;
  canStartSession: boolean;
  files: WorkspaceFile[];
  isLive: boolean;
  isLiveConnected: boolean;
  jsonShare: JsonShareController;
  language: WorkspaceLanguage;
  shareOpen: boolean;
  startSessionUnavailableReason: string;
  onCloseShare: () => void;
  onStopSession: () => void;
};

export function useShareDialogRuntime({
  activeFile,
  room,
  activeText,
  canStartSession,
  files,
  isLive,
  isLiveConnected,
  jsonShare,
  language,
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
  const roomPromptFiles = promptFiles;
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
    roomId: room?.roomId,
    shareUrl: room?.shareUrl,
    startSessionUnavailableReason,
  });

  useEffect(() => {
    if (!shareOpen) {
      setAgentPromptCopied(false);
      setExportLinkCopied(false);
      jsonShare.reset();
    }
  }, [jsonShare, shareOpen]);

  const stopSession = () => onStopSession();

  const exportToJsonLink = () => {
    void jsonShare
      .exportLink()
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
    const promptActiveFile = activeFile
      ? { ...activeFile, text: activeText }
      : roomPromptFiles[0];
    const prompt = buildLocalAgentPrompt({
      activeFile: promptActiveFile,
      files: roomPromptFiles,
      instruction: "",
      liveRoomUrl: isLiveConnected ? room?.shareUrl : undefined,
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
    exportLinkCopied,
    exportToJsonLink,
    shareModalTitle,
    shareView,
    stopSession,
  };
}
