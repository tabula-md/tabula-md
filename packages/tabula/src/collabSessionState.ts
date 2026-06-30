export type CollabOfflineReason = "disconnect" | "connect-error";
export type CollabOfflineStatus = "reconnecting" | "disconnected" | "failed";

export type CollabJoinResult =
  | {
      reconnected: true;
      message: string;
    }
  | {
      reconnected: false;
    };

export type CollabOfflineResult =
  | {
      status: CollabOfflineStatus;
      notify: true;
      message: string;
    }
  | {
      status: CollabOfflineStatus;
      notify: false;
    };

export type CollabSessionState = {
  markJoinBlocked(): void;
  markJoined(): CollabJoinResult;
  markOffline(reason: CollabOfflineReason): CollabOfflineResult;
  isBlocked(): boolean;
};

export const createCollabSessionState = (): CollabSessionState => {
  let hasConnectedOnce = false;
  let collaborationBlocked = false;
  let serverOfflineNotified = false;

  return {
    markJoinBlocked() {
      collaborationBlocked = true;
    },
    markJoined() {
      const reconnected = hasConnectedOnce;
      hasConnectedOnce = true;
      serverOfflineNotified = false;

      return reconnected
        ? {
            reconnected: true,
            message: "Connection restored and room state was resynced.",
          }
        : {
            reconnected: false,
          };
    },
    markOffline(reason) {
      const status: CollabOfflineStatus =
        reason === "disconnect"
          ? hasConnectedOnce
            ? "reconnecting"
            : "disconnected"
          : hasConnectedOnce
            ? "reconnecting"
            : "failed";

      if (collaborationBlocked) {
        return { status: "failed", notify: false };
      }

      if (serverOfflineNotified) {
        return { status, notify: false };
      }

      if (reason === "disconnect" && !hasConnectedOnce) {
        return { status, notify: false };
      }

      serverOfflineNotified = true;
      return {
        status,
        notify: true,
        message:
          reason === "disconnect"
            ? "The collaboration server disconnected. Local edits will sync when it reconnects."
            : "The collaboration server is not reachable. Local edits stay in this browser.",
      };
    },
    isBlocked() {
      return collaborationBlocked;
    },
  };
};
