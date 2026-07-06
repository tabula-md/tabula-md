import { describe, expect, it } from "vitest";
import { createWorkspaceEditorDocumentRuntimeOwner } from "./editorDocumentRuntimeOwner";

describe("workspace editor document runtime owner", () => {
  it("reuses the runtime for the active file and exposes the latest runtime text", () => {
    const owner = createWorkspaceEditorDocumentRuntimeOwner();
    const runtime = owner.getRuntime({ id: "file-a", text: "committed" });

    runtime.replaceAll("pending text");

    expect(owner.getRuntime({ id: "file-a", text: "ignored committed text" })).toBe(runtime);
    expect(owner.getLatestFileText("file-a", "fallback")).toBe("pending text");
    expect(owner.flush()).toEqual({
      fileId: "file-a",
      revision: 1,
      text: "pending text",
    });
    expect(owner.getLatestFileText("file-a", "fallback")).toBe("pending text");
  });

  it("replaces the runtime owner when the active file changes", () => {
    const owner = createWorkspaceEditorDocumentRuntimeOwner();
    const firstRuntime = owner.getRuntime({ id: "file-a", text: "first" });
    firstRuntime.replaceAll("first pending");

    const secondRuntime = owner.getRuntime({ id: "file-b", text: "second" });

    expect(secondRuntime).not.toBe(firstRuntime);
    expect(secondRuntime.getText()).toBe("second");
    expect(owner.getLatestFileText("file-a", "fallback")).toBe("fallback");
    expect(owner.getLatestFileText("file-b", "fallback")).toBe("second");
  });

  it("returns runtime text as the active visible text while a workspace commit is pending", () => {
    const owner = createWorkspaceEditorDocumentRuntimeOwner();
    const runtime = owner.getRuntime({ id: "file-a", text: "committed" });

    runtime.replaceAll("runtime pending");

    expect(owner.getVisibleFileText({ id: "file-a", text: "stale workspace text" })).toBe("runtime pending");
  });

  it("uses pending editor reader text for visible and latest file text", () => {
    const owner = createWorkspaceEditorDocumentRuntimeOwner();
    const runtime = owner.getRuntime({ id: "file-a", text: "committed" });

    runtime.setPendingCommit({ readText: () => "typed before mode switch" });

    expect(owner.getVisibleFileText({ id: "file-a", text: "committed" })).toBe("typed before mode switch");
    expect(owner.getLatestFileText("file-a", "fallback")).toBe("typed before mode switch");
    expect(runtime.getText()).toBe("committed");
  });

  it("syncs externally committed text into visible text when there is no pending runtime commit", () => {
    const owner = createWorkspaceEditorDocumentRuntimeOwner();

    owner.getRuntime({ id: "file-a", text: "committed" });

    expect(owner.getVisibleFileText({ id: "file-a", text: "external commit" })).toBe("external commit");
    expect(owner.getLatestFileText("file-a", "fallback")).toBe("external commit");
  });

  it("can clear the active runtime boundary", () => {
    const owner = createWorkspaceEditorDocumentRuntimeOwner();
    owner.getRuntime({ id: "file-a", text: "first" }).replaceAll("first pending");

    owner.clear();

    expect(owner.flush()).toBeNull();
    expect(owner.getLatestFileText("file-a", "fallback")).toBe("fallback");
  });
});
