import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  applyLocalTextToYText,
  applyRemoteUpdateToYText,
  applyTextPatchesToYText,
  COLLAB_REMOTE_ORIGIN,
  createCollabTextDocument,
  getTextChangeResult,
} from "./collabTextModel";

describe("collaboration text model", () => {
  it("creates a markdown Yjs document with optional initial text", () => {
    const { text } = createCollabTextDocument("# Title\n\nHello");

    expect(text.toString()).toBe("# Title\n\nHello");
  });

  it("applies CodeMirror-style patches in old-document coordinates", () => {
    const { doc, text } = createCollabTextDocument("alpha\nbeta\ngamma");

    applyTextPatchesToYText({
      doc,
      text,
      patches: [
        { from: 0, to: 5, insert: "ALPHA" },
        { from: 11, to: 16, insert: "GAMMA" },
      ],
    });

    expect(text.toString()).toBe("ALPHA\nbeta\nGAMMA");
  });

  it("uses preferred local patches when they recreate the requested text", () => {
    const { doc, text } = createCollabTextDocument("one two");

    applyLocalTextToYText({
      doc,
      text,
      nextText: "one\ntwo",
      patches: [{ from: 3, to: 4, insert: "\n" }],
    });

    expect(text.toString()).toBe("one\ntwo");
  });

  it("falls back to a safe diff patch when preferred patches are stale", () => {
    const { doc, text } = createCollabTextDocument("abc");

    applyLocalTextToYText({
      doc,
      text,
      nextText: "abXc",
      patches: [{ from: 0, to: 1, insert: "X" }],
    });

    expect(text.toString()).toBe("abXc");
  });

  it("reports remote text changes with patches", () => {
    const { doc, text } = createCollabTextDocument("hello");
    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));
    remote.getText("markdown").insert(5, "\nremote");
    const update = Y.encodeStateAsUpdate(remote);
    const origins: unknown[] = [];
    doc.on("update", (_update: Uint8Array, origin: unknown) => {
      origins.push(origin);
    });

    expect(applyRemoteUpdateToYText({ doc, text, update })).toEqual({
      text: "hello\nremote",
      change: {
        patches: [{ from: 5, to: 5, insert: "\nremote" }],
      },
    });
    expect(origins).toContain(COLLAB_REMOTE_ORIGIN);
  });

  it("does not emit a text change for unchanged text", () => {
    const { text } = createCollabTextDocument("same");

    expect(getTextChangeResult(text, "same")).toBeNull();
  });
});
