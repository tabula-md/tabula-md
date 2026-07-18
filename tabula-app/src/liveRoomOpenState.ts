import type {
  ConnectionStatus,
  RoomHydrationStatus,
} from "./collaboration/liveCollaboration";

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
  if (!hasActiveRoom || hydrationStatus === "ready") {
    return "idle";
  }

  if (failure === "expired") {
    return "expired";
  }

  if (failure || connectionStatus === "failed" || hydrationStatus === "failed") {
    return "unavailable";
  }

  if (timedOut && connectionStatus === "connected" && hydrationStatus === "waiting-for-state") {
    return "unavailable";
  }

  return "opening";
};
