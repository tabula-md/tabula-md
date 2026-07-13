import {
  REMOTE_AWARENESS_ORIGIN,
  REMOTE_SYNC_ORIGIN,
  createWorkspaceRoomSyncController,
  isRemoteSyncOrigin,
  type WorkspaceRoomSyncAdapters,
  type WorkspaceRoomSyncControllerOptions,
} from "@tabula-md/tabula";
import type { CollabRuntimeAdapters } from "../collabRuntimeAdapters";

export {
  REMOTE_AWARENESS_ORIGIN,
  REMOTE_SYNC_ORIGIN,
  isRemoteSyncOrigin,
};
export type { RemoteSyncOrigin } from "@tabula-md/tabula";

type RoomSyncControllerOptions = Omit<
  WorkspaceRoomSyncControllerOptions,
  "adapters"
> & {
  adapters: CollabRuntimeAdapters;
};

export const createRoomSyncController = ({
  adapters,
  ...options
}: RoomSyncControllerOptions) =>
  createWorkspaceRoomSyncController({
    ...options,
    adapters: {
      clock: adapters.clock,
      crypto: adapters.crypto,
      createRoomTransport: adapters.createRoomTransport,
    } satisfies WorkspaceRoomSyncAdapters,
  });

export type RoomSyncController = ReturnType<typeof createRoomSyncController>;
