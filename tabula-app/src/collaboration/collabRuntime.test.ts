import { describe, expect, it } from "vitest";
import type { CollabRecoveryEvent, RoomMeta, TabulaRoomAvailability } from ".";
import {
  canStartCollaborationSession,
  createCollaborationPresenceIdentity,
  createCollaborationSessionStartRequest,
  getDisconnectedStatusPatch,
  getIdleStatusPatch,
  getInitialCollaborationStatus,
  getLiveRoomConnectionTarget,
  getRecoveryEventPatch,
  getRoomMetaPatch,
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
  it("extracts a connectable live room target from a stored live file", () => {
    expect(
      getLiveRoomConnectionTarget(
        file({
          roomId: "room-1",
          shareUrl: `https://tabula.test/#room=room-1,${VALID_ROOM_KEY}`,
        }),
      ),
    ).toEqual({
      fileId: "file-1",
      fileTitle: "README",
      roomId: "room-1",
      roomKey: VALID_ROOM_KEY,
      shareUrl: `https://tabula.test/#room=room-1,${VALID_ROOM_KEY}`,
    });
  });

  it("derives the initial runtime status from the connectable room contract", () => {
    expect(getInitialCollaborationStatus(file())).toBe("idle");
    expect(
      getInitialCollaborationStatus(
        file({
          roomId: "room-1",
          shareUrl: `https://tabula.test/#room=room-1,${VALID_ROOM_KEY}`,
        }),
      ),
    ).toBe("connecting");
    expect(
      getInitialCollaborationStatus(
        file({
          roomId: "room-1",
          shareUrl: `https://tabula.test/#room=room-2,${VALID_ROOM_KEY}`,
        }),
      ),
    ).toBe("idle");
  });

  it("rejects missing, malformed, and mismatched live room links", () => {
    expect(getLiveRoomConnectionTarget(undefined)).toBeNull();
    expect(getLiveRoomConnectionTarget(file({ roomId: "room-1" }))).toBeNull();
    expect(getLiveRoomConnectionTarget(file({ roomId: "room-1", shareUrl: "not a url" }))).toBeNull();
    expect(
      getLiveRoomConnectionTarget(
        file({
          roomId: "room-1",
          shareUrl: `https://tabula.test/#room=room-2,${VALID_ROOM_KEY}`,
        }),
      ),
    ).toBeNull();
  });

  it("keeps room meta patches product-shaped and stable", () => {
    const meta: RoomMeta = {
      roomId: "room-1",
      version: 2,
      snapshotCount: 1,
      lastSavedAt: "2026-06-29T00:00:00.000Z",
      snapshots: [
        {
          id: "latest",
          createdAt: "2026-06-29T00:01:00.000Z",
          textLength: 10,
          updateSize: 20,
          version: 2,
        },
      ],
    };

    expect(getRoomMetaPatch(meta)).toEqual({
      snapshotCount: 1,
      lastSnapshotAt: "2026-06-29T00:01:00.000Z",
    });

    expect(getRoomMetaPatch({ ...meta, lastSavedAt: undefined, snapshots: [] })).toEqual({
      snapshotCount: 1,
    });
  });

  it("maps recovery events without leaking transport-specific detail into hooks", () => {
    const event: CollabRecoveryEvent = {
      id: "event-1",
      type: "snapshot-recovered",
      message: "Recovered from encrypted room recovery state.",
      createdAt: "2026-06-29T00:02:00.000Z",
    };

    expect(getRecoveryEventPatch(event)).toEqual({
      type: "snapshot-recovered",
      message: "Recovered from encrypted room recovery state.",
      createdAt: "2026-06-29T00:02:00.000Z",
    });
  });

  it("centralizes lifecycle status patches", () => {
    expect(getIdleStatusPatch()).toEqual({ collaboratorCount: 0 });
    expect(getDisconnectedStatusPatch()).toEqual({ collaboratorCount: 0, requireRoom: true });
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
          shareUrl: `${origin}/#room=room-1,${VALID_ROOM_KEY}`,
        }),
      }),
    ).toEqual({
      initialText: "# Draft",
      roomId: "room-1",
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
        roomId: "room-1",
        fileTitle: "README",
        selection: { from: 1, to: 2 },
      }),
    ).toEqual({
      ...identity,
      roomId: "room-1",
      fileTitle: "README",
      selection: { from: 1, to: 2 },
    });
  });
});
