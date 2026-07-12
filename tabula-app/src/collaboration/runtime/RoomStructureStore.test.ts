import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  createWorkspaceRoomCrdt,
  initializeWorkspaceRoomCrdt,
  renameWorkspaceRoomNode,
  WORKSPACE_ROOM_ROOT_ID,
} from "@tabula-md/tabula";
import { createRoomStructureStore } from "./RoomStructureStore";

describe("room structure store", () => {
  it("publishes metadata changes without reading Markdown bodies", () => {
    const room = createWorkspaceRoomCrdt({ roomId: "room" });
    initializeWorkspaceRoomCrdt(room, {
      nodes: [{
        id: "doc",
        type: "document",
        title: "README.md",
        parentId: WORKSPACE_ROOM_ROOT_ID,
        markdown: "# Body",
      }],
    });
    const text = room.documents.get("doc") as Y.Text & { toString(): string };
    const toString = vi.spyOn(text, "toString");
    const store = createRoomStructureStore(room);
    const listener = vi.fn();
    store.subscribe(listener);

    renameWorkspaceRoomNode(room, "doc", "Guide.md");
    expect(store.refresh()).toBe(true);

    expect(store.getSnapshot().nodes.find((node) => node.id === "doc")?.title).toBe("Guide.md");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(toString).not.toHaveBeenCalled();
    expect(store.refresh()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    store.dispose();
    toString.mockRestore();
    room.doc.destroy();
  });
});
