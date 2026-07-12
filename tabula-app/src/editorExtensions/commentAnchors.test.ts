import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  commentAnchorDecorationField,
  createCommentAnchorExtension,
  setCommentAnchorDecorations,
} from "./commentAnchors";

const copy = { activeComment: "Active comment", openComment: "Open comment" };

describe("comment anchor decorations", () => {
  it("replaces projected anchors through one StateEffect and maps subsequent edits", () => {
    let state = EditorState.create({
      doc: "alpha beta",
      extensions: [createCommentAnchorExtension([], null, copy)],
    });

    state = state.update({
      effects: setCommentAnchorDecorations.of({
        commentAnchors: [{ id: "comment-1", start: 6, end: 10 }],
        activeCommentId: "comment-1",
        copy,
      }),
    }).state;

    const projected: Array<{ from: number; to: number }> = [];
    state.field(commentAnchorDecorationField).between(0, state.doc.length, (from, to) => {
      projected.push({ from, to });
    });
    expect(projected).toEqual([{ from: 6, to: 10 }]);

    state = state.update({ changes: { from: 0, insert: "new " } }).state;
    const mapped: Array<{ from: number; to: number }> = [];
    state.field(commentAnchorDecorationField).between(0, state.doc.length, (from, to) => {
      mapped.push({ from, to });
    });
    expect(mapped).toEqual([{ from: 10, to: 14 }]);
  });
});
