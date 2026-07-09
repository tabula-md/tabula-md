import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  getRemoteCursorWidgetSide,
  getEditorPresenceSignature,
  mapEditorPresenceStateThroughTransaction,
  shouldRenderRemoteCursor,
} from "./editorPresence";

describe("editor presence mapping", () => {
  it("renders a remote cursor in an empty document before the placeholder", () => {
    expect(shouldRenderRemoteCursor({ anchor: 0, docLength: 0 })).toBe(true);
    expect(getRemoteCursorWidgetSide({ anchor: 0, docLength: 0 })).toBe(-1);
    expect(shouldRenderRemoteCursor({ anchor: 0, docLength: 1 })).toBe(true);
    expect(getRemoteCursorWidgetSide({ anchor: 0, docLength: 1 })).toBe(1);
  });

  it("includes the current document id in the presence signature", () => {
    const basePresence = {
      collaborators: [],
      currentFileTitle: "Untitled.md",
      currentRoomId: "room-1",
    };

    expect(
      getEditorPresenceSignature({ ...basePresence, currentDocumentId: "untitled" }),
    ).not.toBe(
      getEditorPresenceSignature({ ...basePresence, currentDocumentId: "untitled-2" }),
    );
  });

  it("clamps stale remote selections before mapping document changes", () => {
    const state = EditorState.create({ doc: "short text" });
    const transaction = state.update({
      changes: { from: 0, to: 0, insert: "prefix " },
    });

    const nextState = mapEditorPresenceStateThroughTransaction(
      {
        collaborators: [
          {
            id: "peer",
            name: "Peer",
            color: "#2563eb",
            lastSeen: 1,
            selection: { from: 1051, to: 1051 },
          },
        ],
      },
      transaction,
    );

    const selection = nextState.collaborators[0]?.selection;
    expect(selection?.from).toBeLessThanOrEqual(transaction.state.doc.length);
    expect(selection?.to).toBeLessThanOrEqual(transaction.state.doc.length);
  });
});
