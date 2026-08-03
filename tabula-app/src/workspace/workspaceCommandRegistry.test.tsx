import { describe, expect, it, vi } from "vitest";
import { buildWorkspaceCommandRegistry } from "./workspaceCommandRegistry";

const createActions = () => ({
  closeActiveFile: vi.fn(),
  closeAllFiles: vi.fn(),
  closeOtherFiles: vi.fn(),
  duplicateActiveFile: vi.fn(),
  exportActiveFile: vi.fn(),
  exportWorkspace: vi.fn(),
  importFile: vi.fn(),
  importWorkspace: vi.fn(),
  newFile: vi.fn(),
  newFolder: vi.fn(),
  openDocumentSearch: vi.fn(),
  openLeftPanel: vi.fn(),
  openRightPanel: vi.fn(),
  reopenLastClosedFile: vi.fn(),
  toggleWorkspaceMenu: vi.fn(),
});

describe("workspace command registry", () => {
  it("exposes document, workspace, and panel commands from one registry", () => {
    const commands = buildWorkspaceCommandRegistry({
      actions: createActions(),
      activeFileId: "doc-1",
      fileCount: 3,
      hasLastClosedFile: true,
      language: "en",
      openFileCount: 2,
    });

    expect(commands).toHaveLength(20);
    expect(new Set(commands.map(({ id }) => id)).size).toBe(commands.length);
    expect(commands.map(({ id }) => id)).toEqual(expect.arrayContaining([
      "document.new",
      "document.find",
      "document.close-others",
      "workspace.import",
      "workspace.export",
      "panel.files",
      "panel.libraries",
      "panel.outline",
      "panel.comments",
      "panel.metadata",
    ]));
    expect(new Set(commands.map(({ category }) => category))).toEqual(
      new Set(["Document", "Workspace", "View"]),
    );
  });

  it("marks commands that need document context unavailable", () => {
    const commands = buildWorkspaceCommandRegistry({
      actions: createActions(),
      fileCount: 0,
      hasLastClosedFile: false,
      language: "en",
      openFileCount: 0,
    });
    const byId = new Map(commands.map((command) => [command.id, command]));

    expect(byId.get("document.new")?.enabled).not.toBe(false);
    expect(byId.get("document.export")?.enabled).toBe(false);
    expect(byId.get("document.close")?.enabled).toBe(false);
    expect(byId.get("document.reopen-closed")?.enabled).toBe(false);
    expect(byId.get("workspace.export")?.enabled).toBe(false);
    expect(byId.get("panel.outline")?.enabled).toBe(false);
    expect(byId.get("panel.files")?.enabled).not.toBe(false);
  });

  it("routes panel commands through the shared workspace actions", () => {
    const actions = createActions();
    const commands = buildWorkspaceCommandRegistry({
      actions,
      activeFileId: "doc-1",
      fileCount: 1,
      hasLastClosedFile: false,
      language: "en",
      openFileCount: 1,
    });

    commands.find(({ id }) => id === "panel.libraries")?.onSelect();
    commands.find(({ id }) => id === "panel.comments")?.onSelect();

    expect(actions.openLeftPanel).toHaveBeenCalledWith("libraries");
    expect(actions.openRightPanel).toHaveBeenCalledWith("comments");
  });
});
