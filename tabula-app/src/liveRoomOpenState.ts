import type { ConnectionStatus } from "./collaboration";

export const LIVE_ROOM_OPEN_TIMEOUT_MS = 8_000;

export type LiveRoomOpenState = "idle" | "opening" | "unavailable";

export const getLiveRoomOpenState = ({
  connectionStatus,
  hasActiveFile,
  hasActiveRoom,
  timedOut,
}: {
  connectionStatus: ConnectionStatus;
  hasActiveFile: boolean;
  hasActiveRoom: boolean;
  timedOut: boolean;
}): LiveRoomOpenState => {
  if (!hasActiveRoom || hasActiveFile) {
    return "idle";
  }

  if (timedOut && connectionStatus === "connected") {
    return "unavailable";
  }

  return "opening";
};
