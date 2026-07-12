import type { LocationRoom } from "../../workspaceStorage";

type DisposableRoomRuntime = {
  disconnect(): void;
};

export type LocalWorkspaceSession = {
  readonly mode: "local";
  dispose(): void;
};

export type RoomWorkspaceSession = {
  readonly mode: "room";
  readonly room: LocationRoom;
  attachRuntime(runtime: DisposableRoomRuntime): () => void;
  dispose(): void;
};

export type WorkspaceSession = LocalWorkspaceSession | RoomWorkspaceSession;

export const createLocalWorkspaceSession = (): LocalWorkspaceSession => ({
  mode: "local",
  dispose: () => undefined,
});

export const createRoomWorkspaceSession = (room: LocationRoom): RoomWorkspaceSession => {
  let disposed = false;
  let runtime: DisposableRoomRuntime | null = null;

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
      }
      let detached = false;
      return () => {
        if (detached) return;
        detached = true;
        if (runtime === nextRuntime) runtime = null;
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      runtime?.disconnect();
      runtime = null;
    },
  };
};
