import { describe, expect, it } from "vitest";
import { createCollaboratorRegistry } from "./collabCollaborators";

describe("collaboration collaborator registry", () => {
  it("stores collaborators sorted by name", () => {
    const registry = createCollaboratorRegistry();

    expect(
      registry.upsert({ id: "2", name: "Grace", color: "#111", lastSeen: 2 }, "self"),
    ).toBe(true);
    expect(
      registry.upsert({ id: "1", name: "Ada", color: "#222", lastSeen: 1 }, "self"),
    ).toBe(true);

    expect(registry.list().map((collaborator) => collaborator.name)).toEqual(["Ada", "Grace"]);
  });

  it("ignores the local collaborator identity", () => {
    const registry = createCollaboratorRegistry();

    expect(
      registry.upsert({ id: "self", name: "Taeha", color: "#763fc8", lastSeen: 1 }, "self"),
    ).toBe(false);

    expect(registry.list()).toEqual([]);
  });

  it("prunes collaborators that are no longer present in room peers", () => {
    const registry = createCollaboratorRegistry();
    registry.upsert({ id: "1", name: "Ada", color: "#111", lastSeen: 1 }, "self");
    registry.upsert({ id: "2", name: "Grace", color: "#222", lastSeen: 2 }, "self");

    expect(registry.prune(["2", "self"])).toBe(true);

    expect(registry.list()).toEqual([{ id: "2", name: "Grace", color: "#222", lastSeen: 2 }]);
    expect(registry.prune(["2", "self"])).toBe(false);
  });

  it("clears collaborators and reports whether it changed state", () => {
    const registry = createCollaboratorRegistry();

    expect(registry.clear()).toBe(false);
    registry.upsert({ id: "1", name: "Ada", color: "#111", lastSeen: 1 }, "self");

    expect(registry.clear()).toBe(true);
    expect(registry.list()).toEqual([]);
  });
});
