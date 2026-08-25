import type { WorkspaceSession } from "./session/WorkspaceSession";

export type RoomExitLocalWorkspaceStrategy = "adopt-room" | "restore-local";

export const getRoomExitLocalWorkspaceStrategy = (
  session: WorkspaceSession,
): RoomExitLocalWorkspaceStrategy =>
  session.mode === "room" && session.origin === "created"
    ? "adopt-room"
    : "restore-local";
