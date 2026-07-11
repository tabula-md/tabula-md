import {
  ROOM_WIRE_MAX_CRDT_STATE_BYTES,
  WORKSPACE_ROOM_ROOT_ID,
  decodeEncryptedData,
  encodeEncryptedData,
  createWorkspaceRoomCrdt,
  getWorkspaceRoomSnapshot,
  initializeWorkspaceRoomCrdt,
  validateWorkspaceRoomLimits,
  validateWorkspaceRoomStructure,
  WORKSPACE_ROOM_SCHEMA_VERSION,
  type WorkspaceRoomComment,
} from "@tabula-md/tabula";
import * as Y from "yjs";
import { tabulaServiceConfig } from "../serviceConfig";

export const ROOM_CHECKPOINT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type LoadedRoomCheckpoint =
  | {
      status: "ready";
      generation: number;
      encryptedCheckpoint: Uint8Array;
      expiresAt: number;
    }
  | {
      status: "expired";
      generation: number;
      expiresAt: number;
    };

export type SaveRoomCheckpointRequest = {
  expectedGeneration: number;
  encryptedCheckpoint: Uint8Array;
  expiresAt: number;
};

export type SaveRoomCheckpointResult =
  | { ok: true; generation: number }
  | { ok: false; reason: "conflict"; generation: number };

export type RoomCheckpointStore = {
  enabled: boolean;
  loadEncryptedCheckpoint(roomId: string, signal?: AbortSignal): Promise<LoadedRoomCheckpoint | null>;
  saveEncryptedCheckpoint(
    roomId: string,
    request: SaveRoomCheckpointRequest,
    signal?: AbortSignal,
  ): Promise<SaveRoomCheckpointResult>;
};

export type RoomCheckpointMetadata = {
  kind: "workspace-room-crdt";
  roomId: string;
  schemaVersion: typeof WORKSPACE_ROOM_SCHEMA_VERSION;
};

export const createNoopRoomCheckpointStore = (): RoomCheckpointStore => ({
  enabled: false,
  async loadEncryptedCheckpoint() {
    return null;
  },
  async saveEncryptedCheckpoint() {
    throw new Error("Live room persistence is unavailable.");
  },
});

export const getRoomCheckpointAvailability = () => ({
  available: Boolean(tabulaServiceConfig.firebaseConfig),
  unavailableReason: tabulaServiceConfig.firebaseConfig
    ? ""
    : tabulaServiceConfig.copy.roomCheckpointUnconfiguredMessage,
});

export const createDefaultRoomCheckpointStore = (): RoomCheckpointStore => {
  if (tabulaServiceConfig.firebaseConfig) {
    return createLazyFirebaseRoomCheckpointStore(tabulaServiceConfig.firebaseConfig);
  }
  return createNoopRoomCheckpointStore();
};

const createLazyFirebaseRoomCheckpointStore = (firebaseConfig: string): RoomCheckpointStore => {
  let storePromise: Promise<RoomCheckpointStore> | null = null;
  const loadStore = () => {
    storePromise ??= import("../data/firebase").then(({ createFirebaseRoomCheckpointStore }) =>
      createFirebaseRoomCheckpointStore(firebaseConfig),
    );
    return storePromise;
  };

  return {
    enabled: true,
    async loadEncryptedCheckpoint(roomId, signal) {
      const store = await loadStore();
      if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
      return store.enabled ? store.loadEncryptedCheckpoint(roomId, signal) : null;
    },
    async saveEncryptedCheckpoint(roomId, request, signal) {
      const store = await loadStore();
      if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
      if (!store.enabled) throw new Error("Live room persistence is unavailable.");
      return store.saveEncryptedCheckpoint(roomId, request, signal);
    },
  };
};

export type InitialWorkspaceRoomCheckpointInput = {
  roomId: string;
  roomKey: string;
  documents: readonly {
    id: string;
    title: string;
    text: string;
    parentId?: string | null;
    order?: number;
  }[];
  folders: readonly {
    id: string;
    title: string;
    parentId: string | null;
    order?: number;
  }[];
  commentsByFileId?: Record<string, WorkspaceRoomComment[]>;
};

