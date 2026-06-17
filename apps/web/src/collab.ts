import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import {
  DEFAULT_COLLAB_WS_PORT,
  createCollabSnapshotsPath,
  createCollabTokenPath,
  type Collaborator,
  type CollabRecoveryEvent,
  type ConnectionStatus,
  type LiveSelection,
  type RoomMeta,
  type RoomTokenResponse,
} from "@tabula-md/collab-protocol";

export type {
  Collaborator,
  CollabRecoveryEvent,
  ConnectionStatus,
  LiveSelection,
  RoomMeta,
  RoomSnapshot,
} from "@tabula-md/collab-protocol";

type ConnectOptions = {
  roomId: string;
  initialText?: string;
  identity: Collaborator;
  fileTitle: string;
  selection?: LiveSelection;
  onTextChange: (text: string) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onCollaboratorsChange: (collaborators: Collaborator[]) => void;
  onRoomMetaChange?: (meta: RoomMeta) => void;
  onRecoveryEvent?: (event: CollabRecoveryEvent) => void;
};

type StatelessRoomMetaMessage = {
  type: "tabula-room-meta";
  meta: RoomMeta;
};

const TABULA_AWARENESS_FIELD = "tabula";

const diffText = (oldText: string, nextText: string) => {
  let start = 0;
  while (
    start < oldText.length &&
    start < nextText.length &&
    oldText[start] === nextText[start]
  ) {
    start += 1;
  }

  let oldEnd = oldText.length;
  let nextEnd = nextText.length;
  while (
    oldEnd > start &&
    nextEnd > start &&
    oldText[oldEnd - 1] === nextText[nextEnd - 1]
  ) {
    oldEnd -= 1;
    nextEnd -= 1;
  }

  return {
    index: start,
    deleteCount: oldEnd - start,
    insertText: nextText.slice(start, nextEnd),
  };
};

