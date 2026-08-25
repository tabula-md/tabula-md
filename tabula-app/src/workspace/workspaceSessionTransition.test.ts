import { describe, expect, it } from "vitest";
import {
  createLocalWorkspaceSession,
  createRoomWorkspaceSession,
} from "./session/WorkspaceSession";
import {
  canChooseRoomExitLocalWorkspaceStrategy,
  getRoomExitLocalWorkspaceStrategy,
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
