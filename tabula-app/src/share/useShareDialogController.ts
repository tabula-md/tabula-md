import { useCallback, useRef, useState } from "react";
import { buildShareViewModel } from "@tabula-md/tabula";
import type { JsonShareController } from "./useJsonShareController";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { productAnalytics } from "../observability/productAnalytics";
import { buildAgentInvite } from "./shareAgentHandoff";
import { getWorkspaceMenuCopy } from "../workspace/workspaceLocale";
import type { LocationRoom } from "../workspace/workspaceStorage";
import { clientErrorReporter } from "../observability/clientErrorReporting";
import type { RoomExitLocalWorkspaceStrategy } from "../workspace/workspaceSessionTransition";

type UseShareDialogControllerOptions = {
  room?: LocationRoom | null;
  isLive: boolean;
  jsonShare: JsonShareController;
  language: WorkspaceLanguage;
  roomExitStrategy: RoomExitLocalWorkspaceStrategy;
  onCloseShare: () => void;
  onCopyFailed: () => void;
  onStopSession: (strategy: RoomExitLocalWorkspaceStrategy) => void;
};

export function useShareDialogController({
  room,
  isLive,
  jsonShare,
  language,
  roomExitStrategy,
  onCloseShare,
  onCopyFailed,
  onStopSession,
}: UseShareDialogControllerOptions) {
  const [agentInviteCopied, setAgentInviteCopied] = useState(false);
  const [exportLinkCopied, setExportLinkCopied] = useState(false);
  const [view, setView] = useState<"chooser" | "export-result" | "stop-confirm">("chooser");
  const [selectedRoomExitStrategy, setSelectedRoomExitStrategy] =
    useState<RoomExitLocalWorkspaceStrategy>(roomExitStrategy);
  const closedRef = useRef(false);
  const copy = getWorkspaceMenuCopy(language).share;
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
    if (!room?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(buildAgentInvite(room.shareUrl));
      productAnalytics.report("agent_invite_copied", { roomId: room.roomId });
      setAgentInviteCopied(true);
      window.setTimeout(() => setAgentInviteCopied(false), 1200);
    } catch (error) {
      clientErrorReporter.report({
        feature: "collaboration",
        operation: "copy-agent-invite",
        error,
      });
      onCopyFailed();
    }
  };
  const requestStopSession = () => {
    setSelectedRoomExitStrategy(roomExitStrategy);
    setView("stop-confirm");
  };
  const cancelStopSession = () => setView("chooser");
  const confirmStopSession = () => {
    onStopSession(selectedRoomExitStrategy);
    closeShare();
  };

  const exportToJsonLink = () => {
    setExportLinkCopied(false);
    void jsonShare
      .exportLink()
      .then((exported) => {
        if (closedRef.current) return;
        if (exported) setView("export-result");
        else closeShare();
      })
      .finally(() => {
        if (!closedRef.current) setExportLinkCopied(false);
      });
  };

  const copyShareableLink = async () => {
    const didCopy = await jsonShare.copyLink();
    if (!didCopy) return;
    setExportLinkCopied(true);
    window.setTimeout(() => setExportLinkCopied(false), 1200);
  };

  return {
    agentInviteCopied,
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
    selectedRoomExitStrategy,
    setSelectedRoomExitStrategy,
    view,
  };
}