const getCollabWebSocketUrl = () => {
  const configuredUrl = import.meta.env.VITE_COLLAB_WS_URL as string | undefined;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:${DEFAULT_COLLAB_WS_PORT}`;
};

const toHttpUrl = (url: string) => url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");

const getRoomMetaUrl = (roomId: string) => {
  const configuredHttpUrl = import.meta.env.VITE_COLLAB_HTTP_URL as string | undefined;
  const baseUrl = configuredHttpUrl?.replace(/\/$/, "") ?? toHttpUrl(getCollabWebSocketUrl());
  return `${baseUrl}${createCollabSnapshotsPath(roomId)}`;
};

const getRoomTokenUrl = () => {
  const configuredHttpUrl = import.meta.env.VITE_COLLAB_HTTP_URL as string | undefined;
  const baseUrl = configuredHttpUrl?.replace(/\/$/, "") ?? toHttpUrl(getCollabWebSocketUrl());
  return `${baseUrl}${createCollabTokenPath()}`;
};

const parseRoomMetaMessage = (payload: string): RoomMeta | null => {
  try {
    const decoded = JSON.parse(payload) as StatelessRoomMetaMessage;
    return decoded.type === "tabula-room-meta" ? decoded.meta : null;
  } catch {
    return null;
  }
};

const toCollaborator = (state: Record<string, unknown>, fallbackClientId: string): Collaborator | null => {
  const awarenessValue = state[TABULA_AWARENESS_FIELD];
  if (!awarenessValue || typeof awarenessValue !== "object") {
    return null;
  }

  const collaborator = awarenessValue as Partial<Collaborator>;
  if (!collaborator.id || !collaborator.name || !collaborator.color) {
    return null;
  }

  return {
    id: collaborator.id,
    name: collaborator.name,
    color: collaborator.color,
    lastSeen: typeof collaborator.lastSeen === "number" ? collaborator.lastSeen : Date.now(),
    fileTitle: collaborator.fileTitle,
    selection: collaborator.selection,
  } satisfies Collaborator;
};

export const createCollabConnection = ({
  roomId,
  initialText,
  identity,
  fileTitle,
  selection,
  onTextChange,
  onStatusChange,
  onCollaboratorsChange,
  onRoomMetaChange,
  onRecoveryEvent,
}: ConnectOptions) => {
  const doc = new Y.Doc();
  const text = doc.getText("markdown");
  let currentFileTitle = fileTitle;
  let currentSelection = selection;
  let currentIdentity = identity;
  let closedByClient = false;
  let heartbeat: number | undefined;
  let hasConnectedOnce = false;

  const emitRecoveryEvent = (type: CollabRecoveryEvent["type"], message: string) => {
    onRecoveryEvent?.({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      message,
      createdAt: new Date().toISOString(),
    });
  };

  const fetchRoomMeta = async () => {
    try {
      const response = await fetch(getRoomMetaUrl(roomId));
      if (!response.ok) {
        return;
      }

      onRoomMetaChange?.((await response.json()) as RoomMeta);
    } catch {
      // Room metadata is best-effort; file sync is handled by Hocuspocus.
    }
  };

  const fetchRoomToken = async () => {
    try {
      const response = await fetch(getRoomTokenUrl(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          userId: currentIdentity.id,
          role: "write",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const decoded = (await response.json()) as RoomTokenResponse;
      return decoded.token;
    } catch {
      emitRecoveryEvent("invalid-message", "A room access token could not be issued.");
      return "";
    }
  };

  const publishPresence = (provider: HocuspocusProvider) => {
    provider.setAwarenessField(TABULA_AWARENESS_FIELD, {
      ...identity,
      ...currentIdentity,
      fileTitle: currentFileTitle,
      selection: currentSelection,
      lastSeen: Date.now(),
    });
  };

  if (initialText) {
    doc.transact(() => {
      text.insert(0, initialText);
    });
  }

  const provider = new HocuspocusProvider({
    url: getCollabWebSocketUrl(),
    name: roomId,
    document: doc,
    token: fetchRoomToken,
    forceSyncInterval: 10_000,
    onStatus: ({ status }) => {
      if (closedByClient) {
        return;
      }

      if (status === "connected") {
        onStatusChange("connected");
        if (hasConnectedOnce) {
          emitRecoveryEvent("reconnected", "Connection restored and room state was resynced.");
        }
        hasConnectedOnce = true;
        return;
      }

      onStatusChange(status === "connecting" ? "connecting" : "offline");
    },
    onSynced: ({ state }) => {
      if (!state) {
        return;
      }

      onTextChange(text.toString());
      void fetchRoomMeta();
    },
    onAwarenessChange: ({ states }) => {
      const collaborators = states
        .map((state) => toCollaborator(state, String(state.clientId)))
        .filter((collaborator): collaborator is Collaborator => Boolean(collaborator))
        .filter((collaborator) => collaborator.id !== currentIdentity.id);

      onCollaboratorsChange(collaborators);
    },
    onStateless: ({ payload }) => {
      const meta = parseRoomMetaMessage(payload);
      if (meta) {
        onRoomMetaChange?.(meta);
        return;
      }

      emitRecoveryEvent("invalid-message", "A collaboration server message was ignored.");
    },
    onAuthenticationFailed: ({ reason }) => {
      onStatusChange("offline");
      emitRecoveryEvent("invalid-message", reason || "Collaboration authentication failed.");
    },
  });

  text.observe(() => {
    onTextChange(text.toString());
  });

  publishPresence(provider);
  heartbeat = window.setInterval(() => publishPresence(provider), 5_000);
  onStatusChange("connecting");

  return {
    applyLocalText(nextText: string) {
      const currentText = text.toString();
      if (currentText === nextText) {
        return;
      }

      const patch = diffText(currentText, nextText);
      doc.transact(() => {
        if (patch.deleteCount > 0) {
          text.delete(patch.index, patch.deleteCount);
        }
        if (patch.insertText) {
          text.insert(patch.index, patch.insertText);
        }
      });
    },
    setPresence(nextPresence: { fileTitle?: string; selection?: LiveSelection }) {
      currentFileTitle = nextPresence.fileTitle ?? currentFileTitle;
      currentSelection = nextPresence.selection ?? currentSelection;
      publishPresence(provider);
    },
    setIdentity(nextIdentity: Collaborator) {
      currentIdentity = nextIdentity;
      publishPresence(provider);
    },
    disconnect() {
      closedByClient = true;
      if (heartbeat) {
        window.clearInterval(heartbeat);
      }
      provider.destroy();
      doc.destroy();
      onCollaboratorsChange([]);
    },
  };
};

export type CollabConnection = ReturnType<typeof createCollabConnection>;
