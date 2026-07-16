import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createWorkspaceRoomBootstrap } from "./workspaceRoomBootstrap";
import { createWorkspaceRoomCrdt, getWorkspaceRoomSnapshot } from "./workspaceRoomCrdt";

describe("workspace Room bootstrap", () => {
  it("creates one validated Yjs update that another Room participant can hydrate", () => {
    const { update } = createWorkspaceRoomBootstrap({
      roomId: "room-bootstrap",
      folders: [{ id: "research", title: "Research", parentId: "workspace-root" }],
      documents: [{
        id: "brief",
        title: "Brief.md",
        markdown: "# Brief\n",
        parentId: "research",
      }],
    });
    const restoredDoc = new Y.Doc();
    const restoredRoom = createWorkspaceRoomCrdt({
      roomId: "room-bootstrap",
      doc: restoredDoc,
      initialize: false,
    });

    Y.applyUpdate(restoredDoc, update);

    expect(getWorkspaceRoomSnapshot(restoredRoom)).toMatchObject({
      documents: { brief: "# Brief\n" },
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: "research", type: "folder" }),
        expect.objectContaining({ id: "brief", type: "document", parentId: "research" }),
      ]),
    });
    restoredDoc.destroy();
  });
});
