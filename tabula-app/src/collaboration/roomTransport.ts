import type { EncryptedEnvelope, RoomJoinedMessage, RoomPeersMessage } from "./roomProtocol";

export type RoomTransportHandlers = {
  onConnect: () => void;
  onJoined: (message: RoomJoinedMessage) => void;
  onPeerJoined: (message: { roomId: string; clientId: string }) => void;
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
  sendVolatileEnvelope: (envelope: EncryptedEnvelope) => void;
  disconnect: () => void;
};

export type CreateRoomTransport = (options: {
  baseUrl: string;
  roomId: string;
  clientId: string;
  handlers: RoomTransportHandlers;
}) => RoomTransport;

type SocketLike = {
  readonly connected: boolean;
  on(event: "connect", handler: () => void): SocketLike;
  on(event: "room:joined", handler: (message: RoomJoinedMessage) => void): SocketLike;
  on(event: "room:peer-joined", handler: (message: { roomId: string; clientId: string }) => void): SocketLike;
  on(event: "room:message", handler: (envelope: unknown) => void): SocketLike;
  on(event: "room:peers", handler: (message: RoomPeersMessage) => void): SocketLike;
  on(event: "room:error", handler: (message: { error?: string }) => void): SocketLike;
  on(event: "disconnect" | "connect_error", handler: () => void): SocketLike;
  emit(event: "room:join", payload: { roomId: string; clientId: string }): void;
  emit(event: "room:message", payload: EncryptedEnvelope): void;
  emit(event: "room:volatile-message", payload: EncryptedEnvelope): void;
  connect(): void;
  disconnect(): void;
};

type SocketIoClientModule = {
  io(baseUrl: string, options: { autoConnect: boolean; transports: string[] }): SocketLike;
};

let socketIoClientPromise: Promise<SocketIoClientModule> | null = null;

const loadSocketIoClient = (): Promise<SocketIoClientModule> => {
  socketIoClientPromise ??= import("socket.io-client").catch((error: unknown) => {
    socketIoClientPromise = null;
    throw error;
  });
  return socketIoClientPromise;
};

export const preloadRoomTransport = async () => {
  await loadSocketIoClient();
};

export const createDefaultRoomTransport: CreateRoomTransport = (options) => createSocketIoRoomTransport(options);

export const createSocketIoRoomTransport: CreateRoomTransport = ({ baseUrl, roomId, clientId, handlers }) => {
  let socket: SocketLike | null = null;
  let socketPromise: Promise<SocketLike> | null = null;
  let disconnectRequested = false;

  const ensureSocket = async () => {
    if (socket) {
      return socket;
    }

    socketPromise ??= loadSocketIoClient()
      .then(({ io }) => {
        const nextSocket = io(baseUrl, {
          autoConnect: false,
          transports: ["websocket", "polling"],
        });

        nextSocket.on("connect", () => {
          handlers.onConnect();
          nextSocket.emit("room:join", { roomId, clientId });
        });
        nextSocket.on("room:joined", handlers.onJoined);
        nextSocket.on("room:peer-joined", handlers.onPeerJoined);
        nextSocket.on("room:message", handlers.onMessage);
        nextSocket.on("room:peers", handlers.onPeers);
        nextSocket.on("room:error", handlers.onError);
        nextSocket.on("disconnect", handlers.onDisconnect);
        nextSocket.on("connect_error", handlers.onConnectError);

        socket = nextSocket;
        return nextSocket;
      })
      .catch((error: unknown) => {
        socketPromise = null;
        handlers.onConnectError();
        throw error;
      });

    return socketPromise;
  };

  return {
    get connected() {
      return Boolean(socket?.connected);
    },
    connect() {
      disconnectRequested = false;
      void ensureSocket()
        .then((nextSocket) => {
          if (!disconnectRequested) {
            nextSocket.connect();
          }
        })
        .catch(() => {
          // The handler is called in ensureSocket. Keep the public contract sync.
        });
    },
    sendEnvelope(envelope) {
      socket?.emit("room:message", envelope);
    },
    sendVolatileEnvelope(envelope) {
      socket?.emit("room:volatile-message", envelope);
    },
    disconnect() {
      disconnectRequested = true;
      socket?.disconnect();
    },
  };
};
