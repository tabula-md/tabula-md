import { describe, expect, it, vi } from "vitest";
import { buildWorkspaceCommandRegistry } from "./workspaceCommandRegistry";

describe("workspace command registry", () => {
  it("keeps Search actions limited to creation and import entry points", () => {
    const commands = buildWorkspaceCommandRegistry({
      actions: {
        importFile: vi.fn(),
        importWorkspace: vi.fn(),
        newFile: vi.fn(),
        newFolder: vi.fn(),
      },
      language: "en",
    });

    expect(commands.map(({ id }) => id)).toEqual([
      "document.new",
      "document.new-folder",
      "document.import",
      "workspace.import",
    ]);
  });
});
