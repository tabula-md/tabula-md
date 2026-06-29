import { describe, expect, it } from "vitest";
import {
  getWorkspaceHydrationSignature,
  shouldDeferIndexedDbWorkspacePersistence,
  shouldApplyIndexedDbWorkspaceHydration,
} from "./useIndexedDbWorkspaceHydration";
import { createWorkspaceFile, type WorkspaceState } from "../workspaceStorage";

const createWorkspace = (text: string): WorkspaceState => ({
  files: [createWorkspaceFile(1, { id: "local", title: "LOCAL.md", text })],
  openFileIds: ["local"],
  activeFileId: "local",
  commentsByFileId: {},
});

describe("IndexedDB workspace hydration", () => {
  it("uses a stable signature for equivalent workspaces", () => {
    expect(getWorkspaceHydrationSignature(createWorkspace("# A"))).toBe(
      getWorkspaceHydrationSignature(createWorkspace("# A")),
    );
  });

  it("applies IndexedDB workspace only while the current workspace is still untouched", () => {
    const initialWorkspace = createWorkspace("");
    const indexedDbWorkspace = createWorkspace("# Restored");

    expect(
      shouldApplyIndexedDbWorkspaceHydration({
        enabled: true,
        currentWorkspace: initialWorkspace,
        initialWorkspace,
        indexedDbWorkspace,
      }),
    ).toBe(true);

    expect(
      shouldApplyIndexedDbWorkspaceHydration({
        enabled: true,
        currentWorkspace: createWorkspace("# User typed"),
        initialWorkspace,
        indexedDbWorkspace,
      }),
    ).toBe(false);
  });

  it("skips hydration when disabled or when IndexedDB has no workspace", () => {
    const initialWorkspace = createWorkspace("");

    expect(
      shouldApplyIndexedDbWorkspaceHydration({
        enabled: false,
        currentWorkspace: initialWorkspace,
        initialWorkspace,
        indexedDbWorkspace: createWorkspace("# Restored"),
      }),
    ).toBe(false);

    expect(
      shouldApplyIndexedDbWorkspaceHydration({
        enabled: true,
        currentWorkspace: initialWorkspace,
        initialWorkspace,
        indexedDbWorkspace: null,
      }),
    ).toBe(false);
  });

  it("defers persistence only while the untouched starter workspace is waiting for IndexedDB", () => {
    const initialWorkspace = createWorkspace("");

    expect(
      shouldDeferIndexedDbWorkspacePersistence({
        enabled: true,
        currentWorkspace: initialWorkspace,
        initialWorkspace,
        status: "pending",
      }),
    ).toBe(true);

    expect(
      shouldDeferIndexedDbWorkspacePersistence({
        enabled: true,
        currentWorkspace: createWorkspace("# User typed"),
        initialWorkspace,
        status: "pending",
      }),
    ).toBe(false);

    expect(
      shouldDeferIndexedDbWorkspacePersistence({
        enabled: true,
        currentWorkspace: initialWorkspace,
        initialWorkspace,
        status: "skipped",
      }),
    ).toBe(false);
  });
});
