import { describe, expect, it, vi } from "vitest";
import { createFollowStore } from "./FollowStore";

describe("FollowStore", () => {
  it("publishes stable session-local follow state and clears it on dispose", () => {
    const store = createFollowStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.start("human-2");
    store.start("human-2");
    expect(store.getSnapshot()).toEqual({ status: "following", actorId: "human-2" });
    expect(listener).toHaveBeenCalledTimes(1);

    store.stop();
    expect(store.getSnapshot()).toEqual({ status: "idle" });
    expect(listener).toHaveBeenCalledTimes(2);

    store.start("agent-1");
    store.dispose();
    expect(store.getSnapshot()).toEqual({ status: "idle" });
    store.start("human-3");
    expect(store.getSnapshot()).toEqual({ status: "idle" });
  });
});
