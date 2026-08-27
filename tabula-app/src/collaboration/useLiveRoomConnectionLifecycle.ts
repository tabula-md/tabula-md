import { useEffect, useRef, useState } from "react";
import type {
  ConnectionStatus,
  RoomHydrationStatus,
} from "./liveCollaboration";
import {
  LIVE_ROOM_OPEN_TIMEOUT_MS,
} from "./liveRoomOpenState";
import { syncUrlForRoom, type LocationRoom } from "../workspace/workspaceStorage";

type UseLiveRoomConnectionLifecycleOptions = {
  activeRoom: LocationRoom | null;
  connectionStatus: ConnectionStatus;
  hydrationStatus: RoomHydrationStatus;
  isStartingLive: boolean;
};

export function useLiveRoomConnectionLifecycle({
  activeRoom,
  connectionStatus,
  hydrationStatus,
  isStartingLive,
}: UseLiveRoomConnectionLifecycleOptions) {
  const syncedRoomUrlRef = useRef<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const roomOpening = Boolean(activeRoom) &&
    hydrationStatus !== "failed" &&
    (isStartingLive || hydrationStatus !== "ready");

  useEffect(() => {
    if (!roomOpening) {
      setTimedOut(false);
      return;
    }

    const timeoutId = window.setTimeout(() => setTimedOut(true), LIVE_ROOM_OPEN_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [activeRoom?.roomId, roomOpening]);

  useEffect(() => {
    if (!activeRoom) {
      syncedRoomUrlRef.current = null;
      return;
    }
    if (connectionStatus !== "connected" || syncedRoomUrlRef.current === activeRoom.roomId) return;

    syncedRoomUrlRef.current = activeRoom.roomId;
    syncUrlForRoom(activeRoom);
  }, [activeRoom, connectionStatus]);

  return {
    timedOut,
  };
}
