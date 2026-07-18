import { describe, expect, it, vi } from "vitest";
import {
  createRoomActorColor,
  createRoomActorName,
} from "@tabula-md/tabula";
import type { Collaborator } from "./collaboration/liveCollaboration";
import {
  createWorkspaceIdentity,
  IDENTITY_KEY,
  IDENTITY_SESSION_KEY,
  normalizeWorkspaceIdentity,
} from "./hooks/useWorkspaceIdentity";
import { formatShortcut } from "./keyboardShortcuts";
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  parseWorkspacePreferences,
  readWorkspacePreferences,
  WORKSPACE_PREFERENCES_KEY,
  writeWorkspacePreferences,
} from "./hooks/useWorkspacePreferences";
import {
  getCursorPositionLabel,
  getSelectionLineCount,
} from "./hooks/useSelectionCommentController";
import {
  getWorkspaceFileIoActiveFileSnapshot,
  getWorkspaceFileIoBoundaryActiveFileSnapshot,
  getWorkspaceFileIoBoundaryWorkspaceSnapshot,
  getWorkspaceFileIoWorkspaceSnapshot,
} from "./hooks/useWorkspaceFileIoController";
import {
  getJsonShareExportFileSnapshot,
  getJsonShareExportWorkspaceFiles,
} from "./hooks/useJsonShareController";
import {
  createActiveDocumentPreviewTextSnapshot,
  createPreviewStateFromSnapshot,
} from "./hooks/useActiveDocumentRuntime";
import { getMagnetizedSplitRatio } from "./hooks/useSplitViewController";
import {
  createCurrentFileDownloadDraft,
  createImportedWorkspaceFileDraft,
  getNewFilePreferenceOverrides,
  isSupportedImportFileDescriptor,
} from "./workspaceIoModel";
import { createWorkspaceRootFolder } from "./workspaceStorage";
import {
  getLocalTypingTextCommitDelay,
  getWorkspaceTextChangePolicy,
  isFileTextFallbackHistoryEnabled,
  normalizeFileBookmarks,
  recordFileTextHistory,
  schedulePendingEditorCommitTimer,
  shouldApplyEditorRuntimeVisibleTextPatch,
  shouldCancelPendingEditorCommit,
  shouldUseEditorDocumentRuntime,
  shouldUseFileTextFallbackHistory,
} from "./hooks/useWorkspaceActiveFileEditor";
import { getWorkspaceShortcutAction } from "./hooks/useWorkspaceKeyboardShortcuts";
import {
  normalizeWorkspaceFileTitleForLookup,
  removeRecordKey,
  restoreFileToList,
  restoreOpenFileId,
} from "./workspaceFileRuntimeModel";
import {
  formatCommentDate,
  getPreviewCommentAnchors,
  getPreviewLineAnnotations,
  toggleLineBookmarkInList,
} from "./commentRuntimeModel";
import {
  getActiveWorkspaceStatus,
  getWorkspaceFileSearchText,
  getWorkspaceStatusLabel,
  getMarkdownWordCount,
} from "@tabula-md/tabula";
import type { FileBookmark, WorkspaceFile } from "./workspaceStorage";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("workspace preferences controller", () => {
  it("normalizes unknown preference payloads to supported values", () => {
    expect(
      parseWorkspacePreferences({
        theme: "system",
        language: "it",
        newFileViewMode: "reader",
        readingWidth: "wide",
        lineWrapping: false,
        lineNumbers: "yes",
      }),
    ).toEqual({
      ...DEFAULT_WORKSPACE_PREFERENCES,
      readingWidth: "wide",
      lineWrapping: false,
    });
  });

  it("reads and writes the persisted workspace preferences contract", () => {
    const storage = new MemoryStorage();
    const preferences = {
      theme: "dark" as const,
      language: "ko" as const,
      newFileViewMode: "split" as const,
      readingWidth: "standard" as const,
      lineWrapping: false,
      lineNumbers: false,
      syncScrolling: false,
    };

    writeWorkspacePreferences(preferences, storage);

    expect(storage.getItem(WORKSPACE_PREFERENCES_KEY)).toBe(JSON.stringify(preferences));
    expect(readWorkspacePreferences(storage)).toEqual(preferences);
  });

  it("falls back when browser preferences cannot be read or written", () => {
    const unavailableStorage = {
      getItem: () => { throw new DOMException("blocked", "SecurityError"); },
      setItem: () => { throw new DOMException("full", "QuotaExceededError"); },
    };

    expect(readWorkspacePreferences(unavailableStorage)).toEqual(DEFAULT_WORKSPACE_PREFERENCES);
    expect(writeWorkspacePreferences(DEFAULT_WORKSPACE_PREFERENCES, unavailableStorage)).toBe(false);
  });
});

