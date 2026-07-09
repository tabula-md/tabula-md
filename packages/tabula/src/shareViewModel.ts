import {
  getRoomShareLinkView,
  type RoomShareLinkView,
} from "./shareLinkViewModel";

export type ShareViewLabels = {
  exportToLink: string;
  exporting: string;
};

export type ShareViewModel = {
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

export const buildShareViewModel = ({
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
        : labels.exportToLink,
    },
  };
};
