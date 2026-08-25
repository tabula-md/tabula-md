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
};

export function useLiveRoomConnectionLifecycle({
  activeRoom,
  connectionStatus,
  hydrationStatus,
}: UseLiveRoomConnectionLifecycleOptions) {
  const syncedRoomUrlRef = useRef<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (
      !activeRoom ||
      connectionStatus !== "connected" ||
      hydrationStatus !== "waiting-for-state"
    ) {
      setTimedOut(false);
      return;
    }

    const timeoutId = window.setTimeout(() => setTimedOut(true), LIVE_ROOM_OPEN_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [activeRoom, connectionStatus, hydrationStatus]);

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
