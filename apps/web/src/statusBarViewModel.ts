export type StatusBarSaveState = {
  label: string;
  visible: boolean;
};

export const getStatusBarSaveState = ({
  isLive,
  statusLabel,
}: {
  isLive: boolean;
  statusLabel: string;
}): StatusBarSaveState => {
  if (!isLive) {
    return { label: "Saved locally", visible: true };
  }

  if (statusLabel === "Room offline") {
    return { label: statusLabel, visible: true };
  }

  return { label: statusLabel, visible: false };
};
