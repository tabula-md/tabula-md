export type StatusBarSaveState = {
  label: string;
  visible: boolean;
};

export const getStatusBarSaveState = ({
  isLive,
  roomAttentionLabels = [
    "Reconnecting",
    "Disconnected",
    "Connection failed",
    "Room offline",
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
    return { label: savedLocallyLabel, visible: true };
  }

  if (roomAttentionLabels.includes(statusLabel)) {
    return { label: statusLabel, visible: true };
  }

  if (statusLabel === roomOfflineLabel) {
    return { label: roomOfflineLabel, visible: true };
  }

  return { label: statusLabel, visible: false };
};
