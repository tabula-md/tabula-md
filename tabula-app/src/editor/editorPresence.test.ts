import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { mapEditorPresenceStateThroughTransaction } from "./editorPresence";

describe("editor presence mapping", () => {
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
