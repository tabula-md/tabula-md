import * as Y from "yjs";
import { describe, expect, it, vi } from "vitest";
import { collabSnapshotStoreDelayMs, createCollabSnapshotSync } from "./collabSnapshotSync";
import { createCollabTextDocument } from "./collabTextModel";
import { createYjsCollabTextAdapter } from "./collabYjsTextAdapter";
import type { RoomRecoveryStore } from "./collabRuntimeAdapters";

const textAdapter = createYjsCollabTextAdapter();

describe("collaboration snapshot sync", () => {
  it("returns missing when Firebase recovery has no room state", async () => {
    const recoveryStore: RoomRecoveryStore = {
      load: vi.fn(async () => null),
      save: vi.fn(),
    };
    const sync = createCollabSnapshotSync({
      roomId: "room-1",
      roomKey: "room-key",
      textAdapter,
      textDocument: createCollabTextDocument(),
      canUseSnapshots: () => true,
      recoveryStore,
      mergeStates: textAdapter.mergeUpdates,
      onTextChange: vi.fn(),
      emitRecoveryEvent: vi.fn(),
    });

    await expect(sync.fetch()).resolves.toBe("missing");
    expect(recoveryStore.load).toHaveBeenCalledWith("room-1", "room-key");
  });

  it("restores encrypted recovery state into the Yjs text document", async () => {
    const textDocument = createCollabTextDocument();
    const remoteDoc = new Y.Doc();
    remoteDoc.getText("markdown").insert(0, "restored");
    const onTextChange = vi.fn();
    const emitRecoveryEvent = vi.fn();
    const recoveryStore: RoomRecoveryStore = {
      load: vi.fn(async () => Y.encodeStateAsUpdate(remoteDoc)),
      save: vi.fn(),
    };
    const sync = createCollabSnapshotSync({
      roomId: "room-1",
      roomKey: "room-key",
      textAdapter,
      textDocument,
      canUseSnapshots: () => true,
      recoveryStore,
      mergeStates: textAdapter.mergeUpdates,
      onTextChange,
      emitRecoveryEvent,
    });

    await expect(sync.fetch()).resolves.toBe("restored");
    expect(textDocument.text.toString()).toBe("restored");
    expect(onTextChange).toHaveBeenCalledWith("restored", { patches: [{ from: 0, to: 0, insert: "restored" }] });
    expect(emitRecoveryEvent).toHaveBeenCalledWith("snapshot-recovered", "Encrypted room recovery state restored.");
  });

  it("stores recovery state and marks local changes as stored", async () => {
    const textDocument = createCollabTextDocument("local");
    const onRoomMetaChange = vi.fn();
    const onSnapshotStored = vi.fn();
    const recoveryStore: RoomRecoveryStore = {
      load: vi.fn(),
      save: vi.fn(async () => ({ version: 2 })),
    };
    const sync = createCollabSnapshotSync({
      roomId: "room-1",
      roomKey: "room-key",
      textAdapter,
      textDocument,
      canUseSnapshots: () => true,
      recoveryStore,
      mergeStates: textAdapter.mergeUpdates,
      onTextChange: vi.fn(),
      onRoomMetaChange,
      onSnapshotStored,
      emitRecoveryEvent: vi.fn(),
    });

    await expect(sync.store()).resolves.toBe(true);
    expect(recoveryStore.save).toHaveBeenCalledWith({
      roomId: "room-1",
      roomKey: "room-key",
      state: expect.any(Uint8Array),
      mergeStates: textAdapter.mergeUpdates,
    });
    expect(onSnapshotStored).toHaveBeenCalledTimes(1);
    expect(onRoomMetaChange).toHaveBeenCalledWith(expect.objectContaining({ roomId: "room-1", version: 2 }));
  });

  it("keeps collaboration running when recovery decrypt fails", async () => {
    const emitRecoveryEvent = vi.fn();
    const recoveryStore: RoomRecoveryStore = {
      load: vi.fn(async () => {
        throw new Error("bad key");
      }),
      save: vi.fn(),
    };
    const sync = createCollabSnapshotSync({
      roomId: "room-1",
      roomKey: "room-key",
      textAdapter,
      textDocument: createCollabTextDocument(),
      canUseSnapshots: () => true,
      recoveryStore,
      mergeStates: textAdapter.mergeUpdates,
      onTextChange: vi.fn(),
      emitRecoveryEvent,
    });

    await expect(sync.fetch()).resolves.toBe("unavailable");
    expect(emitRecoveryEvent).toHaveBeenCalledWith(
      "invalid-message",
      "The encrypted room recovery state could not be decrypted.",
    );
  });

  it("uses a production-safe debounce before storing recovery state", () => {
    const textDocument = createCollabTextDocument("local");
    const setTimeoutFn = vi.fn(() => "timer-1");
    const clearTimeoutFn = vi.fn();
    const recoveryStore: RoomRecoveryStore = {
      load: vi.fn(),
      save: vi.fn(),
    };
    const sync = createCollabSnapshotSync({
      roomId: "room-1",
      roomKey: "room-key",
      textAdapter,
      textDocument,
      canUseSnapshots: () => true,
      recoveryStore,
      mergeStates: textAdapter.mergeUpdates,
      onTextChange: vi.fn(),
      emitRecoveryEvent: vi.fn(),
      setTimeoutFn,
      clearTimeoutFn,
    });

    sync.scheduleStore();

    expect(setTimeoutFn).toHaveBeenCalledWith(expect.any(Function), collabSnapshotStoreDelayMs);
  });
});
