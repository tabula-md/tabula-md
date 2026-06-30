import { describe, expect, it } from "vitest";
import { createActiveDocumentRuntime } from "./activeDocumentRuntime";
import { buildDocumentSurface } from "./documentSurfaceModel";
import type { WorkspaceModelFile } from "./workspaceModel";

const file = (
  overrides: Partial<WorkspaceModelFile> = {},
): WorkspaceModelFile => ({
  id: "file-1",
  title: "README.md",
  text: "hello world",
  viewMode: "edit",
  readingWidth: "standard",
  lineWrapping: true,
  lineNumbers: true,
  ...overrides,
});

const surface = (
  overrides: Partial<Parameters<typeof buildDocumentSurface>[0]> = {},
) =>
  buildDocumentSurface({
    document: createActiveDocumentRuntime(file()),
    hasSelectionActionPosition: false,
    isLive: false,
    openCommentCount: 0,
    searchOpen: false,
    selectedCharacterCount: 0,
    shareOpen: false,
    splitDividerDragging: false,
    ...overrides,
  });

describe("document surface model", () => {
  it("builds empty surface classes when no file is active", () => {
    expect(
      surface({ document: createActiveDocumentRuntime(undefined) }),
    ).toMatchObject({
      centerWorkbenchClassName: "center-workbench empty",
      fileShellClassName: "file-shell empty",
      showFormattingToolbar: false,
      showSelectionCommentPopover: false,
      showSplitResizeHandle: false,
    });
  });

  it("centralizes active document chrome classes", () => {
    expect(
      surface({
        document: createActiveDocumentRuntime(
          file({ viewMode: "split", readingWidth: "wide", lineNumbers: false }),
        ),
        searchOpen: true,
        splitDividerDragging: true,
      }),
    ).toMatchObject({
      centerWorkbenchClassName: "center-workbench has-file view-split reading-wide line-numbers-off",
      documentToolbarClassName: "document-toolbar-row split reading-wide with-formatting",
      editorSurfaceClassName: "editor-surface line-numbers-off",
      fileShellClassName: "file-shell view-split reading-wide line-numbers-off with-format-toolbar with-search-row",
      formattingToolbarClassName: "split reading-wide",
      showFormattingToolbar: true,
      showSplitResizeHandle: true,
      workspaceClassName: "workspace split reading-wide split-resizing",
    });
  });

  it("suppresses the split handle under the share modal", () => {
    expect(
      surface({
        document: createActiveDocumentRuntime(file({ viewMode: "split" })),
        shareOpen: true,
      }).showSplitResizeHandle,
    ).toBe(false);
  });

  it("keeps comments visible only for live documents", () => {
    expect(surface({ isLive: false, openCommentCount: 3 }).statusBar.commentCount).toBe(0);
    expect(surface({ isLive: true, openCommentCount: 3 }).statusBar.commentCount).toBe(3);
  });

  it("shows the selection comment popover only for a live text selection", () => {
    expect(
      surface({
        hasSelectionActionPosition: true,
        isLive: true,
        selectedCharacterCount: 4,
      }).showSelectionCommentPopover,
    ).toBe(true);

    expect(
      surface({
        hasSelectionActionPosition: true,
        isLive: false,
        selectedCharacterCount: 4,
      }).showSelectionCommentPopover,
    ).toBe(false);
  });
});
