import { describe, expect, it } from "vitest";
import type { TabulaRoomAvailability } from ".";
import {
  canStartCollaborationSession,
  createCollaborationPresenceIdentity,
  createCollaborationSessionStartRequest,
  getInitialCollaborationStatus,
  getLiveRoomConnectionTarget,
} from "./collabRuntime";
import type { WorkspaceFile } from "../workspaceStorage";

const VALID_ROOM_KEY = "A".repeat(43);

const file = (overrides: Partial<WorkspaceFile> = {}): WorkspaceFile => ({
  id: "file-1",
  title: "README",
  text: "hello",
  viewMode: "edit",
  readingWidth: "standard",
  lineWrapping: true,
  lineNumbers: true,
  ...overrides,
});

describe("collaboration runtime model", () => {
  it("extracts a connectable target from room session metadata", () => {
    expect(
      getLiveRoomConnectionTarget({
        room: {
          roomId: "room-1",
          shareUrl: `https://tabula.test/#room=room-1,${VALID_ROOM_KEY}`,
        },
        document: file(),
      }),
    ).toEqual({
      fileId: "file-1",
      fileTitle: "README",
      roomId: "room-1",
      roomKey: VALID_ROOM_KEY,
      shareUrl: `https://tabula.test/#room=room-1,${VALID_ROOM_KEY}`,
    });
  });

  it("derives connection state from the workspace session, not a file", () => {
    expect(getInitialCollaborationStatus(null)).toBe("idle");
    expect(getInitialCollaborationStatus({
      roomId: "room-1",
      shareUrl: `https://tabula.test/#room=room-1,${VALID_ROOM_KEY}`,
    })).toBe("connecting");
  });

  it("rejects missing, malformed, and mismatched live room links", () => {
    expect(getLiveRoomConnectionTarget({})).toBeNull();
    expect(getLiveRoomConnectionTarget({
      room: { roomId: "room-1", shareUrl: "not a url" },
      document: file(),
    })).toBeNull();
    expect(
      getLiveRoomConnectionTarget({
        room: {
          roomId: "room-1",
          shareUrl: `https://tabula.test/#room=room-2,${VALID_ROOM_KEY}`,
        },
        document: file(),
      }),
    ).toBeNull();
    expect(getLiveRoomConnectionTarget({
      room: {
        roomId: "room-1",
        shareUrl: `https://tabula.test/#room=room-1,${VALID_ROOM_KEY}`,
      },
    })).toEqual({
      fileId: undefined,
      fileTitle: undefined,
      roomId: "room-1",
      roomKey: VALID_ROOM_KEY,
      shareUrl: `https://tabula.test/#room=room-1,${VALID_ROOM_KEY}`,
    });
  });

  it("only allows session creation when a file exists and room service is configured", () => {
    const available: TabulaRoomAvailability = { available: true, baseUrl: "https://rooms.test", unavailableReason: "" };
    const unavailable: TabulaRoomAvailability = {
      available: false,
      baseUrl: "",
      unavailableReason: "Room server missing.",
    };

    expect(canStartCollaborationSession({ activeFile: file(), roomAvailability: available })).toBe(true);
    expect(canStartCollaborationSession({ activeFile: undefined, roomAvailability: available })).toBe(false);
    expect(canStartCollaborationSession({ activeFile: file(), roomAvailability: unavailable })).toBe(false);
  });

  it("creates a session start request without leaking browser state into callers", () => {
    const activeFile = file({ text: "# Draft" });
    const available: TabulaRoomAvailability = { available: true, baseUrl: "https://rooms.test", unavailableReason: "" };

    expect(
      createCollaborationSessionStartRequest({
        activeFile,
        origin: "https://tabula.test",
        roomAvailability: available,
        createSession: (origin) => ({
          roomId: "room-1",
          roomKey: VALID_ROOM_KEY,
          shareUrl: `${origin}/#room=room-1,${VALID_ROOM_KEY}`,
        }),
      }),
    ).toEqual({
      roomId: "room-1",
      roomKey: VALID_ROOM_KEY,
      shareUrl: `https://tabula.test/#room=room-1,${VALID_ROOM_KEY}`,
    });
  });

  it("does not create session requests when the room service is unavailable", () => {
    expect(
      createCollaborationSessionStartRequest({
        activeFile: file(),
        origin: "https://tabula.test",
        roomAvailability: {
          available: false,
          baseUrl: "",
          unavailableReason: "Room server missing.",
        },
      }),
    ).toBeUndefined();
  });

  it("adds room-scoped presence metadata only while live", () => {
    const identity = {
      id: "self",
      name: "Ada",
      color: "#763FC8",
      lastSeen: 1,
    };

    expect(
      createCollaborationPresenceIdentity({
        identity,
        isLive: false,
        roomId: "room-1",
        fileTitle: "README",
        selection: { from: 1, to: 2 },
      }),
    ).toBe(identity);

    expect(
      createCollaborationPresenceIdentity({
        identity,
        isLive: true,
        activeDocumentId: "readme",
        roomId: "room-1",
        fileTitle: "README",
        selection: { from: 1, to: 2 },
      }),
    ).toEqual({
      ...identity,
      kind: "human",
      client: "tabula-md",
      capabilities: ["presence", "read", "write"],
      joinedAt: "1970-01-01T00:00:00.000Z",
      activeDocumentId: "readme",
      roomId: "room-1",
      fileTitle: "README",
      selection: { documentId: "readme", from: 1, to: 2 },
    });

    expect(
      createCollaborationPresenceIdentity({
        identity,
        isLive: true,
        roomId: "room-1",
        selection: { from: 1, to: 2 },
      }),
    ).toMatchObject({
      roomId: "room-1",
      selection: undefined,
    });
  });
});
