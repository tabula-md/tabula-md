import { describe, expect, it, vi } from "vitest";
import { createCollabTransportHandlers } from "./collabTransportController";

const createHarness = (overrides: Partial<Parameters<typeof createCollabTransportHandlers>[0]> = {}) => {
  const options: Parameters<typeof createCollabTransportHandlers>[0] = {
    isClosed: vi.fn(() => false),
    fetchSnapshot: vi.fn(async () => "missing" as const),
    markJoined: vi.fn(() => ({ reconnected: false as const })),
    markOffline: vi.fn(() => ({
      status: "failed" as const,
      notify: false as const,
    })),
    setStatus: vi.fn(),
    emitCurrentState: vi.fn(async () => {}),
    emitStateInit: vi.fn(async () => {}),
    publishPresence: vi.fn(async () => {}),
    shouldStoreSnapshot: vi.fn(() => false),
    storeSnapshot: vi.fn(async () => true),
    routeEnvelope: vi.fn(async () => {}),
    pruneCollaborators: vi.fn(() => false),
    clearCollaborators: vi.fn(),
    publishCollaborators: vi.fn(),
    emitRecoveryEvent: vi.fn(),
    ...overrides,
  };

  return {
    options,
    handlers: createCollabTransportHandlers(options),
  };
};

describe("collaboration transport controller", () => {
  it("sets connecting when the socket connects", () => {
    const { options, handlers } = createHarness();

    handlers.onConnect();

    expect(options.setStatus).toHaveBeenCalledWith("connecting");
  });

  it("ignores socket events after the client closes the connection", async () => {
    const { options, handlers } = createHarness({
      isClosed: vi.fn(() => true),
    });

    handlers.onConnect();
    await handlers.onJoined({ roomId: "room-1", clientId: "self", peerCount: 0 });
    handlers.onDisconnect();
    handlers.onConnectError();

    expect(options.setStatus).not.toHaveBeenCalled();
    expect(options.fetchSnapshot).not.toHaveBeenCalled();
    expect(options.clearCollaborators).not.toHaveBeenCalled();
  });

  it("continues joining when recovery is unavailable", async () => {
    const { options, handlers } = createHarness({
      fetchSnapshot: vi.fn(async () => "unavailable" as const),
    });

    await handlers.onJoined({ roomId: "room-1", clientId: "self", peerCount: 0 });

    expect(options.setStatus).toHaveBeenCalledWith("connected");
    expect(options.emitCurrentState).toHaveBeenCalled();
  });

  it("publishes document state and presence after joining", async () => {
    const { options, handlers } = createHarness({
      fetchSnapshot: vi.fn(async () => "restored" as const),
      shouldStoreSnapshot: vi.fn(() => true),
    });

    await handlers.onJoined({ roomId: "room-1", clientId: "self", peerCount: 0 });

    expect(options.setStatus).toHaveBeenCalledWith("connected");
    expect(options.markJoined).toHaveBeenCalled();
    expect(options.emitCurrentState).toHaveBeenCalled();
    expect(options.publishPresence).toHaveBeenCalled();
    expect(options.shouldStoreSnapshot).toHaveBeenCalledWith("restored");
    expect(options.storeSnapshot).toHaveBeenCalled();
  });

  it("emits a recovery event when a previous session reconnects", async () => {
    const { options, handlers } = createHarness({
      markJoined: vi.fn(() => ({
        reconnected: true,
        message: "Connection restored and room state was resynced.",
      })),
    });

    await handlers.onJoined({ roomId: "room-1", clientId: "self", peerCount: 0 });

    expect(options.emitRecoveryEvent).toHaveBeenCalledWith(
      "reconnected",
      "Connection restored and room state was resynced.",
    );
  });

  it("routes encrypted envelopes through the envelope router", () => {
    const { options, handlers } = createHarness();
    const envelope = { kind: "presence" };

    handlers.onMessage(envelope);

    expect(options.routeEnvelope).toHaveBeenCalledWith(envelope);
  });

  it("emits state-init when a new peer joins", () => {
    const { options, handlers } = createHarness();

    handlers.onPeerJoined({ roomId: "room-1", clientId: "remote" });

    expect(options.emitStateInit).toHaveBeenCalled();
    expect(options.publishPresence).toHaveBeenCalled();
  });

  it("publishes collaborators only when the peer list changes", () => {
    const { options, handlers } = createHarness({
      pruneCollaborators: vi.fn(() => true),
    });

    handlers.onPeers({ roomId: "room-1", peers: ["remote"] });

    expect(options.publishCollaborators).toHaveBeenCalled();
  });

  it("resyncs state and presence after receiving a multi-peer room list", () => {
    const { options, handlers } = createHarness();

    handlers.onPeers({ roomId: "room-1", peers: ["self", "remote"] });

    expect(options.emitStateInit).toHaveBeenCalledTimes(1);
    expect(options.publishPresence).toHaveBeenCalledTimes(1);
  });

  it("does not resync state for a room list containing only self", () => {
    const { options, handlers } = createHarness();

    handlers.onPeers({ roomId: "room-1", peers: ["self"] });

    expect(options.emitStateInit).not.toHaveBeenCalled();
    expect(options.publishPresence).not.toHaveBeenCalled();
  });

  it("clears collaborators and reports reconnecting disconnects", () => {
    const { options, handlers } = createHarness({
      markOffline: vi.fn(() => ({
        status: "reconnecting" as const,
        notify: true,
        message: "The collaboration server disconnected. Local edits will sync when it reconnects.",
      })),
    });

    handlers.onDisconnect();

    expect(options.setStatus).toHaveBeenCalledWith("reconnecting");
    expect(options.clearCollaborators).toHaveBeenCalled();
    expect(options.publishCollaborators).toHaveBeenCalled();
    expect(options.markOffline).toHaveBeenCalledWith("disconnect");
    expect(options.emitRecoveryEvent).toHaveBeenCalledWith(
      "invalid-message",
      "The collaboration server disconnected. Local edits will sync when it reconnects.",
    );
  });

  it("reports connect errors through the session state", () => {
    const { options, handlers } = createHarness({
      markOffline: vi.fn(() => ({
        status: "failed" as const,
        notify: true,
        message: "The collaboration server is not reachable. Local edits stay in this browser.",
      })),
    });

    handlers.onConnectError();

    expect(options.setStatus).toHaveBeenCalledWith("failed");
    expect(options.markOffline).toHaveBeenCalledWith("connect-error");
    expect(options.emitRecoveryEvent).toHaveBeenCalledWith(
      "invalid-message",
      "The collaboration server is not reachable. Local edits stay in this browser.",
    );
  });
});
