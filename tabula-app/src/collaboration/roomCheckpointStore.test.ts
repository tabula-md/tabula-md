import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  createWorkspaceRoomCrdt,
  generateEncryptionKey,
  getWorkspaceRoomSnapshot,
} from "@tabula-md/tabula";
import {
  createNoopRoomCheckpointStore,
  decryptWorkspaceRoomCheckpoint,
  encryptWorkspaceRoomCheckpoint,
  persistInitialWorkspaceRoomCheckpoint,
  type RoomCheckpointStore,
} from "./roomCheckpointStore";

describe("room checkpoint crypto", () => {
  it("encrypts a room-bound Yjs state update without plaintext", async () => {
    const roomKey = generateEncryptionKey();
    const doc = new Y.Doc();
    doc.getText("markdown").insert(0, "# Secret markdown");
    const update = Y.encodeStateAsUpdate(doc);
    const encryptedCheckpoint = await encryptWorkspaceRoomCheckpoint({ roomId: "room-1", update, roomKey });

    expect(new TextDecoder().decode(encryptedCheckpoint)).not.toContain("Secret markdown");
    await expect(decryptWorkspaceRoomCheckpoint({ encryptedCheckpoint, roomId: "room-1", roomKey })).resolves.toEqual(update);
    await expect(decryptWorkspaceRoomCheckpoint({ encryptedCheckpoint, roomId: "room-2", roomKey })).rejects.toThrow();
  });

  it("does not expose room keys or local paths in checkpoint ciphertext", async () => {
    const roomKey = generateEncryptionKey();
    const doc = new Y.Doc();
    const localPath = "/Users/example/private/launch-plan.md";
    doc.getText("markdown").insert(0, `${localPath}\nConfidential launch plan`);

    const encryptedCheckpoint = await encryptWorkspaceRoomCheckpoint({
      roomId: "room-security-boundary",
      update: Y.encodeStateAsUpdate(doc),
      roomKey,
    });
    const serialized = new TextDecoder().decode(encryptedCheckpoint);

    expect(serialized).not.toContain(localPath);
    expect(serialized).not.toContain("Confidential launch plan");
    expect(serialized).not.toContain(roomKey);
    doc.destroy();
  });

  it("persists a complete encrypted workspace before a live session starts", async () => {
    const roomKey = generateEncryptionKey();
    const saveEncryptedCheckpoint = vi.fn<RoomCheckpointStore["saveEncryptedCheckpoint"]>()
      .mockResolvedValue({ ok: true, generation: 1 });
    const store: RoomCheckpointStore = {
      enabled: true,
      loadEncryptedCheckpoint: vi.fn(async () => null),
      saveEncryptedCheckpoint,
    };

    await persistInitialWorkspaceRoomCheckpoint({
      roomId: "room-initial",
      roomKey,
      folders: [{ id: "notes", title: "Notes", parentId: "workspace-root" }],
      documents: [
        { id: "readme", title: "README.md", text: "# Secret", parentId: "workspace-root" },
        { id: "draft", title: "Draft.md", text: "Draft", parentId: "notes" },
      ],
      commentsByFileId: {
        readme: [{
          id: "comment-1",
          fileId: "readme",
          body: "Review this",
          resolved: false,
          createdAt: "2026-07-11T00:00:00.000Z",
          replies: [],
        }],
      },
    }, store);

    expect(saveEncryptedCheckpoint).toHaveBeenCalledTimes(1);
    const request = saveEncryptedCheckpoint.mock.calls[0]![1];
    expect(request.expectedGeneration).toBe(0);
    expect(new TextDecoder().decode(request.encryptedCheckpoint)).not.toContain("Secret");

    const update = await decryptWorkspaceRoomCheckpoint({
      encryptedCheckpoint: request.encryptedCheckpoint,
      roomId: "room-initial",
      roomKey,
    });
    const restoredDoc = new Y.Doc();
    const restoredRoom = createWorkspaceRoomCrdt({
      roomId: "room-initial",
      doc: restoredDoc,
      initialize: false,
    });
    Y.applyUpdate(restoredDoc, update);
    expect(getWorkspaceRoomSnapshot(restoredRoom)).toMatchObject({
      documents: { readme: "# Secret", draft: "Draft" },
      commentsByFileId: { readme: [{ body: "Review this" }] },
    });
    restoredDoc.destroy();
  });

  it("does not report an unsaved live room as successfully created", async () => {
    await expect(persistInitialWorkspaceRoomCheckpoint({
      roomId: "room-disabled",
      roomKey: generateEncryptionKey(),
      folders: [],
      documents: [{ id: "readme", title: "README.md", text: "# Local" }],
    }, createNoopRoomCheckpointStore())).rejects.toThrow("persistence is unavailable");
  });
});
