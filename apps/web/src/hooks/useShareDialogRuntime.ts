import { useEffect, useState } from "react";
import type { JsonShareController } from "./useJsonShareController";
import type { WorkspaceLanguage } from "./useWorkspacePreferences";
import {
  buildLocalAgentPrompt,
  type AgentHandoffScope,
} from "../shareAgentHandoff";
import {
  buildShareViewModel,
  normalizeSharePanel,
  type VisibleSharePanel,
} from "../shareViewModel";
import type { SharePanel } from "../uiTypes";
import {
  getWorkspaceChromeCopy,
  getWorkspaceMenuCopy,
} from "../workspaceLocale";
import type { WorkspaceFile } from "../workspaceStorage";

type UseShareDialogRuntimeOptions = {
  activeFile?: WorkspaceFile;
  activeFileTitle: string;
  canStartSession: boolean;
  files: WorkspaceFile[];
  isLive: boolean;
  jsonShare: JsonShareController;
  language: WorkspaceLanguage;
  shareOpen: boolean;
  sharePanelTarget?: SharePanel;
  startSessionUnavailableReason: string;
  onCloseShare: () => void;
  onStopSession: () => void;
};

export function useShareDialogRuntime({
  activeFile,
  activeFileTitle,
  canStartSession,
  files,
  isLive,
  jsonShare,
  language,
  shareOpen,
  sharePanelTarget,
  startSessionUnavailableReason,
  onCloseShare,
  onStopSession,
}: UseShareDialogRuntimeOptions) {
  const [sharePanel, setSharePanel] = useState<VisibleSharePanel>("share-link");
  const [agentScope, setAgentScope] = useState<AgentHandoffScope>("file");
  const [agentInstruction, setAgentInstruction] = useState("");
  const [agentPromptCopied, setAgentPromptCopied] = useState(false);
  const [exportLinkCopied, setExportLinkCopied] = useState(false);
  const activeFileDisplayTitle = activeFileTitle.replace(
    /\.(?:md|markdown)$/i,
    "",
  );
  const copy = getWorkspaceMenuCopy(language).share;
  const chromeCopy = getWorkspaceChromeCopy(language);
  const shareModalTitle = copy.modalTitle(activeFileDisplayTitle);
  const shareView = buildShareViewModel({
    activePanel: sharePanel,
    canStartSession,
    isLive,
    labels: {
      shareLink: copy.tabs.shareLink,
      export: copy.tabs.export,
      sendTo: copy.tabs.sendTo,
      exportToLink: copy.shareable.exportToLink,
      exporting: copy.shareable.exporting,
      updateLink: copy.shareable.updateLink,
    },
    jsonShareCanExport: jsonShare.canExport,
    jsonShareDisabledReason: jsonShare.disabledReason,
    jsonShareExporting: jsonShare.exporting,
    jsonShareUrl: jsonShare.url,
    roomId: activeFile?.roomId,
    shareUrl: activeFile?.shareUrl,
    startSessionUnavailableReason,
  });

  useEffect(() => {
    if (shareOpen) {
      setSharePanel(normalizeSharePanel(sharePanelTarget));
    }
  }, [activeFile?.id, shareOpen, sharePanelTarget]);

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

  const stopSession = () => {
    const confirmed = window.confirm(copy.live.stopConfirm);

    if (confirmed) {
      onStopSession();
    }
  };

  const exportToJsonLink = () => {
    void jsonShare.exportLink().finally(() => setExportLinkCopied(false));
  };

  const copyShareableLink = async () => {
    await jsonShare.copyLink();
    setExportLinkCopied(true);
    window.setTimeout(() => setExportLinkCopied(false), 1200);
  };

  const copyLocalAgentPrompt = async () => {
    const prompt = buildLocalAgentPrompt({
      activeFile,
      files,
      instruction: agentInstruction,
      scope: agentScope,
    });

    await navigator.clipboard.writeText(prompt);
    setAgentPromptCopied(true);
    window.setTimeout(() => setAgentPromptCopied(false), 1200);
  };

  return {
    activeFileDisplayTitle,
    agentInstruction,
    agentPromptCopied,
    agentScope,
    chromeCopy,
    copy,
    copyLocalAgentPrompt,
    copyShareableLink,
    exportLinkCopied,
    exportToJsonLink,
    setAgentInstruction,
    setAgentScope,
    setSharePanel,
    shareModalTitle,
    shareView,
    stopSession,
  };
}
