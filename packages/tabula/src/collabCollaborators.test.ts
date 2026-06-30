import { describe, expect, it } from "vitest";
import { createCollaboratorRegistry } from "./collabCollaborators";

describe("collaborator registry", () => {
  it("ignores the local collaborator and sorts remote collaborators", () => {
    const registry = createCollaboratorRegistry();

    expect(registry.upsert({ id: "self", name: "Self", color: "#111", lastSeen: 1 }, "self")).toBe(false);
    expect(registry.upsert({ id: "2", name: "Grace", color: "#222", lastSeen: 2 }, "self")).toBe(true);
    expect(registry.upsert({ id: "1", name: "Ada", color: "#333", lastSeen: 3 }, "self")).toBe(true);

    expect(registry.list().map((collaborator) => collaborator.name)).toEqual(["Ada", "Grace"]);
  });

  it("prunes collaborators by active peer ids", () => {
    const registry = createCollaboratorRegistry();
    registry.upsert({ id: "1", name: "Ada", color: "#333", lastSeen: 3 }, "self");
    registry.upsert({ id: "2", name: "Grace", color: "#222", lastSeen: 2 }, "self");

    expect(registry.prune(["1"])).toBe(true);
    expect(registry.list().map((collaborator) => collaborator.id)).toEqual(["1"]);
    expect(registry.prune(["1"])).toBe(false);
  });
});
