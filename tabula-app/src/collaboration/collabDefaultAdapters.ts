import {
  decryptEnvelopeForRoom,
  encryptBytesForRoom,
  importRoomKey,
  resolveTabulaRoomBaseUrl,
} from "./collabRoom";
import { createBrowserCollabRuntimeClock, type CollabRuntimeAdapters } from "./collabRuntimeAdapters";
import { createYjsCollabTextAdapter } from "./collabYjsTextAdapter";
import { createDefaultRoomCheckpointStore } from "./roomCheckpointStore";
import { createDefaultRoomTransport } from "./roomTransport";

export const createDefaultCollabRuntimeAdapters = (): CollabRuntimeAdapters => ({
  clock: createBrowserCollabRuntimeClock(),
  crypto: {
    importRoomKey,
    encryptEnvelope: encryptBytesForRoom,
    decryptEnvelope: decryptEnvelopeForRoom,
  },
  text: createYjsCollabTextAdapter(),
  roomCheckpointStore: createDefaultRoomCheckpointStore(),
  createRoomTransport: createDefaultRoomTransport,
  resolveRoomBaseUrl: resolveTabulaRoomBaseUrl,
});
