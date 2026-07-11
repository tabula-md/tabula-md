import { history, redoDepth, undo, undoDepth } from "@codemirror/commands";
import { Compartment, EditorState, type Transaction } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { Awareness } from "y-protocols/awareness";
import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { yCollab } from "y-codemirror.next";

import {
  createEditorCollaborationExtensions,
  getCollaborationEditorHistoryState,
  redoCollaborationHistory,
} from "./editorState";

const createStateOnlyEditorView = (initialState: EditorState) => {
  let state = initialState;
  return {
    get state() {
      return state;
    },
    dispatch(transaction: Transaction) {
      state = transaction.state;
    },
  } as EditorView;
};

describe("editor collaboration limits", () => {
  it("blocks oversized local edits but always admits a remote Y.Text projection", () => {
    const doc = new Y.Doc();
    const text = doc.getText("document");
    text.insert(0, "A");
    const awareness = new Awareness(doc);
    const undoManager = new Y.UndoManager(text);
    const canApplyTextByteDelta = vi.fn(() => false);
    const extensions = createEditorCollaborationExtensions({
      documentId: "document",
      extension: yCollab(text, awareness, { undoManager }),
      yText: text,
      awareness,
      undoManager,
      canApplyTextByteDelta,
    });
    const state = EditorState.create({ doc: "A", extensions });

    const blocked = state.update({ changes: { from: 1, insert: "🙂" } });
    expect(blocked.newDoc.toString()).toBe("A");
    expect(canApplyTextByteDelta).toHaveBeenCalledWith(4);

    text.insert(1, "B");
    const remote = state.update({ changes: { from: 1, insert: "B" } });
    expect(remote.newDoc.toString()).toBe("AB");

    awareness.destroy();
    undoManager.destroy();
    doc.destroy();
  });

  it("uses the runtime remote projection marker before checking document content", () => {
    const doc = new Y.Doc();
    const text = doc.getText("document");
    text.insert(0, "A");
    const awareness = new Awareness(doc);
    const undoManager = new Y.UndoManager(text);
    const canApplyTextByteDelta = vi.fn(() => false);
    const consumeRemoteProjection = vi.fn(() => true);
    const state = EditorState.create({
      doc: "A",
      extensions: createEditorCollaborationExtensions({
        documentId: "document",
        extension: yCollab(text, awareness, { undoManager }),
        yText: text,
        awareness,
        undoManager,
        canApplyTextByteDelta,
        consumeRemoteProjection,
      }),
    });

    expect(state.update({ changes: { from: 0, to: 1, insert: "B" } }).newDoc.toString()).toBe("B");
    expect(consumeRemoteProjection).toHaveBeenCalledTimes(1);
    expect(canApplyTextByteDelta).not.toHaveBeenCalled();

    awareness.destroy();
    undoManager.destroy();
    doc.destroy();
  });

  it("keeps pre-session CodeMirror undo history while Yjs owns new edits", () => {
    const collaboration = new Compartment();
    let state = EditorState.create({ doc: "A", extensions: [history(), collaboration.of([])] });
    state = state.update({ changes: { from: 1, insert: "B" } }).state;
    expect(undoDepth(state)).toBe(1);

    const doc = new Y.Doc();
    const text = doc.getText("document");
    text.insert(0, "AB");
    const awareness = new Awareness(doc);
    const undoManager = new Y.UndoManager(text);
    const binding = {
      documentId: "document",
      extension: yCollab(text, awareness, { undoManager }),
      yText: text,
      awareness,
      undoManager,
      canApplyTextByteDelta: () => true,
    };
    state = state.update({
      effects: collaboration.reconfigure(createEditorCollaborationExtensions(binding)),
    }).state;
    state = state.update({ changes: { from: 2, insert: "C" } }).state;

    expect(undoDepth(state)).toBe(1);
    expect(getCollaborationEditorHistoryState(state, binding)).toEqual({
      canUndo: true,
      canRedo: false,
    });

    awareness.destroy();
    undoManager.destroy();
    doc.destroy();
  });

  it("reports collaborative redo only when CodeMirror or Yjs applies a change", () => {
    let state = EditorState.create({ doc: "A", extensions: history() });
    state = state.update({ changes: { from: 1, insert: "B" } }).state;
    const view = createStateOnlyEditorView(state);
    expect(undo(view)).toBe(true);
    expect(redoDepth(view.state)).toBe(1);

    const doc = new Y.Doc();
    const text = doc.getText("document");
    const undoManager = new Y.UndoManager(text);
    text.insert(0, "Y");
    expect(undoManager.undo()).not.toBeNull();

    expect(redoCollaborationHistory(view, { undoManager })).toBe(true);
    expect(view.state.doc.toString()).toBe("AB");
    expect(text.toString()).toBe("");

    expect(redoCollaborationHistory(view, { undoManager })).toBe(true);
    expect(text.toString()).toBe("Y");

    expect(redoCollaborationHistory(view, { undoManager })).toBe(false);

    undoManager.destroy();
    doc.destroy();
  });
});
