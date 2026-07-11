import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  createRoomLocalWorkspaceState,
  type RoomLocalWorkspaceState,
} from "../roomLocalWorkspaceState";
import {
  readIndexedDbRoomLocalWorkspace,
  writeIndexedDbRoomLocalWorkspace,
} from "../workspaceIndexedDb";
import type { WorkspaceState } from "../workspaceStorage";

const ROOM_LOCAL_SAVE_DELAY_MS = 250;

type UseRoomLocalWorkspacePersistenceOptions = {
  roomId?: string;
  ownerId: string;
  workspace: WorkspaceState;
  getWorkspaceSnapshot: () => WorkspaceState;
  onHydrate: (state: RoomLocalWorkspaceState) => void;
  onError?: (error: unknown) => void;
};

export function useRoomLocalWorkspacePersistence({
  roomId,
  ownerId,
  workspace,
  getWorkspaceSnapshot,
  onHydrate,
  onError,
}: UseRoomLocalWorkspacePersistenceOptions) {
  const [hydratedRoomId, setHydratedRoomId] = useState<string | null>(null);
  const latestWorkspaceRef = useRef(workspace);
  const latestWorkspaceByRoomRef = useRef(new Map<string, WorkspaceState>());
  const currentRoomIdRef = useRef(roomId);
  const getWorkspaceSnapshotRef = useRef(getWorkspaceSnapshot);
  const saveTimerRef = useRef<number | null>(null);
  const saveQueueRef = useRef(Promise.resolve());

  useLayoutEffect(() => {
    latestWorkspaceRef.current = workspace;
    currentRoomIdRef.current = roomId;
    if (roomId) latestWorkspaceByRoomRef.current.set(roomId, workspace);
    getWorkspaceSnapshotRef.current = getWorkspaceSnapshot;
  }, [getWorkspaceSnapshot, roomId, workspace]);

  useEffect(() => {
    if (!roomId) {
      setHydratedRoomId(null);
      return;
    }
    let cancelled = false;
    setHydratedRoomId(null);
    void readIndexedDbRoomLocalWorkspace(roomId, ownerId)
      .then((state) => {
        if (cancelled) return;
        if (state) onHydrate(state);
        setHydratedRoomId(roomId);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onError?.(error);
        setHydratedRoomId(roomId);
      });
    return () => {
      cancelled = true;
    };
  }, [onError, onHydrate, ownerId, roomId]);

  const flush = (targetRoomId = roomId) => {
    if (!targetRoomId || hydratedRoomId !== targetRoomId) return;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const roomWorkspace = targetRoomId === currentRoomIdRef.current
      ? getWorkspaceSnapshotRef.current?.() ?? latestWorkspaceRef.current
      : latestWorkspaceByRoomRef.current.get(targetRoomId);
    if (!roomWorkspace) return;
    const state = createRoomLocalWorkspaceState(targetRoomId, roomWorkspace, ownerId);
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => writeIndexedDbRoomLocalWorkspace(state))
      .catch((error: unknown) => {
        onError?.(error);
      });
  };

  useEffect(() => {
    if (!roomId || hydratedRoomId !== roomId) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => flush(roomId), ROOM_LOCAL_SAVE_DELAY_MS);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [hydratedRoomId, roomId, workspace]);

  useEffect(() => {
    const handlePageHide = () => flush(roomId);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      flush(roomId);
    };
  }, [hydratedRoomId, roomId]);

  return { hydrated: Boolean(roomId && hydratedRoomId === roomId) };
}
