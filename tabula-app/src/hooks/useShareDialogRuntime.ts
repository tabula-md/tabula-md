import { useCallback, useRef, useState } from "react";
import type { JsonShareController } from "./useJsonShareController";
import { useAgentHandoffRuntime } from "./useAgentHandoffRuntime";
import type { WorkspaceLanguage } from "./useWorkspacePreferences";
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
  const [exportLinkCopied, setExportLinkCopied] = useState(false);
  const [view, setView] = useState<
    "chooser" | "agent-handoff" | "export-result" | "stop-confirm"
  >("chooser");
  const closedRef = useRef(false);
  const copy = getWorkspaceMenuCopy(language).share;
  const chromeCopy = getWorkspaceChromeCopy(language);
  const shareModalTitle = copy.modalTitle;
  const agentHandoff = useAgentHandoffRuntime({
    activeFile,
    activeText,
    files,
    roomId: room?.roomId,
    roomUrl: isLiveConnected ? room?.shareUrl : undefined,
  });
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
    agentHandoff.reset();
    setExportLinkCopied(false);
    setView("chooser");
    onCloseShare();
  }, [agentHandoff, jsonShare, onCloseShare]);

  const openAgentHandoff = () => {
    agentHandoff.open();
    setView("agent-handoff");
  };
  const closeAgentHandoff = () => setView("chooser");
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

  return {
    agentHandoff,
    chromeCopy,
    closeAgentHandoff,
    copy,
    cancelStopSession,
    closeShare,
    copyShareableLink,
    confirmStopSession,
    exportLinkCopied,
    exportToJsonLink,
    openAgentHandoff,
    shareModalTitle,
    shareView,
    requestStopSession,
    view,
  };
}
