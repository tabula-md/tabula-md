import { describe, expect, it } from "vitest";
import type { Collaborator } from "./liveCollaboration";
import { canFollowActor, IDLE_FOLLOW_STATE, toggleFollowState } from "./followModel";

const collaborator = (id: string, followingActorId?: string): Collaborator => ({
  id,
  name: id,
  color: "#2563eb",
  lastSeen: 0,
  followingActorId,
});

describe("follow model", () => {
  it("starts and toggles an explicit follow target", () => {
    expect(toggleFollowState(IDLE_FOLLOW_STATE, "b")).toEqual({ status: "following", actorId: "b" });
    expect(toggleFollowState({ status: "following", actorId: "b" }, "b")).toEqual(IDLE_FOLLOW_STATE);
  });

  it("rejects self-follow and cyclic follow chains", () => {
    expect(canFollowActor({ actorId: "a", selfId: "a", collaborators: [collaborator("a")] })).toBe(false);
    expect(canFollowActor({
      actorId: "b",
      selfId: "a",
      collaborators: [collaborator("b", "c"), collaborator("c", "a")],
    })).toBe(false);
    expect(canFollowActor({
      actorId: "b",
      selfId: "a",
      collaborators: [collaborator("b", "c"), collaborator("c")],
    })).toBe(true);
  });
});
