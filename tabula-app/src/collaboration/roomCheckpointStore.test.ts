import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  createWorkspaceRoomCrdt,
  generateEncryptionKey,
  getWorkspaceRoomSnapshot,
} from "@tabula-md/tabula";
import {
  decryptWorkspaceRoomCheckpoint,
  encryptWorkspaceRoomCheckpoint,
} from "./roomCheckpointStore";
import { createInitialWorkspaceRoomBootstrap } from "./roomCheckpointCrdt";

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

  it("creates a complete unsaved workspace bootstrap before the live room connects", () => {
    const bootstrap = createInitialWorkspaceRoomBootstrap({
      roomId: "room-initial",
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
    });

    expect(bootstrap.generation).toBe(0);
    const restoredDoc = new Y.Doc();
    const restoredRoom = createWorkspaceRoomCrdt({
      roomId: "room-initial",
      doc: restoredDoc,
      initialize: false,
    });
    Y.applyUpdate(restoredDoc, bootstrap.checkpointUpdate);
    expect(getWorkspaceRoomSnapshot(restoredRoom)).toMatchObject({
      documents: { readme: "# Secret", draft: "Draft" },
      commentsByFileId: { readme: [{ body: "Review this" }] },
    });
    restoredDoc.destroy();
  });
});
