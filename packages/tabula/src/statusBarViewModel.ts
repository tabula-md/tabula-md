export type StatusBarSaveState = {
  label: string;
  visible: boolean;
};

export const getStatusBarSaveState = ({
  isLive,
  roomOfflineLabel = "Room offline",
  savedLocallyLabel = "Saved locally",
  statusLabel,
}: {
  isLive: boolean;
  roomOfflineLabel?: string;
  savedLocallyLabel?: string;
  statusLabel: string;
}): StatusBarSaveState => {
  if (!isLive) {
    return { label: savedLocallyLabel, visible: true };
  }

  if (statusLabel === roomOfflineLabel || statusLabel === "Room offline") {
    return { label: roomOfflineLabel, visible: true };
  }

  return { label: statusLabel, visible: false };
};
