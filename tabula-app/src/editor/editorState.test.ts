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

  it("removes pre-session CodeMirror history when Yjs becomes authoritative", () => {
    const collaboration = new Compartment();
    const editorHistory = new Compartment();
    let state = EditorState.create({
      doc: "A",
      extensions: [editorHistory.of(history()), collaboration.of([])],
    });
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
      effects: [
        editorHistory.reconfigure([]),
        collaboration.reconfigure(createEditorCollaborationExtensions(binding)),
      ],
    }).state;
    text.insert(2, "C");

    expect(undoDepth(state)).toBe(0);
    expect(getCollaborationEditorHistoryState(state, binding)).toEqual({
      canUndo: true,
      canRedo: false,
    });

    awareness.destroy();
    undoManager.destroy();
    doc.destroy();
  });

  it("never falls back to CodeMirror redo while Yjs owns history", () => {
    let state = EditorState.create({ doc: "A", extensions: history() });
    state = state.update({ changes: { from: 1, insert: "B" } }).state;
    const view = createStateOnlyEditorView(state);
    expect(undo(view)).toBe(true);
    expect(redoDepth(view.state)).toBe(1);

    const doc = new Y.Doc();
    const text = doc.getText("document");
    const undoManager = new Y.UndoManager(text);
    expect(redoCollaborationHistory(view, { undoManager })).toBe(false);
    expect(view.state.doc.toString()).toBe("A");

    text.insert(0, "Y");
    expect(undoManager.undo()).not.toBeNull();

    expect(redoCollaborationHistory(view, { undoManager })).toBe(true);
    expect(view.state.doc.toString()).toBe("A");
    expect(text.toString()).toBe("Y");

    expect(redoCollaborationHistory(view, { undoManager })).toBe(false);

    undoManager.destroy();
    doc.destroy();
  });
});
