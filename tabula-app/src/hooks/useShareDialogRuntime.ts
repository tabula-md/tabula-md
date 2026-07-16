import { useCallback, useMemo, useRef, useState } from "react";
import type { JsonShareController } from "./useJsonShareController";
import type { WorkspaceLanguage } from "./useWorkspacePreferences";
import { buildLocalAgentPrompt } from "../shareAgentHandoff";
import { buildShareViewModel } from "../share";
import {
  getWorkspaceChromeCopy,
  getWorkspaceMenuCopy,
} from "../workspaceLocale";
import type { LocationRoom, WorkspaceFile } from "../workspaceStorage";
import { productAnalytics } from "../observability/productAnalytics";

type UseShareDialogRuntimeOptions = {
  activeFile?: WorkspaceFile;
  room?: LocationRoom | null;
  activeText: string;
  files: WorkspaceFile[];
  isLive: boolean;
  isLiveConnected: boolean;
  jsonShare: JsonShareController;
  language: WorkspaceLanguage;
  onCloseShare: () => void;
  onStopSession: () => void;
};

export function useShareDialogRuntime({
  activeFile,
  room,
  activeText,
  files,
  isLive,
  isLiveConnected,
  jsonShare,
  language,
  onCloseShare,
  onStopSession,
}: UseShareDialogRuntimeOptions) {
  const [agentPromptCopied, setAgentPromptCopied] = useState(false);
  const [exportLinkCopied, setExportLinkCopied] = useState(false);
  const [view, setView] = useState<"chooser" | "export-result" | "stop-confirm">(
    "chooser",
  );
  const closedRef = useRef(false);
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
    isLive,
    labels: {
      exportToLink: copy.shareable.exportToLink,
    },
    jsonShareCanExport: jsonShare.canExport,
    jsonShareDisabledReason: jsonShare.disabledReason,
    jsonShareUrl: jsonShare.url,
    roomId: room?.roomId,
    shareUrl: room?.shareUrl,
  });

  const closeShare = useCallback(() => {
    closedRef.current = true;
    jsonShare.reset();
    setAgentPromptCopied(false);
    setExportLinkCopied(false);
    setView("chooser");
    onCloseShare();
  }, [jsonShare, onCloseShare]);

  const requestStopSession = () => setView("stop-confirm");
  const cancelStopSession = () => setView("chooser");
  const confirmStopSession = () => {
    onStopSession();
    closeShare();
  };

  const exportToJsonLink = () => {
    setView("export-result");
    setExportLinkCopied(false);
    void jsonShare
      .exportLink()
      .then((exported) => {
        if (!exported && !closedRef.current) {
          closeShare();
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
    productAnalytics.report("agent_invite_copied", { roomId: room?.roomId });
    setAgentPromptCopied(true);
    window.setTimeout(() => setAgentPromptCopied(false), 1200);
  };

  return {
    agentPromptCopied,
    chromeCopy,
    copy,
    cancelStopSession,
    closeShare,
    copyLocalAgentPrompt,
    copyShareableLink,
    confirmStopSession,
    exportLinkCopied,
    exportToJsonLink,
    shareModalTitle,
    shareView,
    requestStopSession,
    view,
  };
}
