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
  activeFileAvailable: boolean;
  activeRoom: LocationRoom | null;
  connectionStatus: ConnectionStatus;
  hydrationStatus: RoomHydrationStatus;
  onConnectionFailed: () => void;
};

export function useLiveRoomConnectionLifecycle({
  activeFileAvailable,
  activeRoom,
  connectionStatus,
  hydrationStatus,
  onConnectionFailed,
}: UseLiveRoomConnectionLifecycleOptions) {
  const failedRoomIdRef = useRef<string | null>(null);
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
    const roomId = activeRoom?.roomId;
    if (!roomId || connectionStatus !== "failed") return;
    if (!activeFileAvailable || failedRoomIdRef.current === roomId) return;

    failedRoomIdRef.current = roomId;
    onConnectionFailed();
  }, [activeFileAvailable, activeRoom?.roomId, connectionStatus, onConnectionFailed]);

  useEffect(() => {
    if (connectionStatus === "connected" || !activeRoom) {
      failedRoomIdRef.current = null;
    }
  }, [activeRoom, connectionStatus]);

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