describe("workspace active file editor controller", () => {
  const localFile: Pick<WorkspaceFile, "text"> = {
    text: "previous",
  };
  const liveFile: Pick<WorkspaceFile, "text"> = {
    text: "previous",
  };
  const largeText = "x".repeat(120_000);

  it("cancels a pending large-document commit when the active file text changes externally", () => {
    expect(
      shouldCancelPendingEditorCommit(
        { fileId: "draft", text: "local pending" },
        { id: "draft", text: "remote merged" },
      ),
    ).toBe(true);
  });

  it("keeps a pending large-document commit when it still matches the active file", () => {
    expect(
      shouldCancelPendingEditorCommit(
        { fileId: "draft", text: "local pending" },
        { id: "draft", text: "local pending" },
      ),
    ).toBe(false);
  });

  it("defers small local typing commits without recording whole-document fallback history", () => {
    expect(
      getWorkspaceTextChangePolicy({
        activeFile: localFile,
        isRoomSession: false,
        nextText: "previous!",
        recordHistory: false,
        source: "editor-typing",
      }),
    ).toEqual({
      shouldDeferWorkspaceCommit: true,
      shouldRecordFallbackHistory: false,
      shouldSendCollaborationPatchImmediately: false,
    });
  });

  it("defers large local typing commits without creating per-keystroke fallback history", () => {
    expect(
      getWorkspaceTextChangePolicy({
        activeFile: localFile,
        isRoomSession: false,
        nextText: largeText,
        recordHistory: false,
        source: "editor-typing",
      }),
    ).toEqual({
      shouldDeferWorkspaceCommit: true,
      shouldRecordFallbackHistory: false,
      shouldSendCollaborationPatchImmediately: false,
    });
  });

  it("sends live collaboration patches immediately even when workspace commits are deferred", () => {
    expect(
      getWorkspaceTextChangePolicy({
        activeFile: liveFile,
        isRoomSession: true,
        nextText: largeText,
        recordHistory: false,
        source: "editor-typing",
      }),
    ).toEqual({
      shouldDeferWorkspaceCommit: true,
      shouldRecordFallbackHistory: false,
      shouldSendCollaborationPatchImmediately: true,
    });
  });

  it("uses a shorter typing commit delay for ordinary documents than large documents", () => {
    expect(getLocalTypingTextCommitDelay({ docLength: 1_000, lineCount: 20 })).toBeLessThan(
      getLocalTypingTextCommitDelay({ docLength: 120_000, lineCount: 20 }),
    );
    expect(getLocalTypingTextCommitDelay({ docLength: 1_000, lineCount: 2_000 })).toBe(
      getLocalTypingTextCommitDelay({ docLength: 120_000, lineCount: 20 }),
    );
  });

  it("patches editor runtime visible text synchronously only for non-large patch changes", () => {
    expect(
      shouldApplyEditorRuntimeVisibleTextPatch({
        docLength: 1_000,
        lineCount: 20,
        patches: [{ from: 10, to: 10, insert: "x" }],
      }),
    ).toBe(true);
    expect(
      shouldApplyEditorRuntimeVisibleTextPatch({
        docLength: 120_000,
        lineCount: 20,
        patches: [{ from: 10, to: 10, insert: "x" }],
      }),
    ).toBe(false);
    expect(
      shouldApplyEditorRuntimeVisibleTextPatch({
        docLength: 1_000,
        lineCount: 2_000,
        patches: [{ from: 10, to: 10, insert: "x" }],
      }),
    ).toBe(false);
    expect(shouldApplyEditorRuntimeVisibleTextPatch({ patches: [] })).toBe(false);
  });

  it("schedules 150KB and 1MB typing commits without flushing workspace text synchronously", () => {
    const clearTimeoutFn = vi.fn();

    [150 * 1024, 1024 * 1024].forEach((docLength, index) => {
      let scheduledFlush: (() => void) | undefined;
      const flushPendingEditorCommit = vi.fn();
      const delayMs = getLocalTypingTextCommitDelay({ docLength, lineCount: 20 });
      const setTimeoutFn = vi.fn((handler: () => void, timeout: number) => {
        scheduledFlush = handler;
        expect(timeout).toBe(delayMs);
        return index + 1;
      });

      expect(
        getWorkspaceTextChangePolicy({
          activeFile: localFile,
          isRoomSession: false,
          nextText: "x".repeat(docLength),
          recordHistory: false,
          source: "editor-typing",
        }),
      ).toEqual({
        shouldDeferWorkspaceCommit: true,
        shouldRecordFallbackHistory: false,
        shouldSendCollaborationPatchImmediately: false,
      });

      const timerId = schedulePendingEditorCommitTimer({
        clearTimeoutFn,
        currentTimerId: null,
        delayMs,
        flushPendingEditorCommit,
        setTimeoutFn,
      });

      expect(timerId).toBe(index + 1);
      expect(flushPendingEditorCommit).not.toHaveBeenCalled();
      expect(setTimeoutFn).toHaveBeenCalledTimes(1);

      scheduledFlush?.();
      expect(flushPendingEditorCommit).toHaveBeenCalledTimes(1);
    });
    expect(clearTimeoutFn).not.toHaveBeenCalled();
  });

  it("replaces a pending typing commit timer instead of stacking full-text commits", () => {
    const clearTimeoutFn = vi.fn();
    const flushPendingEditorCommit = vi.fn();
    const setTimeoutFn = vi.fn(() => 12);

    expect(
      schedulePendingEditorCommitTimer({
        clearTimeoutFn,
        currentTimerId: 7,
        delayMs: getLocalTypingTextCommitDelay({ docLength: 1024 * 1024, lineCount: 20 }),
        flushPendingEditorCommit,
        setTimeoutFn,
      }),
    ).toBe(12);

    expect(clearTimeoutFn).toHaveBeenCalledWith(7);
    expect(flushPendingEditorCommit).not.toHaveBeenCalled();
    expect(setTimeoutFn).toHaveBeenCalledTimes(1);
  });

  it("records fallback history only for changed coarse local document updates", () => {
    expect(
      getWorkspaceTextChangePolicy({
        activeFile: localFile,
        isRoomSession: false,
        nextText: "replacement",
        source: "coarse-update",
      }),
    ).toEqual({
      shouldDeferWorkspaceCommit: false,
      shouldRecordFallbackHistory: true,
      shouldSendCollaborationPatchImmediately: false,
    });

    expect(
      getWorkspaceTextChangePolicy({
        activeFile: localFile,
        isRoomSession: false,
        nextText: "replacement",
        recordHistory: false,
        source: "coarse-update",
      }).shouldRecordFallbackHistory,
    ).toBe(false);
    expect(
      getWorkspaceTextChangePolicy({
        activeFile: localFile,
        isRoomSession: false,
        nextText: localFile.text,
        source: "coarse-update",
      }).shouldRecordFallbackHistory,
    ).toBe(false);
    expect(
      getWorkspaceTextChangePolicy({
        activeFile: liveFile,
        isRoomSession: true,
        nextText: "replacement",
        source: "coarse-update",
      }),
    ).toEqual({
      shouldDeferWorkspaceCommit: false,
      shouldRecordFallbackHistory: false,
      shouldSendCollaborationPatchImmediately: true,
    });
  });

  it("uses file-text fallback history only after editor history declines the command", () => {
    expect(
      shouldUseFileTextFallbackHistory({
        canUseFallbackHistory: true,
        editorHandled: true,
        fallbackHistoryEnabled: true,
        hasActiveFile: true,
      }),
    ).toBe(false);
    expect(
      shouldUseFileTextFallbackHistory({
        canUseFallbackHistory: true,
        editorHandled: false,
        fallbackHistoryEnabled: true,
        hasActiveFile: true,
      }),
    ).toBe(true);
    expect(
      shouldUseFileTextFallbackHistory({
        canUseFallbackHistory: true,
        editorHandled: false,
        fallbackHistoryEnabled: false,
        hasActiveFile: true,
      }),
    ).toBe(false);
  });
});

