import type { RoomTransportHandlers } from "./roomTransport";
import type { CollabSnapshotFetchResult } from "./collabSnapshotSync";

type ConnectionStatus = "connecting" | "connected" | "offline";
type RecoveryType = "reconnected" | "invalid-message";
type SnapshotFetchSuccess = Exclude<CollabSnapshotFetchResult, false>;

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
      notify: true;
      message: string;
    }
  | {
      notify: false;
    };

type CollabTransportControllerOptions = {
  isClosed: () => boolean;
  fetchSnapshot: () => Promise<CollabSnapshotFetchResult>;
  markJoinBlocked: () => void;
  markJoined: () => JoinResult;
  markOffline: (reason: "disconnect" | "connect-error") => OfflineResult;
  setStatus: (status: ConnectionStatus) => void;
  disconnectTransport: () => void;
  emitCurrentState: () => Promise<void>;
  publishPresence: () => Promise<void>;
  shouldStoreSnapshot: (snapshotFetchResult: SnapshotFetchSuccess) => boolean;
  storeSnapshot: () => Promise<boolean>;
  routeEnvelope: (envelope: unknown) => Promise<void>;
  pruneCollaborators: (peerIds: readonly string[]) => boolean;
  clearCollaborators: () => void;
  publishCollaborators: () => void;
  emitRecoveryEvent: (type: RecoveryType, message: string) => void;
};

export const createCollabTransportHandlers = ({
  isClosed,
  fetchSnapshot,
  markJoinBlocked,
  markJoined,
  markOffline,
  setStatus,
  disconnectTransport,
  emitCurrentState,
  publishPresence,
  shouldStoreSnapshot,
  storeSnapshot,
  routeEnvelope,
  pruneCollaborators,
  clearCollaborators,
  publishCollaborators,
  emitRecoveryEvent,
}: CollabTransportControllerOptions): RoomTransportHandlers => ({
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

    const snapshotFetchResult = await fetchSnapshot();
    if (!snapshotFetchResult) {
      markJoinBlocked();
      setStatus("offline");
      disconnectTransport();
      return;
    }

    setStatus("connected");
    const joinResult = markJoined();
    if (joinResult.reconnected) {
      emitRecoveryEvent("reconnected", joinResult.message);
    }
    await emitCurrentState();
    await publishPresence();
    if (shouldStoreSnapshot(snapshotFetchResult)) {
      await storeSnapshot();
    }
  },
  onMessage: (envelope) => {
    void routeEnvelope(envelope);
  },
  onPeers: (message) => {
    if (pruneCollaborators(message.peers)) {
      publishCollaborators();
    }
  },
  onError: (message) => {
    emitRecoveryEvent("invalid-message", message.error || "A collaboration server message was ignored.");
  },
  onDisconnect: () => {
    if (isClosed()) {
      return;
    }

    setStatus("offline");
    clearCollaborators();
    publishCollaborators();
    const offlineResult = markOffline("disconnect");
    if (offlineResult.notify) {
      emitRecoveryEvent("invalid-message", offlineResult.message);
    }
  },
  onConnectError: () => {
    if (isClosed()) {
      return;
    }

    setStatus("offline");
    const offlineResult = markOffline("connect-error");
    if (offlineResult.notify) {
      emitRecoveryEvent("invalid-message", offlineResult.message);
    }
  },
});
