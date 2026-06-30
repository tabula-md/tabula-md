import * as Y from "yjs";
import { describe, expect, it, vi } from "vitest";
import {
  decryptEnvelopeForRoom,
  encryptBytesForRoom,
  generateRoomKey,
  importRoomKey,
} from "./collabRoom";
import { createCollaboratorRegistry } from "./collabCollaborators";
import { encodePresenceForRoom } from "./collabConnectionModel";
import { createCollabEnvelopeRouter } from "./collabEnvelopeRouter";
import { createCollabTextDocument } from "./collabTextModel";

describe("collaboration envelope router", () => {
  it("ignores messages while decryption is unavailable", async () => {
    const emitRecoveryEvent = vi.fn();
    const router = createCollabEnvelopeRouter({
      roomId: "room-1",
      textDocument: createCollabTextDocument(),
      collaborators: createCollaboratorRegistry(),
      canDecrypt: () => false,
      getSelfId: () => "self",
      decryptEnvelope: vi.fn(),
      onTextChange: vi.fn(),
      publishCollaborators: vi.fn(),
      emitRecoveryEvent,
    });

    await router.route({ kind: "presence" });

    expect(emitRecoveryEvent).not.toHaveBeenCalled();
  });

  it("reports invalid envelopes", async () => {
    const emitRecoveryEvent = vi.fn();
    const router = createCollabEnvelopeRouter({
      roomId: "room-1",
      textDocument: createCollabTextDocument(),
      collaborators: createCollaboratorRegistry(),
      canDecrypt: () => true,
      getSelfId: () => "self",
      decryptEnvelope: vi.fn(),
      onTextChange: vi.fn(),
      publishCollaborators: vi.fn(),
      emitRecoveryEvent,
    });

    await router.route({ kind: "presence" });

    expect(emitRecoveryEvent).toHaveBeenCalledWith("invalid-message", "A collaboration server message was ignored.");
  });

  it("applies encrypted Yjs updates to the text document", async () => {
    const roomKey = await importRoomKey(generateRoomKey());
    const textDocument = createCollabTextDocument();
    const source = new Y.Doc();
    source.getText("markdown").insert(0, "remote");
    const envelope = await encryptBytesForRoom(roomKey, "room-1", "yjs-update", 1, Y.encodeStateAsUpdate(source));
    const onTextChange = vi.fn();
    const router = createCollabEnvelopeRouter({
      roomId: "room-1",
      textDocument,
      collaborators: createCollaboratorRegistry(),
      canDecrypt: () => true,
      getSelfId: () => "self",
      decryptEnvelope: (nextEnvelope) => decryptEnvelopeForRoom(roomKey, nextEnvelope),
      onTextChange,
      publishCollaborators: vi.fn(),
      emitRecoveryEvent: vi.fn(),
    });

    await router.route(envelope);

    expect(textDocument.text.toString()).toBe("remote");
    expect(onTextChange).toHaveBeenCalledWith("remote", { patches: [{ from: 0, to: 0, insert: "remote" }] });
  });

  it("publishes remote presence while ignoring self presence", async () => {
    const roomKey = await importRoomKey(generateRoomKey());
    const collaborators = createCollaboratorRegistry();
    const publishCollaborators = vi.fn();
    const remotePresence = await encryptBytesForRoom(
      roomKey,
      "room-1",
      "presence",
      1,
      encodePresenceForRoom({
        identity: { id: "remote", name: "Ada", color: "#763fc8", lastSeen: 1 },
        roomId: "room-1",
        fileTitle: "README",
      }),
    );
    const selfPresence = await encryptBytesForRoom(
      roomKey,
      "room-1",
      "presence",
      2,
      encodePresenceForRoom({
        identity: { id: "self", name: "Taeha", color: "#111", lastSeen: 1 },
        roomId: "room-1",
        fileTitle: "README",
      }),
    );
    const router = createCollabEnvelopeRouter({
      roomId: "room-1",
      textDocument: createCollabTextDocument(),
      collaborators,
      canDecrypt: () => true,
      getSelfId: () => "self",
      decryptEnvelope: (envelope) => decryptEnvelopeForRoom(roomKey, envelope),
      onTextChange: vi.fn(),
      publishCollaborators,
      emitRecoveryEvent: vi.fn(),
    });

    await router.route(remotePresence);
    await router.route(selfPresence);

    expect(collaborators.list()).toEqual([
      expect.objectContaining({ id: "remote", name: "Ada", fileTitle: "README" }),
    ]);
    expect(publishCollaborators).toHaveBeenCalledTimes(1);
  });
});
