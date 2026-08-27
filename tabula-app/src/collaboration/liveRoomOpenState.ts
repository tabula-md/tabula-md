import type {
  ConnectionStatus,
  RoomHydrationStatus,
} from "./liveCollaboration";

export const LIVE_ROOM_OPEN_TIMEOUT_MS = 8_000;

export type LiveRoomOpenFailure = "expired" | "invalid" | "unsupported";
export type LiveRoomOpenState = "idle" | "opening" | "unavailable" | "expired";

export const getLiveRoomOpenState = ({
  connectionStatus,
  hydrationStatus,
  hasActiveRoom,
  timedOut,
  failure,
}: {
  connectionStatus: ConnectionStatus;
  hydrationStatus: RoomHydrationStatus;
  hasActiveRoom: boolean;
  timedOut: boolean;
  failure?: LiveRoomOpenFailure | null;
}): LiveRoomOpenState => {
  if (!hasActiveRoom) {
    return "idle";
  }

  if (failure === "expired") {
    return "expired";
  }

  if (failure || connectionStatus === "failed" || hydrationStatus === "failed") {
    return "unavailable";
  }

  if (timedOut) {
    return "unavailable";
  }

  if (hydrationStatus === "ready") {
    return "idle";
  }

  return "opening";
};
