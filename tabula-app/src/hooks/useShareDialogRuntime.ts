import { useCallback, useRef, useState } from "react";
import { buildShareViewModel } from "@tabula-md/tabula";
import type { JsonShareController } from "./useJsonShareController";
import type { WorkspaceLanguage } from "./useWorkspacePreferences";
import { productAnalytics } from "../observability/productAnalytics";
import { buildAgentInvite } from "../shareAgentHandoff";
import {
  getWorkspaceChromeCopy,
  getWorkspaceMenuCopy,
} from "../workspaceLocale";
import type { LocationRoom } from "../workspaceStorage";

type UseShareDialogRuntimeOptions = {
  room?: LocationRoom | null;
  isLive: boolean;
  isLiveConnected: boolean;
  jsonShare: JsonShareController;
  language: WorkspaceLanguage;
  onCloseShare: () => void;
  onStopSession: () => void;
};

export function useShareDialogRuntime({
  room,
  isLive,
  isLiveConnected,
  jsonShare,
  language,
  onCloseShare,
  onStopSession,
}: UseShareDialogRuntimeOptions) {
  const [agentInviteCopied, setAgentInviteCopied] = useState(false);
  const [exportLinkCopied, setExportLinkCopied] = useState(false);
  const [view, setView] = useState<"chooser" | "export-result" | "stop-confirm">("chooser");
  const closedRef = useRef(false);
  const copy = getWorkspaceMenuCopy(language).share;
  const chromeCopy = getWorkspaceChromeCopy(language);
  const shareModalTitle = copy.modalTitle;
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
    setAgentInviteCopied(false);
    setExportLinkCopied(false);
    setView("chooser");
    onCloseShare();
  }, [jsonShare, onCloseShare]);

  const copyAgentInvite = async () => {
    if (!isLiveConnected || !room?.shareUrl) return;
    await navigator.clipboard.writeText(buildAgentInvite(room.shareUrl));
    productAnalytics.report("agent_invite_copied", { roomId: room.roomId });
    setAgentInviteCopied(true);
    window.setTimeout(() => setAgentInviteCopied(false), 1200);
  };
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
    agentInviteCopied,
    chromeCopy,
    copy,
    cancelStopSession,
    closeShare,
    copyAgentInvite,
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
