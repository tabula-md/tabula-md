import { describe, expect, it, vi } from "vitest";
import { createCollabTransportHandlers } from "./collabTransportController";

const createHarness = (overrides: Partial<Parameters<typeof createCollabTransportHandlers>[0]> = {}) => {
  const options: Parameters<typeof createCollabTransportHandlers>[0] = {
    isClosed: vi.fn(() => false),
    markJoined: vi.fn(() => ({ reconnected: false as const })),
    markOffline: vi.fn(() => ({
      status: "failed" as const,
      notify: false as const,
    })),
    setStatus: vi.fn(),
    emitCurrentState: vi.fn(async () => {}),
    publishPresence: vi.fn(async () => {}),
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

  it("ignores lifecycle socket events after the client closes the connection", async () => {
    const { options, handlers } = createHarness({
      isClosed: vi.fn(() => true),
    });

    handlers.onConnect();
    await handlers.onJoined({ roomId: "room-1", clientId: "self", peerCount: 0 });
    handlers.onDisconnect();
    handlers.onConnectError();

    expect(options.setStatus).not.toHaveBeenCalled();
    expect(options.clearCollaborators).not.toHaveBeenCalled();
    expect(options.emitCurrentState).not.toHaveBeenCalled();
    expect(options.publishPresence).not.toHaveBeenCalled();
  });

  it("publishes presence and current workspace state after joining", async () => {
    const { options, handlers } = createHarness();

    await handlers.onJoined({ roomId: "room-1", clientId: "self", peerCount: 0 });

    expect(options.setStatus).toHaveBeenCalledWith("connected");
    expect(options.markJoined).toHaveBeenCalled();
    expect(options.publishPresence).toHaveBeenCalled();
    expect(options.emitCurrentState).toHaveBeenCalled();
  });

  it("emits a recovery event when a previous socket session reconnects", async () => {
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
    const envelope = { kind: "room-event" };

    handlers.onMessage(envelope);

    expect(options.routeEnvelope).toHaveBeenCalledWith(envelope);
  });

  it("publishes presence and current workspace state when a peer joins", async () => {
    const { options, handlers } = createHarness();

    handlers.onPeerJoined({ roomId: "room-1", clientId: "remote" });
    await Promise.resolve();

    expect(options.publishPresence).toHaveBeenCalled();
    expect(options.emitCurrentState).toHaveBeenCalled();
  });

  it("publishes collaborators only when the peer list changes", () => {
    const { options, handlers } = createHarness({
      pruneCollaborators: vi.fn(() => true),
    });

    handlers.onPeers({ roomId: "room-1", peers: ["remote"] });

    expect(options.publishCollaborators).toHaveBeenCalled();
  });

  it("resyncs workspace state and presence after receiving a multi-peer room list", async () => {
    const { options, handlers } = createHarness();

    handlers.onPeers({ roomId: "room-1", peers: ["self", "remote"] });
    await Promise.resolve();

    expect(options.publishPresence).toHaveBeenCalledTimes(1);
    expect(options.emitCurrentState).toHaveBeenCalledTimes(1);
  });

  it("does not resync workspace state for an unchanged multi-peer room list", async () => {
    const { options, handlers } = createHarness();

    handlers.onPeers({ roomId: "room-1", peers: ["self", "remote"] });
    handlers.onPeers({ roomId: "room-1", peers: ["remote", "self"] });
    await Promise.resolve();

    expect(options.publishPresence).toHaveBeenCalledTimes(1);
    expect(options.emitCurrentState).toHaveBeenCalledTimes(1);
  });

  it("does not resync state for a room list containing only self", () => {
    const { options, handlers } = createHarness();

    handlers.onPeers({ roomId: "room-1", peers: ["self"] });

    expect(options.publishPresence).not.toHaveBeenCalled();
    expect(options.emitCurrentState).not.toHaveBeenCalled();
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
