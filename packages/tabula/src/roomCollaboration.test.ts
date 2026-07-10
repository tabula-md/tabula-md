import { describe, expect, it } from "vitest";
import { encodeBase64Url } from "./data/base64Url";
import {
  createRoomActor,
  createRoomActorColor,
  createRoomActorName,
  createWorkspaceRoomCheckpoint,
  createWorkspaceRoomState,
  decodeWorkspaceRoomCheckpoint,
  decodeRoomEvent,
  encodeWorkspaceRoomCheckpoint,
  encodeRoomEvent,
  hashMarkdownText,
  MARKDOWN_TEXT_HASH_ALGORITHM,
  parseRoomActor,
  parseRoomEvent,
  parseWorkspaceRoomCheckpoint,
  type RoomEvent,
} from "./roomCollaboration";

const actor = createRoomActor({
  id: "peer-1",
  kind: "human",
  name: "Ada",
  color: "#763fc8",
  client: "tabula-md",
  capabilities: ["presence", "read", "comment", "write", "create", "delete", "move"],
  joinedAt: "2026-07-09T00:00:00.000Z",
});

describe("room collaboration contract", () => {
  it("creates local human and agent actors with product defaults", () => {
    expect(createRoomActor({ id: "human-1", name: "Ada" })).toEqual({
      id: "human-1",
      kind: "human",
      name: "Ada",
      color: createRoomActorColor("human-1"),
      client: "tabula-md",
      capabilities: ["presence", "read", "comment", "write", "create", "delete", "move"],
      joinedAt: "1970-01-01T00:00:00.000Z",
    });
    expect(createRoomActor({ id: "agent-1", kind: "agent", name: "Local Agent" })).toEqual({
      id: "agent-1",
      kind: "agent",
      name: "Local Agent",
      color: createRoomActorColor("agent-1"),
      client: "tabula-mcp",
      capabilities: ["presence", "read", "comment", "write", "create", "delete", "move"],
      joinedAt: "1970-01-01T00:00:00.000Z",
    });
    expect(createRoomActor({ id: "human-1" }).name).toBe(createRoomActorName("human", "human-1"));
    expect(createRoomActor({ id: "agent-1", kind: "agent" }).name).toBe(createRoomActorName("agent", "agent-1"));
    expect(createRoomActor({ id: "agent-1", kind: "agent" }).name).toMatch(/ Agent$/);
    expect(createRoomActor({ id: "human-1" }).name).toMatch(/ Human$/);
    expect(createRoomActorColor("human-1")).toBe(createRoomActorColor("human-1"));
  });

  it("parses only explicit room actors from the wire contract", () => {
    expect(parseRoomActor(actor)).toEqual(actor);
    expect(parseRoomActor({ ...actor, color: undefined })).toEqual({
      ...actor,
      color: createRoomActorColor(actor.id),
    });
    expect(parseRoomActor({ id: "peer-1" })).toBeNull();
    expect(parseRoomActor({ id: "agent-1", type: "agent", displayName: "MCP", client: "tabula-mcp" })).toBeNull();
  });

  it("validates room-event payloads and safely ignores unknown event types", () => {
    const update = encodeBase64Url(new Uint8Array([1, 2, 3]));
    const event: RoomEvent = {
      id: "event-1",
      roomId: "room-1",
      actorId: actor.id,
      type: "text.updated",
      createdAt: "2026-07-09T00:00:00.000Z",
      actor,
      documentId: "doc-1",
      update,
    };

    expect(decodeRoomEvent(encodeRoomEvent(event))).toEqual({ ok: true, event });
    expect(parseRoomEvent({ ...event, type: "unknown.event" })).toEqual({
      ok: false,
      reason: "unknown",
    });
    expect(parseRoomEvent({ ...event, update: "not=base64url" })).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(parseRoomEvent({ ...event, actor: { id: actor.id } })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("hashes markdown text with deterministic SHA-256 hex output", async () => {
    expect(MARKDOWN_TEXT_HASH_ALGORITHM).toBe("sha256-hex");
    await expect(hashMarkdownText("hello")).resolves.toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("creates deterministic workspace room state metadata without markdown plaintext", async () => {
    await expect(createWorkspaceRoomState({
      roomId: "room-1",
      activeDocumentId: "doc-1",
      nowIso: () => "2026-07-09T00:00:00.000Z",
      hashText: async (text) => `hash:${text.length}`,
      documents: [
        { id: "doc-1", title: "README.md", markdown: "# Readme" },
        { id: "doc-2", title: "Plan.md", markdown: "Plan" },
      ],
    })).resolves.toMatchObject({
      roomId: "room-1",
      mode: "workspace",
      rootId: "workspace-root",
      activeDocumentId: "doc-1",
      nodes: [
        { id: "workspace-root", type: "folder", parentId: null, title: "Workspace" },
        { id: "doc-1", type: "document", title: "README.md", sha256: "hash:8", textLength: 8 },
        { id: "doc-2", type: "document", title: "Plan.md", sha256: "hash:4", textLength: 4 },
      ],
    });
  });

  it("falls back when workspace room active document is not included", async () => {
    await expect(createWorkspaceRoomState({
      roomId: "room-1",
      activeDocumentId: "deleted-doc",
      nowIso: () => "2026-07-09T00:00:00.000Z",
      hashText: async (text) => `hash:${text.length}`,
      documents: [
        { id: "doc-1", title: "README.md", markdown: "# Readme" },
        { id: "doc-2", title: "Plan.md", markdown: "Plan" },
      ],
    })).resolves.toMatchObject({
      activeDocumentId: "doc-1",
    });
  });

  it("validates workspace room checkpoints as the encrypted room persistence payload", async () => {
    const checkpoint = await createWorkspaceRoomCheckpoint({
      roomId: "room-1",
      activeDocumentId: "doc-1",
      nowIso: () => "2026-07-09T00:00:00.000Z",
      hashText: async (text) => `hash:${text.length}`,
      documents: [
        {
          id: "doc-1",
          title: "README.md",
          markdown: "# Readme",
          parentId: null,
        },
      ],
    });

    expect(checkpoint).toMatchObject({
      schema: "tabula.workspace-room-checkpoint",
      version: 1,
      roomId: "room-1",
      workspace: {
        roomId: "room-1",
        mode: "workspace",
        activeDocumentId: "doc-1",
      },
      documents: [
        {
          id: "doc-1",
          title: "README.md",
          markdown: "# Readme",
          parentId: null,
        },
      ],
    });
    expect(parseWorkspaceRoomCheckpoint(checkpoint)).toEqual(checkpoint);
    expect(decodeWorkspaceRoomCheckpoint(encodeWorkspaceRoomCheckpoint(checkpoint))).toEqual(checkpoint);
    expect(parseWorkspaceRoomCheckpoint({
      ...checkpoint,
      documents: [],
    })).toBeNull();
  });

  it("treats unsupported future events as unknown instead of a Tabula.md room contract", () => {
    expect(parseRoomEvent({
      id: "event-1",
      roomId: "room-1",
      actorId: actor.id,
      type: "future.unsupported",
      createdAt: "2026-07-09T00:00:00.000Z",
      payload: {},
    })).toEqual({
      ok: false,
      reason: "unknown",
    });
  });
});
