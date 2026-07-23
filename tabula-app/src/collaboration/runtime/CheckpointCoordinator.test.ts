import { describe, expect, it, vi } from "vitest";
import {
  createWorkspaceRoomCrdt,
  initializeWorkspaceRoomCrdt,
  ROOM_CHECKPOINT_MAX_SAVE_DELAY_MS,
  ROOM_CHECKPOINT_QUIET_SAVE_DELAY_MS,
} from "@tabula-md/tabula";
import { importRoomKey } from "../collabRoom";
import type { CollabRuntimeAdapters } from "../collabRuntimeAdapters";
import type { RoomCheckpointStore } from "../roomCheckpointStore";
import { createCheckpointCoordinator } from "./CheckpointCoordinator";

const VALID_ROOM_KEY = "A".repeat(43);

const createManualClock = () => {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { callback: () => void; dueAt: number }>();
  const clock: Pick<CollabRuntimeAdapters["clock"], "clearTimeout" | "setTimeout"> = {
    clearTimeout(handle) {
      timers.delete(handle as number);
    },
    setTimeout(callback, delayMs) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { callback, dueAt: now + delayMs });
      return id;
    },
  };
  const advanceBy = (durationMs: number) => {
    const target = now + durationMs;
    while (true) {
      const next = [...timers.entries()]
        .filter(([, timer]) => timer.dueAt <= target)
        .sort((left, right) => left[1].dueAt - right[1].dueAt || left[0] - right[0])[0];
      if (!next) break;
      const [id, timer] = next;
      timers.delete(id);
      now = timer.dueAt;
      timer.callback();
    }
    now = target;
  };
  return { advanceBy, clock };
};

const createFixture = async () => {
  const room = createWorkspaceRoomCrdt({ roomId: "checkpoint-room" });
  initializeWorkspaceRoomCrdt(room, {
    nodes: [{ id: "doc", type: "document", title: "README.md", markdown: "start" }],
  });
  let generation = 0;
  const saveEncryptedCheckpoint = vi.fn<RoomCheckpointStore["saveEncryptedCheckpoint"]>(
    async () => {
      generation += 1;
      return { ok: true, generation };
    },
  );
  const store: RoomCheckpointStore = {
    enabled: true,
    loadEncryptedCheckpoint: async () => null,
    saveEncryptedCheckpoint,
  };
  const { advanceBy, clock } = createManualClock();
  const abortController = new AbortController();
  const coordinator = createCheckpointCoordinator({
    room,
    roomId: "checkpoint-room",
    store,
    clock,
    signal: abortController.signal,
    isClosed: () => false,
    isLeader: () => true,
    isWithinLimits: () => true,
    onCapacityExceeded: vi.fn(),
    onDurabilityChange: vi.fn(),
    onSaveError: vi.fn(),
  });
  await coordinator.load(await importRoomKey(VALID_ROOM_KEY), true);
  await coordinator.saveNow();
  saveEncryptedCheckpoint.mockClear();
  return {
    advanceBy,
    coordinator,
    edit() {
      room.documents.get("doc")?.insert(0, "x");
      coordinator.handleDocumentUpdate(null);
    },
    room,
    saveEncryptedCheckpoint,
  };
};

describe("CheckpointCoordinator", () => {
  it("saves after the room has been quiet for five seconds", async () => {
    const fixture = await createFixture();
    fixture.edit();

    fixture.advanceBy(ROOM_CHECKPOINT_QUIET_SAVE_DELAY_MS - 1);
    expect(fixture.saveEncryptedCheckpoint).not.toHaveBeenCalled();

    fixture.advanceBy(1);
    await vi.waitFor(() => expect(fixture.saveEncryptedCheckpoint).toHaveBeenCalledTimes(1));

    fixture.coordinator.dispose();
    fixture.room.doc.destroy();
  });

  it("bounds continuous editing to a twenty-second checkpoint delay", async () => {
    const fixture = await createFixture();
    fixture.edit();

    for (let elapsed = 4_000; elapsed < ROOM_CHECKPOINT_MAX_SAVE_DELAY_MS; elapsed += 4_000) {
      fixture.advanceBy(4_000);
      fixture.edit();
    }
    expect(fixture.saveEncryptedCheckpoint).not.toHaveBeenCalled();

    fixture.advanceBy(4_000);
    await vi.waitFor(() => expect(fixture.saveEncryptedCheckpoint).toHaveBeenCalledTimes(1));

    fixture.coordinator.dispose();
    fixture.room.doc.destroy();
  });
});
