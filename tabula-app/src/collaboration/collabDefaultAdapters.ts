import {
  decryptEnvelopeForRoom,
  encryptBytesForRoom,
  importRoomKey,
  resolveTabulaRoomBaseUrl,
} from "./collabRoom";
import { createBrowserCollabRuntimeClock, type CollabRuntimeAdapters } from "./collabRuntimeAdapters";
import { createDefaultRoomCheckpointStore } from "./roomCheckpointStore";
import { createDefaultRoomTransport } from "./roomTransport";

export const createDefaultCollabRuntimeAdapters = (): CollabRuntimeAdapters => ({
  clock: createBrowserCollabRuntimeClock(),
  crypto: {
    importRoomKey,
    encryptEnvelope: encryptBytesForRoom,
    decryptEnvelope: decryptEnvelopeForRoom,
  },
  roomCheckpointStore: createDefaultRoomCheckpointStore(),
  createRoomTransport: createDefaultRoomTransport,
  resolveRoomBaseUrl: resolveTabulaRoomBaseUrl,
});
