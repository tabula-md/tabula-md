import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { generateEncryptionKey } from "@tabula-md/tabula";
import { decryptWorkspaceRoomCheckpoint, encryptWorkspaceRoomCheckpoint } from "./roomCheckpointStore";

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
});
