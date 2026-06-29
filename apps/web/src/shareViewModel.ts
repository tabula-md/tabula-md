import { getRoomShareLinkView, type RoomShareLinkView } from "./shareLinkViewModel";
import type { SharePanel } from "./uiTypes";

export type VisibleSharePanel = "share-link" | "export" | "send-to";

export type ShareTabView = {
  id: VisibleSharePanel;
  label: string;
};

export type ShareViewLabels = {
  shareLink: string;
  export: string;
  sendTo: string;
  exportToLink: string;
  exporting: string;
  updateLink: string;
};

export type ShareViewModel = {
  activePanel: VisibleSharePanel;
  tabs: ShareTabView[];
  publishVisible: false;
  live: {
    status: "active" | "blocked" | "ready";
    canStart: boolean;
    disabledReason: string;
    link: RoomShareLinkView;
  };
  shareable: {
    status: "blocked" | "exported" | "exporting" | "ready";
    canExport: boolean;
    disabledReason: string;
    hasLink: boolean;
    primaryLabel: string;
  };
};

export const normalizeSharePanel = (panel?: SharePanel): VisibleSharePanel => {
  if (panel === "export" || panel === "send-to" || panel === "share-link") {
    return panel;
  }

  return "share-link";
};

export const buildShareViewModel = ({
  activePanel,
  canStartSession,
  isLive,
  labels,
  jsonShareCanExport,
  jsonShareDisabledReason,
  jsonShareExporting,
  jsonShareUrl,
  roomId,
  shareUrl,
  startSessionUnavailableReason,
}: {
  activePanel?: SharePanel;
  canStartSession: boolean;
  isLive: boolean;
  labels: ShareViewLabels;
  jsonShareCanExport: boolean;
  jsonShareDisabledReason: string;
  jsonShareExporting: boolean;
  jsonShareUrl?: string;
  roomId?: string;
  shareUrl?: string;
  startSessionUnavailableReason: string;
}): ShareViewModel => {
  const shareableHasLink = Boolean(jsonShareUrl);
  const shareableBlocked = Boolean(jsonShareDisabledReason);

  return {
    activePanel: normalizeSharePanel(activePanel),
    tabs: [
      { id: "share-link", label: labels.shareLink },
      { id: "export", label: labels.export },
      { id: "send-to", label: labels.sendTo },
    ],
    publishVisible: false,
    live: {
      status: isLive ? "active" : canStartSession ? "ready" : "blocked",
      canStart: canStartSession,
      disabledReason: startSessionUnavailableReason,
      link: getRoomShareLinkView(shareUrl, roomId),
    },
    shareable: {
      status: jsonShareExporting
        ? "exporting"
        : shareableBlocked
          ? "blocked"
          : shareableHasLink
            ? "exported"
            : "ready",
      canExport: jsonShareCanExport,
      disabledReason: jsonShareDisabledReason,
      hasLink: shareableHasLink,
      primaryLabel: jsonShareExporting
        ? labels.exporting
        : shareableHasLink
          ? labels.updateLink
          : labels.exportToLink,
    },
  };
};
