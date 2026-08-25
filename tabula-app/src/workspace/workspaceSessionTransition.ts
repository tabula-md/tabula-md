import type { WorkspaceSession } from "./session/WorkspaceSession";

export type RoomExitLocalWorkspaceStrategy = "adopt-room" | "restore-local";

export const getRoomExitLocalWorkspaceStrategy = (
  session: WorkspaceSession,
  requestedStrategy?: RoomExitLocalWorkspaceStrategy,
): RoomExitLocalWorkspaceStrategy =>
  session.mode === "room" && requestedStrategy
    ? requestedStrategy
    : session.mode === "room" && session.origin === "created"
    ? "adopt-room"
    : "restore-local";

export const canChooseRoomExitLocalWorkspaceStrategy = (
  session: WorkspaceSession,
) => session.mode === "room" && session.origin === "joined";