export const persistInitialWorkspaceRoomCheckpoint = async (
  {
    roomId,
    roomKey,
    documents,
    folders,
    commentsByFileId = {},
  }: InitialWorkspaceRoomCheckpointInput,
  store: RoomCheckpointStore = createDefaultRoomCheckpointStore(),
) => {
  if (!store.enabled) throw new Error("Live room persistence is unavailable.");

  const doc = new Y.Doc();
  const room = createWorkspaceRoomCrdt({ roomId, doc });
  try {
    initializeWorkspaceRoomCrdt(room, {
      nodes: [
        ...folders
          .filter((folder) => folder.id !== WORKSPACE_ROOM_ROOT_ID)
          .map((folder) => ({
            ...folder,
            type: "folder" as const,
            parentId: folder.parentId ?? WORKSPACE_ROOM_ROOT_ID,
          })),
        ...documents.map((document) => ({
          id: document.id,
          type: "document" as const,
          parentId: document.parentId ?? WORKSPACE_ROOM_ROOT_ID,
          title: document.title,
          order: document.order,
          markdown: document.text,
        })),
      ],
      comments: Object.values(commentsByFileId).flat(),
    });

    const structure = validateWorkspaceRoomStructure(room, roomId);
    if (!structure.ok) throw new Error(structure.message);
    const limits = validateWorkspaceRoomLimits(getWorkspaceRoomSnapshot(room));
    if (!limits.ok) throw new Error(limits.message);

    const update = Y.encodeStateAsUpdate(doc);
    if (update.byteLength > ROOM_WIRE_MAX_CRDT_STATE_BYTES) {
      throw new Error("The collaboration state exceeds the supported size.");
    }
    const encryptedCheckpoint = await encryptWorkspaceRoomCheckpoint({ roomId, update, roomKey });
    const expiresAt = Date.now() + ROOM_CHECKPOINT_RETENTION_MS;
    const result = await store.saveEncryptedCheckpoint(roomId, {
      expectedGeneration: 0,
      encryptedCheckpoint,
      expiresAt,
    });
    if (!result.ok) throw new Error("The live room already exists.");
    return { generation: result.generation, expiresAt };
  } finally {
    doc.destroy();
  }
};

export const encryptWorkspaceRoomCheckpoint = async ({
  roomId,
  update,
  roomKey,
}: {
  roomId: string;
  update: Uint8Array;
  roomKey: string | CryptoKey;
}) =>
  encodeEncryptedData(update, {
    encryptionKey: roomKey,
    metadata: {
      kind: "workspace-room-crdt",
      roomId,
      schemaVersion: WORKSPACE_ROOM_SCHEMA_VERSION,
    } satisfies RoomCheckpointMetadata,
    additionalData: getRoomCheckpointAdditionalData(roomId),
  });

export const decryptWorkspaceRoomCheckpoint = async ({
  encryptedCheckpoint,
  roomId,
  roomKey,
}: {
  encryptedCheckpoint: Uint8Array;
  roomId: string;
  roomKey: string | CryptoKey;
}) => {
  const decoded = await decodeEncryptedData<RoomCheckpointMetadata>(encryptedCheckpoint, {
    decryptionKey: roomKey,
    additionalData: getRoomCheckpointAdditionalData(roomId),
  });

  if (
    decoded.metadata.kind !== "workspace-room-crdt" ||
    decoded.metadata.roomId !== roomId ||
    decoded.metadata.schemaVersion !== WORKSPACE_ROOM_SCHEMA_VERSION
  ) {
    throw new Error("Room checkpoint failed: unsupported checkpoint metadata");
  }
  return decoded.data;
};

const getRoomCheckpointAdditionalData = (roomId: string) =>
  new TextEncoder().encode(`tabula.workspace-room-crdt:v${WORKSPACE_ROOM_SCHEMA_VERSION}:${roomId}`);
