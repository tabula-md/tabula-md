import type { RoomTransportHandlers } from "./roomTransport";
import type { ConnectionStatus } from "./liveCollaboration";

type RecoveryType = "reconnected" | "invalid-message";

type JoinResult =
  | {
      reconnected: true;
      message: string;
    }
  | {
      reconnected: false;
    };

type OfflineResult =
  | {
      status: "reconnecting" | "disconnected" | "failed";
      notify: true;
      message: string;
    }
  | {
      status: "reconnecting" | "disconnected" | "failed";
      notify: false;
    };

type CollabTransportControllerOptions = {
  isClosed: () => boolean;
  markJoined: () => JoinResult;
  markOffline: (reason: "disconnect" | "connect-error") => OfflineResult;
  setStatus: (status: ConnectionStatus) => void;
  emitCurrentState: () => Promise<void>;
  publishPresence: () => Promise<void>;
  routeEnvelope: (envelope: unknown) => Promise<void>;
  pruneCollaborators: (peerIds: readonly string[]) => boolean;
  clearCollaborators: () => void;
  publishCollaborators: () => void;
  emitRecoveryEvent: (type: RecoveryType, message: string) => void;
};

export const createCollabTransportHandlers = ({
  isClosed,
  markJoined,
  markOffline,
  setStatus,
  emitCurrentState,
  publishPresence,
  routeEnvelope,
  pruneCollaborators,
  clearCollaborators,
  publishCollaborators,
  emitRecoveryEvent,
}: CollabTransportControllerOptions): RoomTransportHandlers => {
  let lastPeerSignature = "";

  const getPeerSignature = (peers: readonly string[]) => [...peers].sort().join("\u0000");

  return {
    onConnect: () => {
      if (isClosed()) {
        return;
      }

      setStatus("connecting");
    },
    onJoined: async () => {
      if (isClosed()) {
        return;
      }

      setStatus("connected");
      const joinResult = markJoined();
      if (joinResult.reconnected) {
        emitRecoveryEvent("reconnected", joinResult.message);
      }
      await publishPresence();
      await emitCurrentState();
    },
    onMessage: (envelope) => {
      void routeEnvelope(envelope);
    },
    onPeerJoined: () => {
      void publishPresence();
      void emitCurrentState();
    },
    onPeers: (message) => {
      const peerSignature = getPeerSignature(message.peers);
      const peerListChanged = peerSignature !== lastPeerSignature;
      lastPeerSignature = peerSignature;

      if (pruneCollaborators(message.peers)) {
        publishCollaborators();
      }
      if (message.peers.length > 1 && peerListChanged) {
        void publishPresence();
        void emitCurrentState();
      }
    },
    onError: (message) => {
      emitRecoveryEvent("invalid-message", message.error || "A collaboration server message was ignored.");
    },
    onDisconnect: () => {
      if (isClosed()) {
        return;
      }

      lastPeerSignature = "";
      clearCollaborators();
      publishCollaborators();
      const offlineResult = markOffline("disconnect");
      setStatus(offlineResult.status);
      if (offlineResult.notify) {
        emitRecoveryEvent("invalid-message", offlineResult.message);
      }
    },
    onConnectError: () => {
      if (isClosed()) {
        return;
      }

      lastPeerSignature = "";
      const offlineResult = markOffline("connect-error");
      setStatus(offlineResult.status);
      if (offlineResult.notify) {
        emitRecoveryEvent("invalid-message", offlineResult.message);
      }
    },
  };
};
