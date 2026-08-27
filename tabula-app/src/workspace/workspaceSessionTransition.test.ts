import { describe, expect, it } from "vitest";
import {
  createLocalWorkspaceSession,
  createRoomWorkspaceSession,
} from "./session/WorkspaceSession";
import {
  canChooseRoomExitLocalWorkspaceStrategy,
  createWorkspaceSessionBoundaryState,
  getRoomExitLocalWorkspaceStrategy,
  transitionWorkspaceSessionBoundary,
} from "./workspaceSessionTransition";

const room = {
  roomId: "room-id",
  shareUrl: "https://tabula.md/#room=room-id",
};

describe("workspace session transitions", () => {
  it("adopts changes from a room created from the current local workspace", () => {
    const session = createRoomWorkspaceSession(room, null, "created");

    expect(getRoomExitLocalWorkspaceStrategy(session)).toBe("adopt-room");
    expect(canChooseRoomExitLocalWorkspaceStrategy(session)).toBe(false);

    session.dispose();
  });

  it("protects a connected folder when leaving a room created from it", () => {
    const session = createRoomWorkspaceSession(room, null, "created");
    const context = { hasConnectedFolder: true };

    expect(getRoomExitLocalWorkspaceStrategy(session, undefined, context)).toBe(
      "restore-local",
    );
    expect(canChooseRoomExitLocalWorkspaceStrategy(session, context)).toBe(true);
    expect(getRoomExitLocalWorkspaceStrategy(session, "adopt-room", context)).toBe(
      "adopt-room",
    );

    session.dispose();
  });

  it("restores the previous local workspace after leaving a joined room", () => {
    const session = createRoomWorkspaceSession(room, null, "joined");

    expect(getRoomExitLocalWorkspaceStrategy(session)).toBe("restore-local");
    expect(canChooseRoomExitLocalWorkspaceStrategy(session)).toBe(true);
    expect(getRoomExitLocalWorkspaceStrategy(session, "adopt-room")).toBe(
      "adopt-room",
    );

    session.dispose();
  });

  it("never treats an ordinary local session as room content to adopt", () => {
    const session = createLocalWorkspaceSession();

    expect(getRoomExitLocalWorkspaceStrategy(session)).toBe("restore-local");
    expect(canChooseRoomExitLocalWorkspaceStrategy(session)).toBe(false);

    session.dispose();
  });
});

describe("workspace session boundary state machine", () => {
  it("suspends a folder while live and restores it when room changes are discarded", () => {
    const folder = createWorkspaceSessionBoundaryState({
      hasActiveRoom: false,
      hasConnectedFolder: true,
    });
    const live = transitionWorkspaceSessionBoundary(folder, { type: "enter-live" });
    const restored = transitionWorkspaceSessionBoundary(live.state, {
      type: "exit-live",
      strategy: "restore-local",
    });

    expect(live).toMatchObject({
      accepted: true,
      state: { authority: "live", folderBinding: "suspended" },
    });
    expect(restored).toEqual({
      accepted: true,
      effects: ["restore-local"],
      state: { authority: "folder", folderBinding: "active" },
    });
  });

  it("disconnects a suspended folder before adopting room content", () => {
    const live = createWorkspaceSessionBoundaryState({
      hasActiveRoom: true,
      hasConnectedFolder: true,
    });

    expect(transitionWorkspaceSessionBoundary(live, {
      type: "exit-live",
      strategy: "adopt-room",
    })).toEqual({
      accepted: true,
      effects: ["disconnect-folder", "adopt-room"],
      state: { authority: "browser", folderBinding: "none" },
    });
  });

  it("rejects destructive browser clearing outside browser authority", () => {
    const folder = createWorkspaceSessionBoundaryState({
      hasActiveRoom: false,
      hasConnectedFolder: true,
    });

    expect(transitionWorkspaceSessionBoundary(folder, { type: "clear-browser" }))
      .toEqual({ accepted: false, effects: [], state: folder });
  });
});
