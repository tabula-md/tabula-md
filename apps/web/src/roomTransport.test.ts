import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  readonly sent: string[] = [];
  readonly listeners = new Map<string, ((event: { data?: string }) => void)[]>();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(event: string, handler: (event: { data?: string }) => void) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(handler);
    this.listeners.set(event, listeners);
  }

  send(message: string) {
    this.sent.push(message);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }

  emit(event: string, payload: { data?: string } = {}) {
    if (event === "open") {
      this.readyState = FakeWebSocket.OPEN;
    }
    if (event === "close") {
      this.readyState = FakeWebSocket.CLOSED;
    }
    for (const listener of this.listeners.get(event) ?? []) {
      listener(payload);
    }
  }
}

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => socketState.socket),
}));

import { io } from "socket.io-client";
import {
  createSocketIoRoomTransport,
  createWebSocketRoomTransport,
  resolveRoomTransportKind,
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
});

describe("native WebSocket room transport", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("resolves the configured room transport kind", () => {
    expect(resolveRoomTransportKind("websocket")).toBe("websocket");
    expect(resolveRoomTransportKind(" WebSocket ")).toBe("websocket");
    expect(resolveRoomTransportKind("socket.io")).toBe("socket.io");
    expect(resolveRoomTransportKind()).toBe("socket.io");
  });

  it("connects to the room-routed WebSocket endpoint and sends only routing metadata", () => {
    const handlers = createHandlers();
    const transport = createWebSocketRoomTransport({
      baseUrl: "https://rooms.tabula.test",
      roomId: "room-123",
      clientId: "client-456",
      handlers,
    });

    transport.connect();
    const socket = FakeWebSocket.instances[0];
    socket.emit("open");

    expect(socket.url).toBe("wss://rooms.tabula.test/v1/rooms/room-123/socket");
    expect(handlers.onConnect).toHaveBeenCalledTimes(1);
    expect(JSON.parse(socket.sent[0] ?? "{}")).toEqual({
      type: "room:join",
      roomId: "room-123",
      clientId: "client-456",
    });
    expect(socket.sent.join("\n")).not.toContain("roomKey");
    expect(transport.connected).toBe(true);
  });

  it("serializes encrypted envelopes as room messages", () => {
    const transport = createWebSocketRoomTransport({
      baseUrl: "http://localhost:3002",
      roomId: "room-123",
      clientId: "client-456",
      handlers: createHandlers(),
    });
    const envelope = createEnvelope();

    transport.connect();
    const socket = FakeWebSocket.instances[0];
    socket.emit("open");
    transport.sendEnvelope(envelope);

    expect(socket.url).toBe("ws://localhost:3002/v1/rooms/room-123/socket");
    expect(JSON.parse(socket.sent[1] ?? "{}")).toEqual({
      type: "room:message",
      envelope,
    });
  });

  it("routes incoming WebSocket messages to the shared transport handlers", () => {
    const handlers = createHandlers();
    const transport = createWebSocketRoomTransport({
      baseUrl: "https://rooms.tabula.test",
      roomId: "room-123",
      clientId: "client-456",
      handlers,
    });
    const envelope = createEnvelope();

    transport.connect();
    const socket = FakeWebSocket.instances[0];
    socket.emit("message", {
      data: JSON.stringify({ type: "room:joined", roomId: "room-123", clientId: "client-456", peerCount: 1 }),
    });
    socket.emit("message", { data: JSON.stringify({ type: "room:message", envelope }) });
    socket.emit("message", { data: JSON.stringify({ type: "room:peers", roomId: "room-123", peers: ["peer"] }) });
    socket.emit("message", { data: JSON.stringify({ type: "room:error", error: "Room capped." }) });

    expect(handlers.onJoined).toHaveBeenCalledWith({ roomId: "room-123", clientId: "client-456", peerCount: 1 });
    expect(handlers.onMessage).toHaveBeenCalledWith(envelope);
    expect(handlers.onPeers).toHaveBeenCalledWith({ roomId: "room-123", peers: ["peer"] });
    expect(handlers.onError).toHaveBeenCalledWith({ error: "Room capped." });
  });

  it("reconnects and rejoins after an unexpected close", () => {
    vi.useFakeTimers();
    const handlers = createHandlers();
    const transport = createWebSocketRoomTransport({
      baseUrl: "https://rooms.tabula.test",
      roomId: "room-123",
      clientId: "client-456",
      handlers,
    });

    transport.connect();
    const firstSocket = FakeWebSocket.instances[0];
    firstSocket.emit("open");
    firstSocket.emit("close");

    expect(handlers.onDisconnect).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(750);

    expect(FakeWebSocket.instances).toHaveLength(2);
    const secondSocket = FakeWebSocket.instances[1];
    secondSocket.emit("open");

    expect(handlers.onConnect).toHaveBeenCalledTimes(2);
    expect(JSON.parse(secondSocket.sent[0] ?? "{}")).toEqual({
      type: "room:join",
      roomId: "room-123",
      clientId: "client-456",
    });

    transport.disconnect();
    secondSocket.emit("close");
    vi.advanceTimersByTime(750);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
