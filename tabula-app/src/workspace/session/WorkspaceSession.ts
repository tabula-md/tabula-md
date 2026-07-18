import type { LocationRoom } from "../workspaceStorage";
import type { WorkspaceRoomRuntime } from "../../collaboration/liveCollaboration";
import {
  useRoomWorkspaceStore,
  useWorkspaceStore,
  type WorkspaceStoreBinding,
} from "../state/workspaceStore";
import { createFollowStore, type FollowStore } from "./FollowStore";

export type RoomWorkspaceBootstrap = {
  checkpointUpdate: Uint8Array;
  generation: number;
};

export type LocalWorkspaceSession = {
  readonly mode: "local";
  readonly follow: FollowStore;
  readonly viewStore: WorkspaceStoreBinding;
  dispose(): void;
};

export type RoomWorkspaceSession = {
  readonly mode: "room";
  readonly origin: "created" | "joined";
  readonly room: LocationRoom;
  readonly follow: FollowStore;
  readonly viewStore: WorkspaceStoreBinding;
  takeBootstrap(): RoomWorkspaceBootstrap | null;
  attachRuntime(runtime: WorkspaceRoomRuntime): () => void;
  getRuntime(): WorkspaceRoomRuntime | null;
  subscribeRuntime(listener: () => void): () => void;
  dispose(): void;
};

export type WorkspaceSession = LocalWorkspaceSession | RoomWorkspaceSession;

export const createLocalWorkspaceSession = (): LocalWorkspaceSession => {
  const follow = createFollowStore();
  return {
    mode: "local",
    follow,
    viewStore: useWorkspaceStore,
    dispose: () => follow.dispose(),
  };
};

export const createRoomWorkspaceSession = (
  room: LocationRoom,
  initialBootstrap: RoomWorkspaceBootstrap | null = null,
  origin: RoomWorkspaceSession["origin"] = "joined",
): RoomWorkspaceSession => {
  let disposed = false;
  let runtime: WorkspaceRoomRuntime | null = null;
  let bootstrap = initialBootstrap;
  const listeners = new Set<() => void>();
  const follow = createFollowStore();

  const publish = () => listeners.forEach((listener) => listener());

  return {
    mode: "room",
    origin,
    room,
    follow,
    viewStore: useRoomWorkspaceStore,
    takeBootstrap() {
      const nextBootstrap = bootstrap;
      bootstrap = null;
      return nextBootstrap;
    },
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
      bootstrap = null;
      follow.dispose();
      listeners.clear();
    },
  };
};
