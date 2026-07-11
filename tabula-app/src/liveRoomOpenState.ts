import type { ConnectionStatus } from "./collaboration";

export const LIVE_ROOM_OPEN_TIMEOUT_MS = 8_000;

export type LiveRoomOpenFailure = "expired" | "invalid" | "unsupported";
export type LiveRoomOpenState = "idle" | "opening" | "unavailable" | "expired";

export const getLiveRoomOpenState = ({
  connectionStatus,
  hasActiveFile,
  hasActiveRoom,
  timedOut,
  failure,
}: {
  connectionStatus: ConnectionStatus;
  hasActiveFile: boolean;
  hasActiveRoom: boolean;
  timedOut: boolean;
  failure?: LiveRoomOpenFailure | null;
}): LiveRoomOpenState => {
  if (!hasActiveRoom || hasActiveFile) {
    return "idle";
  }

  if (failure === "expired") {
    return "expired";
  }

  if (failure || connectionStatus === "failed") {
    return "unavailable";
  }

  if (timedOut && connectionStatus === "connected") {
    return "unavailable";
  }

  return "opening";
};
