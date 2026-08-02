import { describe, expect, it } from "vitest";
import {
  getWorkspaceRenameDisplayTitle,
  restoreWorkspaceRenameExtension,
} from "./workspaceRenameTitle";

describe("workspace rename titles", () => {
  it("hides and restores Markdown extensions", () => {
    expect(getWorkspaceRenameDisplayTitle("Plan.md")).toBe("Plan");
    expect(restoreWorkspaceRenameExtension("Plan.md", "Roadmap")).toBe("Roadmap.md");
    expect(restoreWorkspaceRenameExtension("Plan.MDX", "Roadmap")).toBe("Roadmap.MDX");
  });

  it("does not duplicate a Markdown extension typed into the field", () => {
    expect(restoreWorkspaceRenameExtension("Plan.md", "Roadmap.md")).toBe("Roadmap.md");
  });

  it("keeps asset names and hidden Markdown filenames literal", () => {
    expect(getWorkspaceRenameDisplayTitle("schema.json")).toBe("schema.json");
    expect(restoreWorkspaceRenameExtension("schema.json", "model.json")).toBe("model.json");
    expect(getWorkspaceRenameDisplayTitle(".instructions.md")).toBe(".instructions.md");
    expect(restoreWorkspaceRenameExtension(".instructions.md", ".rules.md")).toBe(".rules.md");
  });

  it("lets empty input reach the existing validation unchanged", () => {
    expect(restoreWorkspaceRenameExtension("Plan.md", "   ")).toBe("   ");
  });
});
