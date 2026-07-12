import { describe, expect, it, vi } from "vitest";
import type { WorkspaceRoomRuntime } from "../../collaboration/liveCollaboration";
import { createRoomWorkspaceSession } from "./WorkspaceSession";
import { createWorkspaceSessionHost } from "./WorkspaceSessionHost";

const room = (roomId: string) => ({ roomId, shareUrl: `https://tabula.test/#room=${roomId},${"A".repeat(43)}` });
const runtime = () => ({ disconnect: vi.fn() }) as unknown as WorkspaceRoomRuntime;

describe("WorkspaceSessionHost", () => {
  it("publishes runtime attachment and detachment through the room session", () => {
    const session = createRoomWorkspaceSession(room("runtime"));
    const attachedRuntime = runtime();
    const listener = vi.fn();
    const unsubscribe = session.subscribeRuntime(listener);

    const detach = session.attachRuntime(attachedRuntime);

    expect(session.getRuntime()).toBe(attachedRuntime);
    expect(listener).toHaveBeenCalledTimes(1);

    detach();
    detach();

    expect(session.getRuntime()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(attachedRuntime.disconnect).not.toHaveBeenCalled();

    unsubscribe();
    session.attachRuntime(attachedRuntime);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("disconnects the previous runtime once when a room replaces it", () => {
    const session = createRoomWorkspaceSession(room("replace"));
    const firstRuntime = runtime();
    const secondRuntime = runtime();

    const detachFirst = session.attachRuntime(firstRuntime);
    session.attachRuntime(secondRuntime);
    detachFirst();

    expect(firstRuntime.disconnect).toHaveBeenCalledTimes(1);
    expect(secondRuntime.disconnect).not.toHaveBeenCalled();
    expect(session.getRuntime()).toBe(secondRuntime);

    session.dispose();
    expect(secondRuntime.disconnect).toHaveBeenCalledTimes(1);
  });

  it("owns exactly one session and disposes an attached room runtime on replacement", () => {
    const firstSession = createRoomWorkspaceSession(room("first"));
    const firstRuntime = runtime();
    firstSession.attachRuntime(firstRuntime);
    const host = createWorkspaceSessionHost(firstSession);
    const listener = vi.fn();
    host.subscribe(listener);

    const localSession = host.openLocal();

    expect(localSession.mode).toBe("local");
    expect(firstRuntime.disconnect).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(host.getSnapshot()).toBe(localSession);
    host.dispose();
    host.dispose();
    expect(firstRuntime.disconnect).toHaveBeenCalledTimes(1);
  });

  it("disconnects a runtime attached after its room session was disposed", () => {
    const session = createRoomWorkspaceSession(room("disposed"));
    const disposedRuntime = runtime();

    session.dispose();
    session.attachRuntime(disposedRuntime);

    expect(disposedRuntime.disconnect).toHaveBeenCalledTimes(1);
  });
});
