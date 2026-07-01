import { describe, expect, it } from "vitest";
import {
  createCollaboratorRegistry,
  mapCollaborationPositionThroughTextPatches,
  mapCollaborationSelectionThroughTextPatches,
} from "./collabCollaborators";

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

  it("remaps remote caret positions through local text patches", () => {
    expect(
      mapCollaborationPositionThroughTextPatches(
        6,
        [{ from: 0, to: 0, insert: "local " }],
        17,
      ),
    ).toBe(12);
    expect(
      mapCollaborationPositionThroughTextPatches(
        6,
        [{ from: 6, to: 6, insert: "local " }],
        17,
      ),
    ).toBe(6);
  });

  it("remaps remote selections through local text patches", () => {
    expect(
      mapCollaborationSelectionThroughTextPatches(
        { from: 0, to: 5 },
        [{ from: 0, to: 0, insert: "# " }],
        13,
      ),
    ).toEqual({ from: 0, to: 7 });
  });

  it("updates registered collaborator selections after local edits", () => {
    const registry = createCollaboratorRegistry();
    registry.upsert(
      {
        id: "remote",
        name: "Remote",
        color: "#333",
        lastSeen: 3,
        selection: { from: 6, to: 6 },
      },
      "self",
    );

    expect(registry.remapSelections([{ from: 0, to: 0, insert: "local " }], 17)).toBe(true);
    expect(registry.list()[0].selection).toEqual({ from: 12, to: 12 });
  });
});
