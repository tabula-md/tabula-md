import { describe, expect, it } from "vitest";
import {
  getWorkspaceShellSize,
  workspaceShellUsesExclusivePanels,
  workspaceShellUsesOverlayPanels,
} from "./workspaceShellLayout";

describe("workspace shell layout", () => {
  it("classifies viewport boundaries once for the whole shell", () => {
    expect(getWorkspaceShellSize(1440)).toBe("wide");
    expect(getWorkspaceShellSize(1161)).toBe("wide");
    expect(getWorkspaceShellSize(1160)).toBe("compact");
    expect(getWorkspaceShellSize(561)).toBe("compact");
    expect(getWorkspaceShellSize(560)).toBe("narrow");
  });

  it("uses overlay panels outside the wide shell", () => {
    expect(workspaceShellUsesOverlayPanels("wide")).toBe(false);
    expect(workspaceShellUsesOverlayPanels("compact")).toBe(false);
    expect(workspaceShellUsesOverlayPanels("narrow")).toBe(true);
  });

  it("keeps both panels only when the document lane is wide", () => {
    expect(workspaceShellUsesExclusivePanels("wide")).toBe(false);
    expect(workspaceShellUsesExclusivePanels("compact")).toBe(true);
    expect(workspaceShellUsesExclusivePanels("narrow")).toBe(true);
  });
});
