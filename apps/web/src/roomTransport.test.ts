import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EncryptedEnvelope } from "./roomProtocol";

const socketState = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const socket = {
    connected: false,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
      return socket;
    }),
    emit: vi.fn(),
    connect: vi.fn(() => {
      socket.connected = true;
    }),
    disconnect: vi.fn(() => {
      socket.connected = false;
    }),
  };

  return { handlers, socket };
});

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => socketState.socket),
}));

import { io } from "socket.io-client";
import {
  createDefaultRoomTransport,
  createSocketIoRoomTransport,
  type RoomTransportHandlers,
} from "./roomTransport";

const createHandlers = (): RoomTransportHandlers => ({
  onConnect: vi.fn(),
  onJoined: vi.fn(),
  onMessage: vi.fn(),
  onPeers: vi.fn(),
  onError: vi.fn(),
  onDisconnect: vi.fn(),
  onConnectError: vi.fn(),
});

const createEnvelope = (): EncryptedEnvelope => ({
  v: 1,
  roomId: "room-123",
  kind: "yjs-update",
  version: 1,
  iv: "iv",
  ciphertext: "ciphertext",
  createdAt: "2026-06-26T00:00:00.000Z",
});

describe("Socket.IO room transport", () => {
  beforeEach(() => {
    socketState.handlers.clear();
    socketState.socket.connected = false;
    vi.clearAllMocks();
  });

  it("keeps Socket.IO details behind the transport contract", () => {
    const handlers = createHandlers();
    const transport = createSocketIoRoomTransport({
      baseUrl: "https://rooms.tabula.test",
      roomId: "room-123",
      clientId: "client-456",
      handlers,
    });

    expect(io).toHaveBeenCalledWith("https://rooms.tabula.test", {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
    expect(socketState.socket.on).toHaveBeenCalledWith("connect", expect.any(Function));
    expect(socketState.socket.on).toHaveBeenCalledWith("room:joined", handlers.onJoined);
    expect(socketState.socket.on).toHaveBeenCalledWith("room:message", handlers.onMessage);

    expect(transport.connected).toBe(false);
    transport.connect();
    expect(socketState.socket.connect).toHaveBeenCalledTimes(1);
    expect(transport.connected).toBe(true);
  });

  it("joins rooms on connect without sending the client-only room key", () => {
    const handlers = createHandlers();
    createSocketIoRoomTransport({
      baseUrl: "https://rooms.tabula.test",
      roomId: "room-123",
      clientId: "client-456",
      handlers,
    });

    socketState.handlers.get("connect")?.();

    expect(handlers.onConnect).toHaveBeenCalledTimes(1);
    expect(socketState.socket.emit).toHaveBeenCalledWith("room:join", {
      roomId: "room-123",
      clientId: "client-456",
    });
    expect(JSON.stringify(socketState.socket.emit.mock.calls)).not.toContain("roomKey");
  });

  it("relays encrypted envelopes without inspecting their contents", () => {
    const transport = createSocketIoRoomTransport({
      baseUrl: "https://rooms.tabula.test",
      roomId: "room-123",
      clientId: "client-456",
      handlers: createHandlers(),
    });
    const envelope = createEnvelope();

    transport.sendEnvelope(envelope);

    expect(socketState.socket.emit).toHaveBeenCalledWith("room:message", envelope);
  });

  it("uses Socket.IO as the sole default room transport", () => {
    const transport = createDefaultRoomTransport({
      baseUrl: "https://rooms.tabula.test",
      roomId: "room-123",
      clientId: "client-456",
      handlers: createHandlers(),
    });

    transport.connect();

    expect(io).toHaveBeenCalledWith("https://rooms.tabula.test", {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
    expect(socketState.socket.connect).toHaveBeenCalledTimes(1);
  });
});
