import type {
  HeadlessRoomClientOptions,
} from "./headlessRoomClient.js";

export type {
  HeadlessRoomCheckpointStatus,
  HeadlessRoomChange,
  HeadlessRoomChangeResult,
  HeadlessRoomClient,
  HeadlessRoomClientOptions,
  HeadlessRoomClientState,
  HeadlessRoomCollaborator,
  HeadlessRoomConnectionStatus,
  HeadlessRoomExpectedNode,
  HeadlessRoomHydrationStatus,
  HeadlessRoomSelection,
} from "./headlessRoomClient.js";
export type {
  LoadedWorkspaceRoomCheckpoint,
  SaveWorkspaceRoomCheckpointRequest,
  SaveWorkspaceRoomCheckpointResult,
  WorkspaceRoomCheckpointStore,
} from "./workspaceRoomCheckpoint.js";
export type {
  WorkspaceRoomSyncAdapters,
  WorkspaceRoomSyncClock,
  WorkspaceRoomTransport,
  WorkspaceRoomTransportHandlers,
} from "./workspaceRoomSync.js";
export {
  createHeadlessRoomClock,
  createHeadlessRoomSyncAdapters,
} from "./headlessRoomAdapters.js";

const installEphemeralNodeStorage = () => {
  const nodeVersion = (globalThis as typeof globalThis & {
    process?: { versions?: { node?: string } };
  }).process?.versions?.node;
  if (!nodeVersion) return;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  if (!descriptor || "value" in descriptor && descriptor.value) return;
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, String(value)),
    },
  });
};

export const createHeadlessRoomClient = async (options: HeadlessRoomClientOptions) => {
  installEphemeralNodeStorage();
  const { createHeadlessRoomClientRuntime } = await import("./headlessRoomClient.js");
  return createHeadlessRoomClientRuntime(options);
};
