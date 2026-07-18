import { describe, expect, it } from "vitest";
import {
  createEditorDocumentRuntime,
  createDocumentBufferTextState,
  createPendingDocumentBufferCommit,
  getDocumentBufferVisibleText,
  resolvePendingDocumentBufferText,
  shouldCancelPendingDocumentBufferCommit,
} from "./documentBuffer";

describe("document buffer", () => {
  it("uses committed text when there is no matching pending editor commit", () => {
    expect(
      getDocumentBufferVisibleText({
        committedText: "committed",
        fileId: "file-a",
        pendingCommit: createPendingDocumentBufferCommit("file-b", "pending"),
      }),
    ).toBe("committed");
  });

  it("uses pending inline text for the active file before workspace commit", () => {
    expect(
      getDocumentBufferVisibleText({
        committedText: "committed",
        fileId: "file-a",
        pendingCommit: createPendingDocumentBufferCommit("file-a", "pending"),
      }),
    ).toBe("pending");
  });

  it("resolves editor-owned pending text through a reader", () => {
    const pendingCommit = createPendingDocumentBufferCommit("file-a");

    expect(resolvePendingDocumentBufferText(pendingCommit, "committed", () => "editor text")).toBe("editor text");
    expect(resolvePendingDocumentBufferText(pendingCommit, "committed", () => null)).toBe("committed");
  });

  it("describes visible text state without making workspace text the only source of truth", () => {
    expect(
      createDocumentBufferTextState({
        committedText: "committed",
        fileId: "file-a",
        pendingCommit: createPendingDocumentBufferCommit("file-a", "pending"),
      }),
    ).toEqual({
      committedText: "committed",
      fileId: "file-a",
      pending: true,
      pendingTextAvailable: true,
      visibleText: "pending",
    });
  });

  it("only cancels known pending text when an external commit diverges", () => {
    expect(
      shouldCancelPendingDocumentBufferCommit(
        createPendingDocumentBufferCommit("file-a", "local pending"),
        { id: "file-a", text: "remote text" },
      ),
    ).toBe(true);
    expect(
      shouldCancelPendingDocumentBufferCommit(
        createPendingDocumentBufferCommit("file-a", "local pending"),
        { id: "file-a", text: "local pending" },
      ),
    ).toBe(false);
    expect(
      shouldCancelPendingDocumentBufferCommit(
        createPendingDocumentBufferCommit("file-a"),
        { id: "file-a", text: "remote text" },
      ),
    ).toBe(false);
  });
});

describe("editor document runtime", () => {
  it("tracks text, dirty state, revision, and flush boundaries", () => {
    const runtime = createEditorDocumentRuntime({ fileId: "file-a", text: "hello" });

    expect(runtime.getText()).toBe("hello");
    expect(runtime.getSnapshot()).toMatchObject({
      dirty: false,
      fileId: "file-a",
      pendingCommit: false,
      revision: 0,
      text: "hello",
    });

    runtime.replaceAll("hello world");

    expect(runtime.getText()).toBe("hello world");
    expect(runtime.getSnapshot()).toMatchObject({
      dirty: true,
      pendingCommit: true,
      pendingTextAvailable: true,
      revision: 1,
      text: "hello world",
    });
    expect(runtime.flush()).toEqual({
      fileId: "file-a",
      revision: 1,
      text: "hello world",
    });
    expect(runtime.getSnapshot()).toMatchObject({
      dirty: false,
      pendingCommit: false,
      committedText: "hello world",
    });
    expect(runtime.flush()).toBeNull();
  });

  it("applies text patches against the runtime text", () => {
    const runtime = createEditorDocumentRuntime({ fileId: "file-a", text: "alpha beta" });

    expect(runtime.applyPatch([{ from: 6, to: 10, insert: "gamma" }])).toBe(true);
    expect(runtime.getText()).toBe("alpha gamma");
    expect(runtime.applyPatch([{ from: 99, to: 100, insert: "x" }])).toBe(false);
    expect(runtime.getText()).toBe("alpha gamma");
  });

  it("resolves editor-owned pending text only at flush", () => {
    const runtime = createEditorDocumentRuntime({ fileId: "file-a", text: "committed" });

    runtime.setPendingCommit({ readText: () => "editor text" });

    expect(runtime.getSnapshot()).toMatchObject({
      dirty: true,
      pendingCommit: true,
      pendingTextAvailable: false,
      text: "committed",
    });
    expect(runtime.flush()).toEqual({
      fileId: "file-a",
      revision: 1,
      text: "editor text",
    });
    expect(runtime.getText()).toBe("editor text");
  });

  it("exposes editor-owned pending text as visible text without flushing", () => {
    const runtime = createEditorDocumentRuntime({ fileId: "file-a", text: "committed" });

    runtime.setPendingCommit({ readText: () => "editor text" });

    expect(runtime.getText()).toBe("committed");
    expect(runtime.getVisibleText()).toBe("editor text");
    expect(runtime.getSnapshot()).toMatchObject({
      dirty: true,
      pendingCommit: true,
      text: "committed",
    });
  });

  it("syncs an external committed document into the runtime boundary", () => {
    const runtime = createEditorDocumentRuntime({ fileId: "file-a", text: "local" });
    runtime.replaceAll("local pending");

    runtime.syncCommitted({ fileId: "file-b", revision: 10, text: "remote" });

    expect(runtime.getSnapshot()).toMatchObject({
      committedText: "remote",
      dirty: false,
      fileId: "file-b",
      pendingCommit: false,
      revision: 10,
      text: "remote",
    });
  });
});
