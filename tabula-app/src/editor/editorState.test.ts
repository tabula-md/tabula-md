import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { Awareness } from "y-protocols/awareness";
import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";

import { createEditorCollaborationExtensions } from "./editorState";

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
      extension: [
        yCollab(text, awareness, { undoManager }),
        keymap.of(yUndoManagerKeymap),
      ],
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
        extension: [yCollab(text, awareness, { undoManager }), keymap.of(yUndoManagerKeymap)],
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
});
