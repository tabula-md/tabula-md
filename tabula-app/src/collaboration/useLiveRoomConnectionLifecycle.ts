import { useEffect, useRef, useState } from "react";
import type {
  ConnectionStatus,
  RoomHydrationStatus,
} from "./liveCollaboration";
import {
  LIVE_ROOM_OPEN_TIMEOUT_MS,
  type LiveRoomOpenFailure,
} from "./liveRoomOpenState";
import { syncUrlForRoom, type LocationRoom } from "../workspace/workspaceStorage";
import { useEventCallback } from "../shared/useEventCallback";

type UseLiveRoomConnectionLifecycleOptions = {
  activeFileAvailable: boolean;
  activeRoom: LocationRoom | null;
  connectionStatus: ConnectionStatus;
  hydrationStatus: RoomHydrationStatus;
  onConnectionFailed: () => void;
  onRetryConnection: () => void;
  setFailure: (failure: LiveRoomOpenFailure | null) => void;
};

export function useLiveRoomConnectionLifecycle({
  activeFileAvailable,
  activeRoom,
  connectionStatus,
  hydrationStatus,
  onConnectionFailed,
  onRetryConnection,
  setFailure,
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

  const retryOpeningRoom = useEventCallback(() => {
    setTimedOut(false);
    setFailure(null);
    onRetryConnection();
  });

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
    retryOpeningRoom,
    timedOut,
  };
}
