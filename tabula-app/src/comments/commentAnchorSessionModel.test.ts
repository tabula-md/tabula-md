import { describe, expect, it } from "vitest";
import { mapSessionCommentAnchors } from "./commentAnchorSessionModel";
import type { FileComment } from "../workspace/workspaceStorage";

const comment: FileComment = {
  id: "comment-1",
  body: "Review",
  selectionStart: 2,
  selectionEnd: 5,
  resolved: false,
  replies: [],
  createdAt: "2026-07-12T00:00:00.000Z",
};

describe("session comment anchors", () => {
  it("never patch-maps Room offsets resolved from Y.RelativePosition", () => {
    const comments = [comment];
    expect(mapSessionCommentAnchors({
      comments,
      isRoomSession: true,
      oldDocumentLength: 8,
      patches: [{ from: 0, to: 0, insert: "new " }],
    })).toBe(comments);
  });

  it("continues mapping local numeric anchors", () => {
    expect(mapSessionCommentAnchors({
      comments: [comment],
      isRoomSession: false,
      oldDocumentLength: 8,
      patches: [{ from: 0, to: 0, insert: "new " }],
    })[0]).toMatchObject({ selectionStart: 6, selectionEnd: 9 });
  });
});