describe("workspace shortcuts", () => {
  it("formats semantic shortcuts for the current operating system", () => {
    expect(formatShortcut("Mod+Shift+Z", "apple")).toBe("⇧⌘Z");
    expect(formatShortcut("Mod+Shift+Z", "standard")).toBe("Ctrl + Shift + Z");
  });
});

describe("workspace identity controller", () => {
  it("normalizes generated names to room actor names and trims long names", () => {
    const identity: Collaborator = {
      id: "abcdef",
      name: "Guest 42",
      color: "",
      lastSeen: 1,
    };

    expect(normalizeWorkspaceIdentity(identity, () => 1234)).toEqual({
      id: "abcdef",
      name: createRoomActorName("human", "abcdef"),
      color: createRoomActorColor("abcdef"),
      lastSeen: 1234,
    });
  });

  it("persists a created identity when no stored identity exists", () => {
    const storage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    const identity = createWorkspaceIdentity({
      storage,
      sessionStorage,
      createId: () => "id-12345",
      now: () => 10,
    });

    expect(identity).toEqual({
      id: "id-12345",
      name: createRoomActorName("human", "id-12345"),
      color: createRoomActorColor("id-12345"),
      lastSeen: 10,
    });
    expect(JSON.parse(storage.getItem(IDENTITY_KEY) ?? "{}")).toEqual({});
    expect(JSON.parse(sessionStorage.getItem(IDENTITY_SESSION_KEY) ?? "{}")).toEqual({
      name: createRoomActorName("human", "id-12345"),
      color: createRoomActorColor("id-12345"),
    });
  });

  it("creates an identity when browser storage is unavailable", () => {
    const unavailableStorage = {
      getItem: () => { throw new DOMException("blocked", "SecurityError"); },
      setItem: () => { throw new DOMException("full", "QuotaExceededError"); },
    };

    expect(() => createWorkspaceIdentity({
      storage: unavailableStorage,
      sessionStorage: unavailableStorage,
      createId: () => "offline-tab",
      now: () => 10,
    })).not.toThrow();
  });

  it("uses a tab-scoped actor id while preserving a custom stored name", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      IDENTITY_KEY,
      JSON.stringify({
        id: "previous-tab",
        name: "Taeha",
        color: "#2563eb",
        lastSeen: 1,
      }),
    );

    const identity = createWorkspaceIdentity({
      storage,
      createId: () => "next-tab",
      now: () => 20,
    });

    expect(identity).toEqual({
      id: "next-tab",
      name: "Taeha",
      color: createRoomActorColor("next-tab"),
      lastSeen: 20,
    });
    expect(JSON.parse(storage.getItem(IDENTITY_KEY) ?? "{}")).toEqual({ name: "Taeha" });
  });

  it("creates a new actor id for each page runtime", () => {
    const storage = new MemoryStorage();
    const identity = createWorkspaceIdentity({
      storage,
      createId: () => "new-tab",
      now: () => 20,
    });

    expect(identity).toEqual({
      id: "new-tab",
      name: createRoomActorName("human", "new-tab"),
      color: createRoomActorColor("new-tab"),
      lastSeen: 20,
    });
  });

  it("preserves generated presentation across a same-tab reload", () => {
    const storage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    const first = createWorkspaceIdentity({
      storage,
      sessionStorage,
      createId: () => "first-connection",
      now: () => 10,
    });
    const reloaded = createWorkspaceIdentity({
      storage,
      sessionStorage,
      createId: () => "second-connection",
      now: () => 20,
    });

    expect(reloaded).toEqual({
      id: "second-connection",
      name: first.name,
      color: first.color,
      lastSeen: 20,
    });
  });

  it("replaces stored generated anonymous names with actor names", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      IDENTITY_KEY,
      JSON.stringify({
        id: "previous-tab",
        name: "Anonymous old",
        color: "#2563eb",
        lastSeen: 1,
      }),
    );

    const identity = createWorkspaceIdentity({
      storage,
      createId: () => "next-tab",
      now: () => 20,
    });

    expect(identity.name).toBe(createRoomActorName("human", "next-tab"));
    expect(identity.id).toBe("next-tab");
  });
});

