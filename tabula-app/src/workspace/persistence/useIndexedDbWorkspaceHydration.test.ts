import { describe, expect, it } from "vitest";
import { captureWorkspaceKnowledgeBaseline } from "@tabula-md/tabula";
import {
  getWorkspaceHydrationSignature,
  shouldDeferIndexedDbWorkspacePersistence,
  shouldApplyIndexedDbWorkspaceHydration,
} from "./useIndexedDbWorkspaceHydration";
import { createWorkspaceFile, createWorkspaceRootFolder, type WorkspaceState } from "../workspaceStorage";

const createWorkspace = (text: string): WorkspaceState => ({
  folders: [createWorkspaceRootFolder()],
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

  it("hydrates maintenance state even when the document content still matches the starter", () => {
    const initialWorkspace = createWorkspace("");
    const indexedDbWorkspace = {
      ...createWorkspace(""),
      knowledgeBaseline: captureWorkspaceKnowledgeBaseline([{
        id: "local",
        path: "LOCAL.md",
        markdown: "",
      }], "2026-07-25T00:00:00.000Z"),
    };

    expect(shouldApplyIndexedDbWorkspaceHydration({
      enabled: true,
      currentWorkspace: initialWorkspace,
      initialWorkspace,
      indexedDbWorkspace,
    })).toBe(true);
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
