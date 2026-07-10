import * as Y from "yjs";
import { describe, expect, it, vi } from "vitest";
import {
  decryptEnvelopeForRoom,
  encryptBytesForRoom,
  generateRoomKey,
  importRoomKey,
} from ".";
import {
  createRoomActor,
  createWorkspaceRoomState,
  encodeBase64Url,
  encodeRoomEvent,
  type RoomEvent,
} from "@tabula-md/tabula";
import { createCollaboratorRegistry } from "./collabCollaborators";
import { createCollabEnvelopeRouter } from "./collabEnvelopeRouter";
import { createCollabTextDocument } from "./collabTextModel";
import { createYjsCollabTextAdapter } from "./collabYjsTextAdapter";

const textAdapter = createYjsCollabTextAdapter();

const writer = createRoomActor({
  id: "writer",
  kind: "agent",
  name: "Writer",
  client: "tabula-mcp",
  capabilities: ["presence", "read", "write"],
  joinedAt: "2026-07-09T00:00:00.000Z",
});

const reader = createRoomActor({
  id: "reader",
  kind: "agent",
  name: "Reader",
  client: "tabula-mcp",
  capabilities: ["presence", "read"],
  joinedAt: "2026-07-09T00:00:00.000Z",
});

const encryptRoomEvent = async (event: RoomEvent, version = 1) => {
  const roomKey = await importRoomKey(generateRoomKey());
  const envelope = await encryptBytesForRoom(roomKey, "room-1", "room-event", version, encodeRoomEvent(event));
  return {
    envelope,
    decryptEnvelope: (nextEnvelope: typeof envelope) => decryptEnvelopeForRoom(roomKey, nextEnvelope),
  };
};

const createRouter = (overrides: Partial<Parameters<typeof createCollabEnvelopeRouter>[0]> = {}) => {
  const textDocuments = new Map<string, ReturnType<typeof createCollabTextDocument>>();
  const defaultDocument = createCollabTextDocument();
  textDocuments.set("doc-1", defaultDocument);
  return {
    defaultDocument,
    textDocuments,
    router: createCollabEnvelopeRouter({
      roomId: "room-1",
      textAdapter,
      collaborators: createCollaboratorRegistry(),
      canDecrypt: () => true,
      getTextDocumentForDocumentId: (documentId) => textDocuments.get(documentId),
      getSelfId: () => "self",
      decryptEnvelope: vi.fn(),
      onTextChange: vi.fn(),
      publishCollaborators: vi.fn(),
      emitRecoveryEvent: vi.fn(),
      ...overrides,
    }),
  };
};

