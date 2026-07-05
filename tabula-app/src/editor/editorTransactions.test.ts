import { EditorState, Transaction } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { isRemoteEditorUpdate } from "./editorTransactions";

describe("editor transactions", () => {
  it("treats only all-remote document changes as external updates", () => {
    const state = EditorState.create({ doc: "hello" });
    const remoteChange = state.update({
      changes: { from: 5, insert: " remote" },
      annotations: Transaction.remote.of(true),
    });
    const localChange = state.update({
      changes: { from: 5, insert: " local" },
    });
    const remoteSelection = state.update({
      selection: { anchor: 1 },
      annotations: Transaction.remote.of(true),
    });

    expect(isRemoteEditorUpdate([remoteChange])).toBe(true);
    expect(isRemoteEditorUpdate([localChange])).toBe(false);
    expect(isRemoteEditorUpdate([remoteChange, localChange])).toBe(false);
    expect(isRemoteEditorUpdate([remoteSelection])).toBe(false);
  });
});
