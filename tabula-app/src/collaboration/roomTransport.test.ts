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
  onPeerJoined: vi.fn(),
  onMessage: vi.fn(),
  onPeers: vi.fn(),
  onError: vi.fn(),
  onDisconnect: vi.fn(),
  onConnectError: vi.fn(),
});

const createEnvelope = (): EncryptedEnvelope => ({
  v: 1,
  roomId: "room-123",
  kind: "room-event",
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

  it("keeps Socket.IO unloaded until the transport connects", () => {
    const transport = createSocketIoRoomTransport({
      baseUrl: "https://rooms.tabula.test",
      roomId: "room-123",
      clientId: "client-456",
      handlers: createHandlers(),
    });

    expect(io).not.toHaveBeenCalled();
    expect(transport.connected).toBe(false);
  });

  it("keeps Socket.IO details behind the transport contract", async () => {
    const handlers = createHandlers();
    const transport = createSocketIoRoomTransport({
      baseUrl: "https://rooms.tabula.test",
      roomId: "room-123",
      clientId: "client-456",
      handlers,
    });

    transport.connect();

    await vi.waitFor(() => {
      expect(io).toHaveBeenCalledWith("https://rooms.tabula.test", {
        autoConnect: false,
        timeout: 5_000,
        transports: ["websocket", "polling"],
      });
    });
    expect(io).toHaveBeenCalledWith("https://rooms.tabula.test", {
      autoConnect: false,
      timeout: 5_000,
      transports: ["websocket", "polling"],
    });
    expect(socketState.socket.on).toHaveBeenCalledWith("connect", expect.any(Function));
    expect(socketState.socket.on).toHaveBeenCalledWith("room:joined", handlers.onJoined);
    expect(socketState.socket.on).toHaveBeenCalledWith("room:peer-joined", handlers.onPeerJoined);
    expect(socketState.socket.on).toHaveBeenCalledWith("room:message", handlers.onMessage);

    expect(socketState.socket.connect).toHaveBeenCalledTimes(1);
    expect(transport.connected).toBe(true);
  });

  it("joins rooms on connect without sending the client-only room key", async () => {
    const handlers = createHandlers();
    const transport = createSocketIoRoomTransport({
      baseUrl: "https://rooms.tabula.test",
      roomId: "room-123",
      clientId: "client-456",
      handlers,
    });

    transport.connect();
    await vi.waitFor(() => {
      expect(socketState.socket.on).toHaveBeenCalledWith("connect", expect.any(Function));
    });
    socketState.handlers.get("connect")?.();

    expect(handlers.onConnect).toHaveBeenCalledTimes(1);
    expect(socketState.socket.emit).toHaveBeenCalledWith("room:join", {
      roomId: "room-123",
      clientId: "client-456",
    });
    expect(JSON.stringify(socketState.socket.emit.mock.calls)).not.toContain("roomKey");
  });

  it("does not emit envelopes before Socket.IO is loaded", () => {
    const transport = createSocketIoRoomTransport({
      baseUrl: "https://rooms.tabula.test",
      roomId: "room-123",
      clientId: "client-456",
      handlers: createHandlers(),
    });

    transport.sendEnvelope(createEnvelope());

    expect(socketState.socket.emit).not.toHaveBeenCalled();
  });

  it("relays encrypted envelopes without inspecting their contents", async () => {
    const transport = createSocketIoRoomTransport({
      baseUrl: "https://rooms.tabula.test",
      roomId: "room-123",
      clientId: "client-456",
      handlers: createHandlers(),
    });
    const envelope = createEnvelope();

    transport.connect();
    await vi.waitFor(() => {
      expect(socketState.socket.connect).toHaveBeenCalledTimes(1);
    });
    transport.sendEnvelope(envelope);

    expect(socketState.socket.emit).toHaveBeenCalledWith("room:message", envelope);
  });

  it("relays volatile encrypted envelopes through the volatile socket event", async () => {
    const transport = createSocketIoRoomTransport({
      baseUrl: "https://rooms.tabula.test",
      roomId: "room-123",
      clientId: "client-456",
      handlers: createHandlers(),
    });
    const envelope = createEnvelope();

    transport.connect();
    await vi.waitFor(() => {
      expect(socketState.socket.connect).toHaveBeenCalledTimes(1);
    });
    transport.sendVolatileEnvelope(envelope);

    expect(socketState.socket.emit).toHaveBeenCalledWith("room:volatile-message", envelope);
  });

  it("uses Socket.IO as the sole default room transport", async () => {
    const transport = createDefaultRoomTransport({
      baseUrl: "https://rooms.tabula.test",
      roomId: "room-123",
      clientId: "client-456",
      handlers: createHandlers(),
    });

    transport.connect();

    await vi.waitFor(() => {
      expect(io).toHaveBeenCalledWith("https://rooms.tabula.test", {
        autoConnect: false,
        timeout: 5_000,
        transports: ["websocket", "polling"],
      });
    });
    expect(socketState.socket.connect).toHaveBeenCalledTimes(1);
  });
});