describe("selection comment controller", () => {
  it("reports cursor position from a Markdown source offset", () => {
    expect(getCursorPositionLabel("one\ntwo\nthree", 6)).toBe("2:3");
  });

  it("counts selected lines without over-counting a trailing newline", () => {
    expect(getSelectionLineCount("one\ntwo\nthree", 0, 8)).toBe(2);
    expect(getSelectionLineCount("one\ntwo\nthree", 4, 13)).toBe(2);
  });

  it("counts selected lines from editor metadata when workspace text is stale", () => {
    expect(
      getSelectionLineCount("stale", 0, 42, {
        fromLineNumber: 1,
        toLineNumber: 4,
        selectionEndsWithLineBreak: false,
      }),
    ).toBe(4);
    expect(
      getSelectionLineCount("stale", 0, 42, {
        fromLineNumber: 1,
        toLineNumber: 5,
        selectionEndsWithLineBreak: true,
      }),
    ).toBe(4);
  });
});

describe("split view controller", () => {
  it("magnetizes near-center split ratios and clamps out-of-range ratios", () => {
    expect(getMagnetizedSplitRatio(0.49)).toBe(0.5);
    expect(getMagnetizedSplitRatio(0.2)).toBe(0.28);
    expect(getMagnetizedSplitRatio(0.8)).toBe(0.72);
  });
});

