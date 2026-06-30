import { describe, expect, it } from "vitest";
import { createCollabSessionState } from "./collabSessionState";

describe("collaboration session state", () => {
  it("does not report reconnect on the first successful join", () => {
    const state = createCollabSessionState();

    expect(state.markJoined()).toEqual({ reconnected: false });
  });

  it("reports reconnect after a previous successful join", () => {
    const state = createCollabSessionState();
    state.markJoined();

    expect(state.markJoined()).toEqual({
      reconnected: true,
      message: "Connection restored and room state was resynced.",
    });
  });

  it("reports disconnect only after the room connected once", () => {
    const state = createCollabSessionState();

    expect(state.markOffline("disconnect")).toEqual({ notify: false });
    state.markJoined();

    expect(state.markOffline("disconnect")).toEqual({
      notify: true,
      message: "The collaboration server disconnected. Local edits will sync when it reconnects.",
    });
    expect(state.markOffline("disconnect")).toEqual({ notify: false });
  });

  it("reports connect errors once until a successful join resets the notification", () => {
    const state = createCollabSessionState();

    expect(state.markOffline("connect-error")).toEqual({
      notify: true,
      message: "The collaboration server is not reachable. Local edits stay in this browser.",
    });
    expect(state.markOffline("connect-error")).toEqual({ notify: false });

    state.markJoined();
    expect(state.markOffline("connect-error")).toEqual({
      notify: true,
      message: "The collaboration server is not reachable. Local edits stay in this browser.",
    });
  });

  it("suppresses offline notifications after collaboration is blocked", () => {
    const state = createCollabSessionState();

    state.markJoinBlocked();

    expect(state.isBlocked()).toBe(true);
    expect(state.markOffline("connect-error")).toEqual({ notify: false });
  });
});
