import { getCrypto } from "./data/encryption";
import { createRoomEnvelope, decryptRoomEnvelope } from "./room/envelope";
import type { WorkspaceRoomSyncAdapters } from "./workspaceRoomSync";

export const createHeadlessRoomClock = (): WorkspaceRoomSyncAdapters["clock"] => ({
  setTimeout(callback, delayMs) {
    return globalThis.setTimeout(callback, delayMs);
  },
  clearTimeout(handle) {
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
  createId() {
    return getCrypto().randomUUID();
  },
});

export const createHeadlessRoomSyncAdapters = ({
  createRoomTransport,
  clock = createHeadlessRoomClock(),
}: {
  createRoomTransport: WorkspaceRoomSyncAdapters["createRoomTransport"];
  clock?: WorkspaceRoomSyncAdapters["clock"];
}): WorkspaceRoomSyncAdapters => ({
  clock,
  crypto: {
    encryptEnvelope: (roomKey, roomId, kind, version, plaintext) =>
      createRoomEnvelope({ roomKey, roomId, kind, version, plaintext }),
    decryptEnvelope: (roomKey, envelope) => decryptRoomEnvelope({ roomKey, envelope }),
  },
  createRoomTransport,
});
