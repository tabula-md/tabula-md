import type { WorkspaceSession } from "./session/WorkspaceSession";

export type RoomExitLocalWorkspaceStrategy = "adopt-room" | "restore-local";

export type RoomExitLocalWorkspaceContext = {
  hasConnectedFolder?: boolean;
};

export type WorkspaceSessionBoundaryState = {
  authority: "browser" | "folder" | "live";
  folderBinding: "none" | "active" | "suspended";
};

export type WorkspaceSessionBoundaryEvent =
  | { type: "connect-folder" }
  | { type: "disconnect-folder" }
  | { type: "enter-live" }
  | { type: "exit-live"; strategy: RoomExitLocalWorkspaceStrategy }
  | { type: "clear-browser" };

export type WorkspaceSessionBoundaryEffect =
  | "adopt-room"
  | "clear-browser"
  | "disconnect-folder"
  | "restore-local";

export type WorkspaceSessionBoundaryTransition = {
  accepted: boolean;
  effects: WorkspaceSessionBoundaryEffect[];
  state: WorkspaceSessionBoundaryState;
};

export const createWorkspaceSessionBoundaryState = ({
  hasActiveRoom,
  hasConnectedFolder,
}: {
  hasActiveRoom: boolean;
  hasConnectedFolder: boolean;
}): WorkspaceSessionBoundaryState => ({
  authority: hasActiveRoom ? "live" : hasConnectedFolder ? "folder" : "browser",
  folderBinding: hasConnectedFolder
    ? hasActiveRoom ? "suspended" : "active"
    : "none",
});

export const transitionWorkspaceSessionBoundary = (
  state: WorkspaceSessionBoundaryState,
  event: WorkspaceSessionBoundaryEvent,
): WorkspaceSessionBoundaryTransition => {
  if (event.type === "connect-folder") {
    if (state.authority === "live") return { accepted: false, effects: [], state };
    return {
      accepted: true,
      effects: [],
      state: { authority: "folder", folderBinding: "active" },
    };
  }

  if (event.type === "disconnect-folder") {
    if (state.folderBinding === "none") return { accepted: false, effects: [], state };
    return {
      accepted: true,
      effects: ["disconnect-folder"],
      state: {
        authority: state.authority === "live" ? "live" : "browser",
        folderBinding: "none",
      },
    };
  }

  if (event.type === "enter-live") {
    if (state.authority === "live") return { accepted: false, effects: [], state };
    return {
      accepted: true,
      effects: [],
      state: {
        authority: "live",
        folderBinding: state.authority === "folder" ? "suspended" : "none",
      },
    };
  }

  if (event.type === "exit-live") {
    if (state.authority !== "live") return { accepted: false, effects: [], state };
    if (event.strategy === "adopt-room") {
      return {
        accepted: true,
        effects: [
          ...(state.folderBinding === "suspended" ? ["disconnect-folder" as const] : []),
          "adopt-room",
        ],
        state: { authority: "browser", folderBinding: "none" },
      };
    }
    return {
      accepted: true,
      effects: ["restore-local"],
      state: {
        authority: state.folderBinding === "suspended" ? "folder" : "browser",
        folderBinding: state.folderBinding === "suspended" ? "active" : "none",
      },
    };
  }

  if (state.authority !== "browser") return { accepted: false, effects: [], state };
  return {
    accepted: true,
    effects: ["clear-browser"],
    state,
  };
};

export const getRoomExitLocalWorkspaceStrategy = (
  session: WorkspaceSession,
  requestedStrategy?: RoomExitLocalWorkspaceStrategy,
  context: RoomExitLocalWorkspaceContext = {},
): RoomExitLocalWorkspaceStrategy =>
  session.mode === "room" && requestedStrategy
    ? requestedStrategy
    : session.mode === "room" &&
        session.origin === "created" &&
        !context.hasConnectedFolder
    ? "adopt-room"
    : "restore-local";

export const canChooseRoomExitLocalWorkspaceStrategy = (
  session: WorkspaceSession,
  context: RoomExitLocalWorkspaceContext = {},
) =>
  session.mode === "room" &&
  (session.origin === "joined" || Boolean(context.hasConnectedFolder));
