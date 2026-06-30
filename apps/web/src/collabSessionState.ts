export type CollabOfflineReason = "disconnect" | "connect-error";

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
      notify: true;
      message: string;
    }
  | {
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
      if (collaborationBlocked || serverOfflineNotified) {
        return { notify: false };
      }

      if (reason === "disconnect" && !hasConnectedOnce) {
        return { notify: false };
      }

      serverOfflineNotified = true;
      return {
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