describe("active document preview runtime", () => {
  it("derives preview state from the runtime snapshot text instead of stale file text", () => {
    const staleFile = {
      id: "file",
      text: "# Stale workspace text",
    };
    const snapshot = createActiveDocumentPreviewTextSnapshot(
      staleFile,
      "# Runtime preview text\n\nBody",
    );
    const previewState = createPreviewStateFromSnapshot(snapshot);

    expect(previewState.outlineHeadings).toEqual([
      { depth: 1, text: "Runtime preview text", lineIndex: 0, sourceLineIndex: 0 },
    ]);
    expect(previewState.renderedPreview.body).toBe("# Runtime preview text\n\nBody");
  });
});

describe("workspace file IO controller", () => {
  const file = (id: string, text = id): WorkspaceFile => ({
    id,
    title: `${id}.md`,
    text,
    viewMode: "edit",
    readingWidth: "wide",
    lineWrapping: true,
    lineNumbers: true,
  });

  it("maps workspace preferences to new file overrides", () => {
    expect(
      getNewFilePreferenceOverrides({
        newFileViewMode: "preview",
        readingWidth: "narrow",
        lineWrapping: false,
        lineNumbers: false,
      }),
    ).toEqual({
      viewMode: "preview",
      readingWidth: "narrow",
      lineWrapping: false,
      lineNumbers: false,
    });
  });

  it("recognizes Markdown import file descriptors", () => {
    expect(isSupportedImportFileDescriptor({ name: "Spec.md", type: "" })).toBe(true);
    expect(isSupportedImportFileDescriptor({ name: "Spec.markdown", type: "" })).toBe(true);
    expect(isSupportedImportFileDescriptor({ name: "notes", type: "text/plain" })).toBe(true);
    expect(isSupportedImportFileDescriptor({ name: "archive.json", type: "application/json" })).toBe(false);
  });

  it("creates file download drafts without DOM side effects", () => {
    const activeFile = file("brief", "# Brief");
    const currentFileDownload = createCurrentFileDownloadDraft(activeFile);

    expect(currentFileDownload).toEqual({
      fileName: "brief.md",
      content: "# Brief",
      type: "text/markdown;charset=utf-8",
    });

  });

  it("prefers runtime snapshots for file and project IO boundaries", () => {
    const staleActiveFile = file("brief", "# Stale");
    const runtimeActiveFile = file("brief", "# Pending");
    const runtimeWorkspace = {
      folders: [createWorkspaceRootFolder()],
      files: [runtimeActiveFile],
      openFileIds: [runtimeActiveFile.id],
      activeFileId: runtimeActiveFile.id,
    };

    expect(
      getWorkspaceFileIoActiveFileSnapshot({
        activeFile: staleActiveFile,
        getActiveFileSnapshot: () => runtimeActiveFile,
      }),
    ).toBe(runtimeActiveFile);
    expect(
      getWorkspaceFileIoWorkspaceSnapshot({
        activeFile: staleActiveFile,
        activeFileId: staleActiveFile.id,
        files: [staleActiveFile],
        folders: [createWorkspaceRootFolder()],
        getWorkspaceSnapshot: () => runtimeWorkspace,
        openFileIds: [staleActiveFile.id],
      }),
    ).toBe(runtimeWorkspace);
  });

  it("flushes before reading runtime snapshots for share and export boundaries", () => {
    const staleActiveFile = file("brief", "# Stale");
    const runtimeActiveFile = file("brief", "# Pending");
    const runtimeWorkspace = {
      folders: [createWorkspaceRootFolder()],
      files: [runtimeActiveFile],
      openFileIds: [runtimeActiveFile.id],
      activeFileId: runtimeActiveFile.id,
    };
    const calls: string[] = [];
    const onBeforeWorkspaceBoundary = vi.fn(() => calls.push("flush"));
    const getActiveFileSnapshot = vi.fn(() => {
      calls.push("active-snapshot");
      return runtimeActiveFile;
    });
    const getWorkspaceSnapshot = vi.fn(() => {
      calls.push("workspace-snapshot");
      return runtimeWorkspace;
    });

    expect(
      getWorkspaceFileIoBoundaryActiveFileSnapshot({
        activeFile: staleActiveFile,
        getActiveFileSnapshot,
        onBeforeWorkspaceBoundary,
      }),
    ).toBe(runtimeActiveFile);
    expect(
      getWorkspaceFileIoBoundaryWorkspaceSnapshot({
        activeFile: staleActiveFile,
        activeFileId: staleActiveFile.id,
        files: [staleActiveFile],
        folders: [createWorkspaceRootFolder()],
        getWorkspaceSnapshot,
        onBeforeWorkspaceBoundary,
        openFileIds: [staleActiveFile.id],
      }),
    ).toBe(runtimeWorkspace);
    expect(
      getJsonShareExportFileSnapshot({
        activeFile: staleActiveFile,
        getActiveFileSnapshot,
        onBeforeWorkspaceBoundary,
      }),
    ).toBe(runtimeActiveFile);
    expect(
      getJsonShareExportWorkspaceFiles({
        activeFile: staleActiveFile,
        files: [staleActiveFile],
        getActiveFileSnapshot,
        onBeforeWorkspaceBoundary,
      }),
    ).toEqual([runtimeActiveFile]);

    expect(calls).toEqual([
      "flush",
      "active-snapshot",
      "flush",
      "workspace-snapshot",
      "flush",
      "active-snapshot",
      "flush",
      "active-snapshot",
    ]);
  });

  it("creates imported Markdown file drafts from preferences", () => {
    expect(
      createImportedWorkspaceFileDraft("Design Brief", "# Design", {
        newFileViewMode: "split",
        readingWidth: "standard",
        lineWrapping: false,
        lineNumbers: true,
      }),
    ).toEqual({
      title: "Design Brief.md",
      text: "# Design",
      viewMode: "split",
      overrides: {
        viewMode: "split",
        readingWidth: "standard",
        lineWrapping: false,
        lineNumbers: true,
      },
    });
  });
});

