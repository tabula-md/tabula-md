import { io, type Socket } from "socket.io-client";

import type { EncryptedEnvelope, RoomJoinedMessage, RoomPeersMessage } from "./roomProtocol";

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

export const createDefaultRoomTransport: CreateRoomTransport = (options) => createSocketIoRoomTransport(options);

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
