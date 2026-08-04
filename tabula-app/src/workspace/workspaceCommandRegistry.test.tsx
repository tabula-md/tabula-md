import { describe, expect, it, vi } from "vitest";
import { buildWorkspaceCommandRegistry } from "./workspaceCommandRegistry";

describe("workspace command registry", () => {
  it("keeps document actions and settings in explicit sections", () => {
    const commands = buildWorkspaceCommandRegistry({
      actions: {
        importFile: vi.fn(),
        importWorkspace: vi.fn(),
        newFile: vi.fn(),
        newFolder: vi.fn(),
        openPreferences: vi.fn(),
      },
      language: "en",
    });

    expect(commands.map(({ id }) => id)).toEqual([
      "document.new",
      "document.new-folder",
      "document.import",
      "workspace.import",
      "settings.preferences",
    ]);
    expect(commands.map(({ section }) => section)).toEqual([
      "commands",
      "commands",
      "commands",
      "commands",
      "settings",
    ]);
  });
});
