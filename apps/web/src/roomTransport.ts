import { io, type Socket } from "socket.io-client";

import type { EncryptedEnvelope, RoomJoinedMessage, RoomPeersMessage } from "./roomProtocol";

export type RoomTransportKind = "socket.io" | "websocket";

export type RoomTransportHandlers = {
  onConnect: () => void;
  onJoined: (message: RoomJoinedMessage) => void;
  onMessage: (envelope: unknown) => void;
  onPeers: (message: RoomPeersMessage) => void;
  onError: (message: { error?: string }) => void;
  onDisconnect: () => void;
  onConnectError: () => void;
};

export type RoomTransport = {
  readonly connected: boolean;
  connect: () => void;
  sendEnvelope: (envelope: EncryptedEnvelope) => void;
  disconnect: () => void;
};

export type CreateRoomTransport = (options: {
  baseUrl: string;
  roomId: string;
  clientId: string;
  handlers: RoomTransportHandlers;
}) => RoomTransport;

export const resolveRoomTransportKind = (
  configuredTransport = import.meta.env.VITE_TABULA_ROOM_TRANSPORT as string | undefined,
): RoomTransportKind => {
  const normalizedTransport = configuredTransport?.trim().toLowerCase();
  return normalizedTransport === "websocket" ? "websocket" : "socket.io";
};

export const createDefaultRoomTransport: CreateRoomTransport = (options) =>
  resolveRoomTransportKind() === "websocket"
    ? createWebSocketRoomTransport(options)
    : createSocketIoRoomTransport(options);

export const createSocketIoRoomTransport: CreateRoomTransport = ({ baseUrl, roomId, clientId, handlers }) => {
  const socket: Socket = io(baseUrl, {
    autoConnect: false,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    handlers.onConnect();
    socket.emit("room:join", { roomId, clientId });
  });
  socket.on("room:joined", handlers.onJoined);
  socket.on("room:message", handlers.onMessage);
  socket.on("room:peers", handlers.onPeers);
  socket.on("room:error", handlers.onError);
  socket.on("disconnect", handlers.onDisconnect);
  socket.on("connect_error", handlers.onConnectError);

  return {
    get connected() {
      return socket.connected;
    },
    connect() {
      socket.connect();
    },
    sendEnvelope(envelope) {
      socket.emit("room:message", envelope);
    },
    disconnect() {
      socket.disconnect();
    },
  };
};

const createRoomWebSocketUrl = (baseUrl: string, roomId: string) => {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : url.protocol === "http:" ? "ws:" : url.protocol;
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/v1/rooms/${encodeURIComponent(roomId)}/socket`;
  url.search = "";
  url.hash = "";
  return url.toString();
};

const parseWebSocketMessage = (data: unknown) => {
  if (typeof data !== "string") {
    return null;
  }

  try {
    const message = JSON.parse(data) as { type?: string; [key: string]: unknown };
    return typeof message.type === "string" ? message : null;
  } catch {
    return null;
  }
};

const toRoomJoinedMessage = (message: { [key: string]: unknown }): RoomJoinedMessage | null => {
  if (
    typeof message.roomId !== "string" ||
    typeof message.clientId !== "string" ||
    typeof message.peerCount !== "number"
  ) {
    return null;
  }

  return {
    roomId: message.roomId,
    clientId: message.clientId,
    peerCount: message.peerCount,
  };
};

const toRoomPeersMessage = (message: { [key: string]: unknown }): RoomPeersMessage | null => {
  if (typeof message.roomId !== "string" || !Array.isArray(message.peers)) {
    return null;
  }

  const peers = message.peers.filter((peer): peer is string => typeof peer === "string");
  if (peers.length !== message.peers.length) {
    return null;
  }

  return {
    roomId: message.roomId,
    peers,
  };
};

export const createWebSocketRoomTransport: CreateRoomTransport = ({ baseUrl, roomId, clientId, handlers }) => {
  let socket: WebSocket | null = null;
  let connected = false;
  let closedByClient = false;

  const sendJson = (message: unknown) => {
    socket?.send(JSON.stringify(message));
  };

  return {
    get connected() {
      return connected;
    },
    connect() {
      closedByClient = false;
      socket = new WebSocket(createRoomWebSocketUrl(baseUrl, roomId));
      socket.addEventListener("open", () => {
        connected = true;
        handlers.onConnect();
        sendJson({ type: "room:join", roomId, clientId });
      });
      socket.addEventListener("message", (event) => {
        const message = parseWebSocketMessage(event.data);
        if (!message) {
          handlers.onError({ error: "Invalid room message." });
          return;
        }

        if (message.type === "room:joined") {
          const joinedMessage = toRoomJoinedMessage(message);
          if (joinedMessage) {
            handlers.onJoined(joinedMessage);
          } else {
            handlers.onError({ error: "Invalid room join message." });
          }
          return;
        }

        if (message.type === "room:message") {
          handlers.onMessage(message.envelope);
          return;
        }

        if (message.type === "room:peers") {
          const peersMessage = toRoomPeersMessage(message);
          if (peersMessage) {
            handlers.onPeers(peersMessage);
          } else {
            handlers.onError({ error: "Invalid room peers message." });
          }
          return;
        }

        if (message.type === "room:error") {
          handlers.onError({ error: typeof message.error === "string" ? message.error : undefined });
          return;
        }

        handlers.onError({ error: "Unknown room message." });
      });
      socket.addEventListener("close", () => {
        connected = false;
        if (!closedByClient) {
          handlers.onDisconnect();
        }
      });
      socket.addEventListener("error", () => {
        if (!closedByClient) {
          handlers.onConnectError();
        }
      });
    },
    sendEnvelope(envelope) {
      sendJson({ type: "room:message", envelope });
    },
    disconnect() {
      closedByClient = true;
      connected = false;
      socket?.close();
      socket = null;
    },
  };
};
