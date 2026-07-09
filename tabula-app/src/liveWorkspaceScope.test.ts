import { describe, expect, it } from "vitest";
import { getLiveWorkspaceFileIds } from "./liveWorkspaceScope";

const file = (id: string, roomId?: string) => ({ id, roomId });

describe("live workspace scope", () => {
  it("marks included workspace files while leaving excluded files local", () => {
    expect(
      getLiveWorkspaceFileIds({
        activeFile: { id: "a", roomId: "room-1" },
        excludedFileIds: ["b"],
        files: [file("a"), file("b"), file("c")],
        isLive: true,
      }),
    ).toEqual(["a", "c"]);
  });

  it("keeps all non-excluded workspace files in scope even if older files do not yet store room ids", () => {
    expect(
      getLiveWorkspaceFileIds({
        activeFile: { id: "a", roomId: "room-1" },
        excludedFileIds: [],
        files: [file("a", "room-1"), file("b"), file("c", "room-2")],
        isLive: true,
      }),
    ).toEqual(["a", "b", "c"]);
  });

  it("does not mark files when live collaboration is inactive", () => {
    expect(
      getLiveWorkspaceFileIds({
        activeFile: { id: "a", roomId: "room-1" },
        excludedFileIds: [],
        files: [file("a"), file("b")],
        isLive: false,
      }),
    ).toEqual([]);
  });
});
