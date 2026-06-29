import * as Y from "yjs";
import { describe, expect, it, vi } from "vitest";
import {
  decryptEnvelopeForRoom,
  encryptBytesForRoom,
  generateRoomKey,
  importRoomKey,
} from "./collabRoom";
import { createCollabSnapshotSync } from "./collabSnapshotSync";
import { createCollabTextDocument } from "./collabTextModel";

const metadata = {
  roomId: "room-1",
  activeConnections: 1,
  snapshotVersion: 2,
  updatedAt: "2026-06-29T00:00:00.000Z",
};

describe("collaboration snapshot sync", () => {
  it("returns missing snapshots while refreshing room metadata", async () => {
    const onRoomMetaChange = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json(metadata));
    const sync = createCollabSnapshotSync({
      roomId: "room-1",
      textDocument: createCollabTextDocument(),
      getBaseUrl: () => "https://rooms.test",
      canUseSnapshots: () => true,
      encryptSnapshot: vi.fn(),
      decryptSnapshot: vi.fn(),
      onTextChange: vi.fn(),
      onRoomMetaChange,
      emitRecoveryEvent: vi.fn(),
      fetcher,
    });

    await expect(sync.fetch()).resolves.toBe("missing");
    expect(onRoomMetaChange).toHaveBeenCalledWith(expect.objectContaining({ roomId: "room-1", version: 2 }));
  });

  it("restores encrypted snapshots into the Yjs text document", async () => {
    const roomKey = await importRoomKey(generateRoomKey());
    const textDocument = createCollabTextDocument();
    const remoteDoc = new Y.Doc();
    remoteDoc.getText("markdown").insert(0, "restored");
    const envelope = await encryptBytesForRoom(roomKey, "room-1", "snapshot", 1, Y.encodeStateAsUpdate(remoteDoc));
    const onTextChange = vi.fn();
    const emitRecoveryEvent = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(envelope))
      .mockResolvedValueOnce(Response.json(metadata));
    const sync = createCollabSnapshotSync({
      roomId: "room-1",
      textDocument,
      getBaseUrl: () => "https://rooms.test",
      canUseSnapshots: () => true,
      encryptSnapshot: vi.fn(),
      decryptSnapshot: (snapshotEnvelope) => decryptEnvelopeForRoom(roomKey, snapshotEnvelope),
      onTextChange,
      emitRecoveryEvent,
      fetcher,
    });

    await expect(sync.fetch()).resolves.toBe("restored");
    expect(textDocument.text.toString()).toBe("restored");
    expect(onTextChange).toHaveBeenCalledWith("restored", { patches: [{ from: 0, to: 0, insert: "restored" }] });
    expect(emitRecoveryEvent).toHaveBeenCalledWith("snapshot-recovered", "Encrypted room snapshot restored.");
  });

  it("stores encrypted snapshots and marks local changes as stored", async () => {
    const roomKey = await importRoomKey(generateRoomKey());
    const textDocument = createCollabTextDocument("local");
    const onRoomMetaChange = vi.fn();
    const onSnapshotStored = vi.fn();
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("PUT");
      const envelope = JSON.parse(String(init?.body));
      await expect(decryptEnvelopeForRoom(roomKey, envelope)).resolves.toBeInstanceOf(Uint8Array);
      return Response.json(metadata);
    });
    const sync = createCollabSnapshotSync({
      roomId: "room-1",
      textDocument,
      getBaseUrl: () => "https://rooms.test",
      canUseSnapshots: () => true,
      encryptSnapshot: (update) => encryptBytesForRoom(roomKey, "room-1", "snapshot", 1, update),
      decryptSnapshot: vi.fn(),
      onTextChange: vi.fn(),
      onRoomMetaChange,
      onSnapshotStored,
      emitRecoveryEvent: vi.fn(),
      fetcher,
    });

    await expect(sync.store()).resolves.toBe(true);
    expect(onSnapshotStored).toHaveBeenCalledTimes(1);
    expect(onRoomMetaChange).toHaveBeenCalledWith(expect.objectContaining({ roomId: "room-1", version: 2 }));
  });

  it("reports invalid snapshot payloads", async () => {
    const emitRecoveryEvent = vi.fn();
    const sync = createCollabSnapshotSync({
      roomId: "room-1",
      textDocument: createCollabTextDocument(),
      getBaseUrl: () => "https://rooms.test",
      canUseSnapshots: () => true,
      encryptSnapshot: vi.fn(),
      decryptSnapshot: vi.fn(),
      onTextChange: vi.fn(),
      emitRecoveryEvent,
      fetcher: vi.fn(async () => Response.json({ kind: "snapshot" })),
    });

    await expect(sync.fetch()).resolves.toBe(false);
    expect(emitRecoveryEvent).toHaveBeenCalledWith(
      "invalid-message",
      "A room snapshot was ignored because it was not a valid envelope.",
    );
  });
});