describe("workspace keyboard shortcuts controller", () => {
  const keyEvent = (overrides: Partial<KeyboardEvent>) => ({
    altKey: false,
    code: "",
    ctrlKey: false,
    key: "",
    metaKey: false,
    shiftKey: false,
    ...overrides,
  });

  const targetState = { isEditableTarget: false, isRenameInput: false };

  it("maps app-level shortcuts to workspace actions", () => {
    expect(getWorkspaceShortcutAction(keyEvent({ altKey: true, code: "KeyN", metaKey: true, key: "n" }), targetState)).toBe(
      "newFile",
    );
    expect(getWorkspaceShortcutAction(keyEvent({ altKey: true, code: "KeyO", metaKey: true, key: "o" }), targetState)).toBe(
      "openFile",
    );
    expect(getWorkspaceShortcutAction(keyEvent({ altKey: true, code: "KeyF", ctrlKey: true, key: "f" }), targetState)).toBe(
      "browseFiles",
    );
    expect(getWorkspaceShortcutAction(keyEvent({ code: "KeyF", metaKey: true, key: "f" }), targetState)).toBe(
      "documentSearch",
    );
    expect(
      getWorkspaceShortcutAction(keyEvent({ code: "KeyF", ctrlKey: true, key: "f" }), {
        ...targetState,
        isEditableTarget: true,
      }),
    ).toBe("documentSearch");
    expect(
      getWorkspaceShortcutAction(keyEvent({ altKey: true, code: "Digit2", metaKey: true, key: "2" }), targetState),
    ).toBe("splitMode");
  });

  it("ignores shortcuts while renaming and only opens help outside editable targets", () => {
    expect(
      getWorkspaceShortcutAction(keyEvent({ altKey: true, code: "KeyN", metaKey: true, key: "n" }), {
        ...targetState,
        isRenameInput: true,
      }),
    ).toBeNull();
    expect(getWorkspaceShortcutAction(keyEvent({ key: "?" }), targetState)).toBe("openHelp");
    expect(
      getWorkspaceShortcutAction(keyEvent({ key: "?" }), {
        ...targetState,
        isEditableTarget: true,
      }),
    ).toBeNull();
  });
});

