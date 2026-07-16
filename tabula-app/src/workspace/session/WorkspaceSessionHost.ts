import type { LocationRoom } from "../../workspaceStorage";
import {
  createLocalWorkspaceSession,
  createRoomWorkspaceSession,
  type RoomWorkspaceBootstrap,
  type WorkspaceSession,
} from "./WorkspaceSession";

export const createWorkspaceSessionHost = (initialSession: WorkspaceSession) => {
  let currentSession = initialSession;
  let disposed = false;
  const listeners = new Set<() => void>();

  const replace = (nextSession: WorkspaceSession) => {
    if (disposed) {
      nextSession.dispose();
      return currentSession;
    }
    if (currentSession === nextSession) return currentSession;
    currentSession.dispose();
    currentSession = nextSession;
    listeners.forEach((listener) => listener());
    return currentSession;
  };

  return {
    subscribe(listener: () => void) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => currentSession,
    openLocal: () => replace(createLocalWorkspaceSession()),
    openRoom: (
      room: LocationRoom,
      bootstrap?: RoomWorkspaceBootstrap | null,
      origin?: "created" | "joined",
    ) => replace(createRoomWorkspaceSession(room, bootstrap, origin)),
    dispose() {
      if (disposed) return;
      disposed = true;
      currentSession.dispose();
      listeners.clear();
    },
  };
};

export type WorkspaceSessionHost = ReturnType<typeof createWorkspaceSessionHost>;
