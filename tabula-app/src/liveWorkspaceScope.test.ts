import { describe, expect, it } from "vitest";
import { getLiveFolderScope, getLiveWorkspaceFileIds } from "./liveWorkspaceScope";

const file = (id: string, roomId?: string) => ({ id, roomId });

describe("live workspace scope", () => {
  it("marks files that are actually in the active live room", () => {
    expect(
      getLiveWorkspaceFileIds({
        roomId: "room-1",
        files: [file("a", "room-1"), file("b"), file("c", "room-1")],
        isLive: true,
      }),
    ).toEqual(["a", "c"]);
  });

  it("does not mark local files or files from another room", () => {
    expect(
      getLiveWorkspaceFileIds({
        roomId: "room-1",
        files: [file("a", "room-1"), file("b"), file("c", "room-2")],
        isLive: true,
      }),
    ).toEqual(["a"]);
  });

  it("does not mark files when live collaboration is inactive", () => {
    expect(
      getLiveWorkspaceFileIds({
        roomId: "room-1",
        files: [file("a"), file("b")],
        isLive: false,
      }),
    ).toEqual([]);
  });

  it("keeps the room scope while a private document is active", () => {
    expect(
      getLiveWorkspaceFileIds({
        roomId: "room-1",
        files: [file("shared", "room-1"), file("private")],
        isLive: true,
      }),
    ).toEqual(["shared"]);
  });

  it("distinguishes shared, private, and mixed folder contents", () => {
    const liveFileIds = new Set(["shared"]);

    expect(getLiveFolderScope({
      descendantFileIds: ["shared"],
      liveFileIds,
      isLive: true,
    })).toBe("shared");
    expect(getLiveFolderScope({
      descendantFileIds: ["private"],
      liveFileIds,
      isLive: true,
    })).toBe("private");
    expect(getLiveFolderScope({
      folderRoomId: "room-1",
      descendantFileIds: ["shared", "private"],
      liveFileIds,
      isLive: true,
    })).toBe("mixed");
    expect(getLiveFolderScope({
      folderRoomId: "room-1",
      descendantFileIds: [],
      liveFileIds,
      isLive: false,
    })).toBe("local");
  });
});
