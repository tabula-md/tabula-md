import type { LocationRoom } from "../../workspaceStorage";
import type { WorkspaceRoomRuntime } from "../../collaboration/liveCollaboration";

export type LocalWorkspaceSession = {
  readonly mode: "local";
  dispose(): void;
};

export type RoomWorkspaceSession = {
  readonly mode: "room";
  readonly room: LocationRoom;
  attachRuntime(runtime: WorkspaceRoomRuntime): () => void;
  getRuntime(): WorkspaceRoomRuntime | null;
  subscribeRuntime(listener: () => void): () => void;
  dispose(): void;
};

export type WorkspaceSession = LocalWorkspaceSession | RoomWorkspaceSession;

export const createLocalWorkspaceSession = (): LocalWorkspaceSession => ({
  mode: "local",
  dispose: () => undefined,
});

export const createRoomWorkspaceSession = (room: LocationRoom): RoomWorkspaceSession => {
  let disposed = false;
  let runtime: WorkspaceRoomRuntime | null = null;
  const listeners = new Set<() => void>();

  const publish = () => listeners.forEach((listener) => listener());

  return {
    mode: "room",
    room,
    attachRuntime(nextRuntime) {
      if (disposed) {
        nextRuntime.disconnect();
        return () => undefined;
      }
      if (runtime !== nextRuntime) {
        runtime?.disconnect();
        runtime = nextRuntime;
        publish();
      }
      let detached = false;
      return () => {
        if (detached) return;
        detached = true;
        if (runtime === nextRuntime) {
          runtime = null;
          publish();
        }
      };
    },
    getRuntime: () => runtime,
    subscribeRuntime(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      runtime?.disconnect();
      runtime = null;
      listeners.clear();
    },
  };
};
