import { describe, expect, it } from "vitest";
import {
  createRoomActor,
  createRoomActorColor,
  createRoomActorName,
  normalizeRoomCapabilities,
  parseRoomActor,
} from "./roomCollaboration";

describe("room actor contract", () => {
  it("uses the same direct-edit capabilities for people and agents", () => {
    expect(createRoomActor({ id: "human-1", name: "Ada" })).toMatchObject({
      kind: "human",
      client: "tabula-md",
      capabilities: ["presence", "read", "write"],
    });
    expect(createRoomActor({ id: "agent-1", kind: "agent" })).toMatchObject({
      kind: "agent",
      client: "tabula-mcp",
      capabilities: ["presence", "read", "write"],
    });
  });

  it("derives stable names and colors from the actor id", () => {
    expect(createRoomActorName("human", "human-1")).toMatch(/ Human$/);
    expect(createRoomActorName("agent", "agent-1")).toMatch(/ Agent$/);
    expect(createRoomActorName("human", "human-1")).toBe(
      createRoomActorName("human", "human-1"),
    );
    expect(createRoomActorColor("human-1")).toBe(createRoomActorColor("human-1"));
  });

  it("preserves the official CLI client identity", () => {
    const actor = createRoomActor({ id: "cli-1", kind: "agent", client: "tabula-cli" });
    expect(parseRoomActor(actor)?.client).toBe("tabula-cli");
  });

  it("parses only the binary protocol awareness actor shape", () => {
    const actor = createRoomActor({
      id: "peer-1",
      name: "Ada",
      joinedAt: "2026-07-09T00:00:00.000Z",
    });
    expect(parseRoomActor(actor)).toEqual(actor);
    expect(parseRoomActor({ ...actor, color: undefined })).toEqual({
      ...actor,
      color: createRoomActorColor(actor.id),
    });
    expect(parseRoomActor({ ...actor, capabilities: ["comment"] })).toBeNull();
    expect(parseRoomActor({ ...actor, color: "white" })).toBeNull();
    expect(parseRoomActor({ ...actor, name: "x".repeat(41) })).toBeNull();
    expect(parseRoomActor({ ...actor, joinedAt: "not-a-date" })).toBeNull();
    expect(parseRoomActor({ id: "peer-1" })).toBeNull();
  });

  it("defaults missing capabilities but rejects unsupported wire capabilities", () => {
    expect(normalizeRoomCapabilities(undefined)).toEqual(["presence", "read", "write"]);
    expect(normalizeRoomCapabilities(["presence", "comment", "write"])).toEqual([
      "presence",
      "write",
    ]);
  });
});