describe("workspace view model", () => {
  const file = (overrides: Partial<WorkspaceFile> = {}): WorkspaceFile => ({
    id: "file",
    title: "README.md",
    text: "---\ntitle: Product Requirements\n---\n# Body",
    viewMode: "edit",
    readingWidth: "wide",
    lineWrapping: true,
    lineNumbers: true,
    ...overrides,
  });

  it("derives status labels and active status from live state", () => {
    expect(getWorkspaceStatusLabel("connected")).toBe("Live session");
    expect(getWorkspaceStatusLabel("idle")).toBe("Local draft");
    expect(getActiveWorkspaceStatus({ isLive: false, connectionStatus: "connected" })).toBe("idle");
    expect(getActiveWorkspaceStatus({ isLive: true, connectionStatus: "connected" })).toBe("connected");
  });

  it("builds file search text and word count from Markdown content", () => {
    expect(getWorkspaceFileSearchText(file())).toBe("README.md Product Requirements");
    expect(getMarkdownWordCount(" one\n two   three ")).toBe(3);
    expect(getMarkdownWordCount("   ")).toBe(0);
  });
});

describe("workspace active file editor controller", () => {
  it("disables whole-document fallback history for room sessions", () => {
    expect(isFileTextFallbackHistoryEnabled(false)).toBe(true);
    expect(isFileTextFallbackHistoryEnabled(true)).toBe(false);
  });

  it("never creates a local document runtime for a room session", () => {
    expect(shouldUseEditorDocumentRuntime(false)).toBe(true);
    expect(shouldUseEditorDocumentRuntime(true)).toBe(false);
  });

  it("records text history with a bounded past stack and clears redo history", () => {
    const history = recordFileTextHistory(
      {
        past: Array.from({ length: 90 }, (_, index) => `past-${index}`),
        future: ["future"],
      },
      "current",
    );

    expect(history.future).toEqual([]);
    expect(history.past).toHaveLength(80);
    expect(history.past[0]).toBe("past-11");
    expect(history.past[79]).toBe("current");
  });

  it("normalizes bookmarks to unique non-negative positions", () => {
    expect(
      normalizeFileBookmarks(
        [
          { id: "negative", position: -10 },
          { id: "duplicate", position: 0 },
          { id: "existing-date", position: 8, createdAt: "2026-01-01T00:00:00.000Z" },
        ],
        "2026-01-02T00:00:00.000Z",
      ),
    ).toEqual([
      { id: "negative", position: 0, createdAt: "2026-01-02T00:00:00.000Z" },
      { id: "existing-date", position: 8, createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
  });
});

describe("workspace file actions controller", () => {
  const file = (id: string): WorkspaceFile => ({
    id,
    title: `${id}.md`,
    text: id,
    viewMode: "edit",
    readingWidth: "wide",
    lineWrapping: true,
    lineNumbers: true,
  });

  it("removes record entries without changing records that do not contain the key", () => {
    const record = { one: ["a"], two: ["b"] };

    expect(removeRecordKey(record, "one")).toEqual({ two: ["b"] });
    expect(removeRecordKey(record, "missing")).toBe(record);
  });

  it("restores deleted files and open tab order without duplicating entries", () => {
    expect(restoreFileToList([file("one"), file("three")], file("two"), 1).map((item) => item.id)).toEqual([
      "one",
      "two",
      "three",
    ]);
    expect(restoreFileToList([file("one")], file("zero"), -5).map((item) => item.id)).toEqual([
      "zero",
      "one",
    ]);
    expect(restoreFileToList([file("one")], file("one"), 0).map((item) => item.id)).toEqual(["one"]);
    expect(restoreOpenFileId(["one", "three"], "two", ["one", "two", "three"])).toEqual([
      "one",
      "two",
      "three",
    ]);
    expect(restoreOpenFileId(["one", "two"], "two", ["one", "two"])).toEqual(["one", "two"]);
  });

  it("normalizes workspace file titles for lookup", () => {
    expect(normalizeWorkspaceFileTitleForLookup({ title: " README.md " })).toBe("readme");
  });
});

describe("workspace comment actions controller", () => {
  it("toggles a line bookmark by line range", () => {
    const bookmark: FileBookmark = {
      id: "existing",
      position: 12,
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    expect(
      toggleLineBookmarkInList({
        bookmarks: [bookmark],
        createId: () => "new",
        lineStart: 10,
        lineEnd: 14,
        nowIso: "2026-01-02T00:00:00.000Z",
      }),
    ).toEqual([]);

    expect(
      toggleLineBookmarkInList({
        bookmarks: [],
        createId: () => "new",
        lineStart: 10,
        lineEnd: 14,
        nowIso: "2026-01-02T00:00:00.000Z",
      }),
    ).toEqual([{ id: "new", position: 10, createdAt: "2026-01-02T00:00:00.000Z" }]);
  });

  it("clips preview comment anchors to the rendered preview body", () => {
    expect(
      getPreviewCommentAnchors({
        commentAnchors: [
          { id: "before", start: 2, end: 7 },
          { id: "inside", start: 12, end: 16 },
          { id: "overlap", start: 18, end: 30 },
        ],
        previewBody: "0123456789",
        previewBodyStartOffset: 10,
      }),
    ).toEqual([
      { id: "inside", start: 2, end: 6 },
      { id: "overlap", start: 8, end: 10 },
    ]);
  });

  it("keeps preview line annotations on empty source lines", () => {
    expect(
      getPreviewLineAnnotations({
        body: "alpha\n\ncharlie",
        bodyStartOffset: 10,
        bookmarks: [{ id: "empty-bookmark", position: 16, createdAt: "2026-01-01T00:00:00.000Z" }],
        commentAnchors: [{ id: "empty-comment", start: 16, end: 16 }],
        activeCommentId: "empty-comment",
      }),
    ).toContainEqual({
      lineNumber: 2,
      start: 16,
      end: 16,
      hasBookmark: true,
      hasComment: true,
      hasActiveComment: true,
    });
  });

  it("formats relative comment dates", () => {
    const now = Date.parse("2026-01-01T01:00:00.000Z");

    expect(formatCommentDate("2026-01-01T00:59:40.000Z", now)).toBe("just now");
    expect(formatCommentDate("2026-01-01T00:58:00.000Z", now)).toBe("2 minutes ago");
    expect(formatCommentDate("2026-01-01T00:00:00.000Z", now)).toBe("1 hour ago");
  });
});
