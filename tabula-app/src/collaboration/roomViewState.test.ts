import { describe, expect, it } from "vitest";
import {
  parseRoomViewState,
  readRoomViewState,
  restoreRoomWorkspaceView,
  writeRoomViewState,
} from "./roomViewState";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("room view state", () => {
  it("round-trips only tab-local document and panel state", () => {
    const storage = new MemoryStorage();
    writeRoomViewState("room-1", {
      activeDocumentId: "notes",
      openDocumentIds: ["readme", "notes"],
      rightPanelOpen: true,
      rightPanelView: "comments",
    }, storage);

    expect(readRoomViewState("room-1", storage)).toEqual({
      activeDocumentId: "notes",
      openDocumentIds: ["readme", "notes"],
      rightPanelOpen: true,
      rightPanelView: "comments",
    });
  });

  it("rejects malformed state instead of changing the room workspace", () => {
    expect(parseRoomViewState({ openDocumentIds: "all", rightPanelView: "files" })).toBeNull();
  });

  it("restores the links panel as tab-local room state", () => {
    expect(parseRoomViewState({
      openDocumentIds: ["readme"],
      rightPanelOpen: true,
      rightPanelView: "links",
    })).toMatchObject({ rightPanelOpen: true, rightPanelView: "links" });
  });

  it("restores valid tabs and falls back when the saved active document was deleted", () => {
    const workspace = {
      files: [{ id: "readme" }, { id: "notes" }],
      openFileIds: ["readme"],
      activeFileId: "readme",
    };
    expect(restoreRoomWorkspaceView(workspace, {
      activeDocumentId: "notes",
      openDocumentIds: ["notes", "deleted"],
      rightPanelOpen: false,
      rightPanelView: "files",
    })).toMatchObject({ activeFileId: "notes", openFileIds: ["notes"] });

    expect(restoreRoomWorkspaceView(workspace, {
      activeDocumentId: "deleted",
      openDocumentIds: ["deleted"],
      rightPanelOpen: false,
      rightPanelView: "files",
    })).toMatchObject({ activeFileId: "readme", openFileIds: ["readme"] });
  });

  it("restores an explicitly closed room view without opening a default document", () => {
    const workspace = {
      files: [{ id: "readme" }, { id: "notes" }],
      openFileIds: ["readme"],
      activeFileId: "readme",
    };

    expect(restoreRoomWorkspaceView(workspace, {
      openDocumentIds: [],
      rightPanelOpen: false,
      rightPanelView: "files",
    })).toMatchObject({ activeFileId: "", openFileIds: [] });
  });
});