describe("collaboration envelope router", () => {
  it("ignores messages while decryption is unavailable", async () => {
    const emitRecoveryEvent = vi.fn();
    const { router } = createRouter({
      canDecrypt: () => false,
      emitRecoveryEvent,
    });

    await router.route({ kind: "presence" });

    expect(emitRecoveryEvent).not.toHaveBeenCalled();
  });

  it("reports invalid envelopes", async () => {
    const emitRecoveryEvent = vi.fn();
    const { router } = createRouter({ emitRecoveryEvent });

    await router.route({ kind: "presence" });

    expect(emitRecoveryEvent).toHaveBeenCalledWith("invalid-message", "A collaboration server message was ignored.");
  });

  it("publishes remote actor presence while ignoring self presence", async () => {
    const roomKey = await importRoomKey(generateRoomKey());
    const collaborators = createCollaboratorRegistry();
    const publishCollaborators = vi.fn();
    const remoteActor = createRoomActor({
      id: "remote",
      name: "Ada",
      color: "#763fc8",
      joinedAt: "2026-07-09T00:00:00.000Z",
    });
    const remotePresence = await encryptBytesForRoom(roomKey, "room-1", "room-event", 1, encodeRoomEvent({
      id: "event-1",
      roomId: "room-1",
      actorId: remoteActor.id,
      type: "presence.updated",
      createdAt: "2026-07-09T00:00:00.000Z",
      actor: remoteActor,
      presence: {
        actorId: remoteActor.id,
        activeDocumentId: "doc-1",
        lastSeen: 1,
      },
      fileTitle: "README",
    }));
    const selfActor = createRoomActor({
      id: "self",
      name: "Taeha",
      color: "#111",
      joinedAt: "2026-07-09T00:00:00.000Z",
    });
    const selfPresence = await encryptBytesForRoom(roomKey, "room-1", "room-event", 2, encodeRoomEvent({
      id: "event-2",
      roomId: "room-1",
      actorId: selfActor.id,
      type: "presence.updated",
      createdAt: "2026-07-09T00:00:00.000Z",
      actor: selfActor,
      presence: {
        actorId: selfActor.id,
        activeDocumentId: "doc-1",
        lastSeen: 1,
      },
      fileTitle: "README",
    }));
    const { router } = createRouter({
      collaborators,
      decryptEnvelope: (envelope) => decryptEnvelopeForRoom(roomKey, envelope),
      publishCollaborators,
    });

    await router.route(remotePresence);
    await router.route(selfPresence);

    expect(collaborators.list()).toEqual([
      expect.objectContaining({ id: "remote", name: "Ada", fileTitle: "README", activeDocumentId: "doc-1" }),
    ]);
    expect(publishCollaborators).toHaveBeenCalledTimes(1);
  });

  it("applies room-event text updates from write-capable actors", async () => {
    const source = new Y.Doc();
    source.getText("markdown").insert(0, "room event");
    const { envelope, decryptEnvelope } = await encryptRoomEvent({
      id: "event-1",
      roomId: "room-1",
      actorId: writer.id,
      type: "text.updated",
      createdAt: "2026-07-09T00:00:00.000Z",
      actor: writer,
      documentId: "doc-1",
      update: encodeBase64Url(Y.encodeStateAsUpdate(source)),
    });
    const onRoomEvent = vi.fn();
    const onTextChange = vi.fn();
    const { defaultDocument, router } = createRouter({
      decryptEnvelope,
      onTextChange,
      onRoomEvent,
    });

    await router.route(envelope);

    expect(defaultDocument.text.toString()).toBe("room event");
    expect(onTextChange).toHaveBeenCalledWith(
      "room event",
      { patches: [{ from: 0, to: 0, insert: "room event" }] },
      "doc-1",
    );
    expect(onRoomEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "text.updated", documentId: "doc-1" }));
  });

  it("ignores room-event text updates from actors without write capability", async () => {
    const source = new Y.Doc();
    source.getText("markdown").insert(0, "blocked");
    const { envelope, decryptEnvelope } = await encryptRoomEvent({
      id: "event-1",
      roomId: "room-1",
      actorId: reader.id,
      type: "text.updated",
      createdAt: "2026-07-09T00:00:00.000Z",
      actor: reader,
      documentId: "doc-1",
      update: encodeBase64Url(Y.encodeStateAsUpdate(source)),
    });
    const onTextChange = vi.fn();
    const { defaultDocument, router } = createRouter({
      decryptEnvelope,
      onTextChange,
    });

    await router.route(envelope);

    expect(defaultDocument.text.toString()).toBe("");
    expect(onTextChange).not.toHaveBeenCalled();
  });

  it("routes write-capable agent workspace updates through the shared room event path", async () => {
    const workspace = await createWorkspaceRoomState({
      roomId: "room-1",
      activeDocumentId: "doc-2",
      documents: [
        { id: "doc-1", title: "README.md", markdown: "# Readme" },
        { id: "doc-2", title: "Agent Plan.md", markdown: "Plan" },
      ],
      nowIso: () => "2026-07-09T00:00:00.000Z",
    });
    const { envelope, decryptEnvelope } = await encryptRoomEvent({
      id: "event-1",
      roomId: "room-1",
      actorId: writer.id,
      type: "workspace.updated",
      createdAt: "2026-07-09T00:00:00.000Z",
      actor: writer,
      workspace,
    });
    const onRoomEvent = vi.fn();
    const { router } = createRouter({
      decryptEnvelope,
      onRoomEvent,
    });

    await router.route(envelope);

    expect(onRoomEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "workspace.updated",
      actor: expect.objectContaining({ kind: "agent", client: "tabula-mcp" }),
      workspace,
    }));
  });

  it("routes workspace updates from another socket even when the actor id matches this browser profile", async () => {
    const selfActor = createRoomActor({
      id: "self",
      name: "Taeha",
      color: "#763fc8",
      joinedAt: "2026-07-09T00:00:00.000Z",
    });
    const workspace = await createWorkspaceRoomState({
      roomId: "room-1",
      activeDocumentId: "doc-1",
      documents: [{ id: "doc-1", title: "README.md", markdown: "# Readme" }],
      nowIso: () => "2026-07-09T00:00:00.000Z",
    });
    const { envelope, decryptEnvelope } = await encryptRoomEvent({
      id: "event-1",
      roomId: "room-1",
      actorId: selfActor.id,
      type: "workspace.updated",
      createdAt: "2026-07-09T00:00:00.000Z",
      actor: selfActor,
      workspace,
    });
    const onRoomEvent = vi.fn();
    const { router } = createRouter({
      decryptEnvelope,
      onRoomEvent,
    });

    await router.route(envelope);

    expect(onRoomEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "workspace.updated",
      actor: expect.objectContaining({ id: "self" }),
      workspace,
    }));
  });

  it("ignores workspace updates from actors without write capability", async () => {
    const workspace = await createWorkspaceRoomState({
      roomId: "room-1",
      activeDocumentId: "doc-1",
      documents: [{ id: "doc-1", title: "README.md", markdown: "# Readme" }],
      nowIso: () => "2026-07-09T00:00:00.000Z",
    });
    const { envelope, decryptEnvelope } = await encryptRoomEvent({
      id: "event-1",
      roomId: "room-1",
      actorId: reader.id,
      type: "workspace.updated",
      createdAt: "2026-07-09T00:00:00.000Z",
      actor: reader,
      workspace,
    });
    const onRoomEvent = vi.fn();
    const { router } = createRouter({
      decryptEnvelope,
      onRoomEvent,
    });

    await router.route(envelope);

    expect(onRoomEvent).not.toHaveBeenCalled();
  });

  it("routes document-scoped text.updated events to inactive workspace documents", async () => {
    const source = new Y.Doc();
    source.getText("markdown").insert(0, "other doc");
    const { envelope, decryptEnvelope } = await encryptRoomEvent({
      id: "event-1",
      roomId: "room-1",
      actorId: writer.id,
      type: "text.updated",
      documentId: "doc-other",
      actor: writer,
      createdAt: "2026-07-09T00:00:00.000Z",
      update: encodeBase64Url(Y.encodeStateAsUpdate(source)),
    });
    const otherDocument = createCollabTextDocument();
    const onTextChange = vi.fn();
    const { defaultDocument, router } = createRouter({
      decryptEnvelope,
      getTextDocumentForDocumentId: (documentId) => (documentId === "doc-other" ? otherDocument : defaultDocument),
      onTextChange,
    });

    await router.route(envelope);

    expect(defaultDocument.text.toString()).toBe("");
    expect(otherDocument.text.toString()).toBe("other doc");
    expect(onTextChange).toHaveBeenCalledWith(
      "other doc",
      { patches: [{ from: 0, to: 0, insert: "other doc" }] },
      "doc-other",
    );
  });

  it("routes text updates from another socket even when the actor id matches this browser profile", async () => {
    const source = new Y.Doc();
    source.getText("markdown").insert(0, "same profile tab");
    const selfActor = createRoomActor({
      id: "self",
      name: "Taeha",
      color: "#763fc8",
      joinedAt: "2026-07-09T00:00:00.000Z",
    });
    const { envelope, decryptEnvelope } = await encryptRoomEvent({
      id: "event-1",
      roomId: "room-1",
      actorId: selfActor.id,
      type: "text.updated",
      documentId: "doc-1",
      actor: selfActor,
      createdAt: "2026-07-09T00:00:00.000Z",
      update: encodeBase64Url(Y.encodeStateAsUpdate(source)),
    });
    const onTextChange = vi.fn();
    const { defaultDocument, router } = createRouter({
      decryptEnvelope,
      onTextChange,
    });

    await router.route(envelope);

    expect(defaultDocument.text.toString()).toBe("same profile tab");
    expect(onTextChange).toHaveBeenCalledWith(
      "same profile tab",
      { patches: [{ from: 0, to: 0, insert: "same profile tab" }] },
      "doc-1",
    );
  });

  it("ignores unknown room-event types without recovery noise", async () => {
    const roomKey = await importRoomKey(generateRoomKey());
    const onRoomEvent = vi.fn();
    const emitRecoveryEvent = vi.fn();
    const unknownEnvelope = await encryptBytesForRoom(
      roomKey,
      "room-1",
      "room-event",
      1,
      new TextEncoder().encode(JSON.stringify({
        id: "event-2",
        roomId: "room-1",
        actorId: "agent-1",
        type: "future.event",
        createdAt: "2026-07-09T00:00:00.000Z",
      })),
    );
    const { router } = createRouter({
      decryptEnvelope: (envelope) => decryptEnvelopeForRoom(roomKey, envelope),
      onRoomEvent,
      emitRecoveryEvent,
    });

    await router.route(unknownEnvelope);

    expect(onRoomEvent).not.toHaveBeenCalled();
    expect(emitRecoveryEvent).not.toHaveBeenCalled();
  });

  it("reports malformed room-event payloads as invalid messages", async () => {
    const roomKey = await importRoomKey(generateRoomKey());
    const emitRecoveryEvent = vi.fn();
    const envelope = await encryptBytesForRoom(
      roomKey,
      "room-1",
      "room-event",
      1,
      new TextEncoder().encode("{malformed"),
    );
    const { router } = createRouter({
      decryptEnvelope: (nextEnvelope) => decryptEnvelopeForRoom(roomKey, nextEnvelope),
      emitRecoveryEvent,
    });

    await router.route(envelope);

    expect(emitRecoveryEvent).toHaveBeenCalledWith("invalid-message", "A collaboration room event was ignored.");
  });
});
