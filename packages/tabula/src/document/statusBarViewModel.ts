export type StatusBarSaveState = {
  label: string;
  tone: "saved" | "attention";
  visible: boolean;
};

export const getStatusBarSaveState = ({
  isLive,
  roomAttentionLabels = [
    "Reconnecting",
    "Disconnected",
    "Connection failed",
    "Room offline",
    "Changes aren’t backed up",
  ],
  roomOfflineLabel = "Room offline",
  savedLocallyLabel = "Saved locally",
  statusLabel,
}: {
  isLive: boolean;
  roomAttentionLabels?: readonly string[];
  roomOfflineLabel?: string;
  savedLocallyLabel?: string;
  statusLabel: string;
}): StatusBarSaveState => {
  if (!isLive) {
    return { label: savedLocallyLabel, tone: "saved", visible: true };
  }

  if (roomAttentionLabels.includes(statusLabel)) {
    return { label: statusLabel, tone: "attention", visible: true };
  }

  if (statusLabel === roomOfflineLabel) {
    return { label: roomOfflineLabel, tone: "attention", visible: true };
  }

  return { label: statusLabel, tone: "saved", visible: false };
};
