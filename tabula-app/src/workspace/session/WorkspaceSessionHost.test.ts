import { describe, expect, it, vi } from "vitest";
import { createRoomWorkspaceSession } from "./WorkspaceSession";
import { createWorkspaceSessionHost } from "./WorkspaceSessionHost";

const room = (roomId: string) => ({ roomId, shareUrl: `https://tabula.test/#room=${roomId},${"A".repeat(43)}` });

describe("WorkspaceSessionHost", () => {
  it("owns exactly one session and disposes an attached room runtime on replacement", () => {
    const firstSession = createRoomWorkspaceSession(room("first"));
    const firstRuntime = { disconnect: vi.fn() };
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
    const runtime = { disconnect: vi.fn() };

    session.dispose();
    session.attachRuntime(runtime);

    expect(runtime.disconnect).toHaveBeenCalledTimes(1);
  });
});
