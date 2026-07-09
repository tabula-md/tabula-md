import { describe, expect, it } from "vitest";
import {
  createWorkspaceRoomCheckpoint,
  generateEncryptionKey,
} from "@tabula-md/tabula";
import {
  decryptWorkspaceRoomCheckpoint,
  encryptWorkspaceRoomCheckpoint,
} from "./roomCheckpointStore";

describe("room checkpoint store", () => {
  it("encrypts workspace room checkpoints with the room key and room-bound AAD", async () => {
    const roomKey = generateEncryptionKey();
    const checkpoint = await createWorkspaceRoomCheckpoint({
      roomId: "room-1",
      activeDocumentId: "doc-1",
      nowIso: () => "2026-07-09T00:00:00.000Z",
      documents: [
        {
          id: "doc-1",
          title: "README.md",
          markdown: "# Secret markdown",
          parentId: null,
        },
      ],
    });

    const encryptedCheckpoint = await encryptWorkspaceRoomCheckpoint({
      checkpoint,
      roomKey,
    });

    expect(new TextDecoder().decode(encryptedCheckpoint)).not.toContain("Secret markdown");
    await expect(decryptWorkspaceRoomCheckpoint({
      encryptedCheckpoint,
      roomId: "room-1",
      roomKey,
    })).resolves.toEqual(checkpoint);
    await expect(decryptWorkspaceRoomCheckpoint({
      encryptedCheckpoint,
      roomId: "room-2",
      roomKey,
    })).rejects.toThrow();
  });

});
