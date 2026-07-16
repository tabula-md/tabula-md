import {
  getRoomShareLinkView,
  type RoomShareLinkView,
} from "./shareLinkViewModel";

export type ShareViewLabels = {
  exportToLink: string;
};

export type ShareViewModel = {
  live: {
    status: "active" | "ready";
    link: RoomShareLinkView;
  };
  shareable: {
    status: "blocked" | "exported" | "ready";
    canExport: boolean;
    disabledReason: string;
    hasLink: boolean;
    primaryLabel: string;
  };
};

export const buildShareViewModel = ({
  isLive,
  labels,
  jsonShareCanExport,
  jsonShareDisabledReason,
  jsonShareUrl,
  roomId,
  shareUrl,
}: {
  isLive: boolean;
  labels: ShareViewLabels;
  jsonShareCanExport: boolean;
  jsonShareDisabledReason: string;
  jsonShareUrl?: string;
  roomId?: string;
  shareUrl?: string;
}): ShareViewModel => {
  const shareableHasLink = Boolean(jsonShareUrl);
  const shareableBlocked = Boolean(jsonShareDisabledReason);

  return {
    live: {
      status: isLive ? "active" : "ready",
      link: getRoomShareLinkView(shareUrl, roomId),
    },
    shareable: {
      status: shareableBlocked
        ? "blocked"
        : shareableHasLink
          ? "exported"
          : "ready",
      canExport: jsonShareCanExport,
      disabledReason: jsonShareDisabledReason,
      hasLink: shareableHasLink,
      primaryLabel: labels.exportToLink,
    },
  };
};
