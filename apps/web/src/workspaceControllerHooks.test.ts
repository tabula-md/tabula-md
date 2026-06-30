import { describe, expect, it } from "vitest";
import type { Collaborator } from "./collab";
import {
  createWorkspaceIdentity,
  IDENTITY_KEY,
  normalizeWorkspaceIdentity,
} from "./hooks/useWorkspaceIdentity";
import { createHelpMarkdown, getKeyboardShortcuts } from "./helpMarkdown";
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
import { getMagnetizedSplitRatio } from "./hooks/useSplitViewController";
import {
  createCurrentFileDownloadDraft,
  createImportedWorkspaceFileDraft,
  createWorkspaceProjectDownloadDraft,
  getNewFilePreferenceOverrides,
  getUnreadableProjectJsonMessage,
  getUnsupportedProjectSchemaMessage,
  isSupportedImportFileDescriptor,
} from "./workspaceIoModel";
import {
  isFileTextFallbackHistoryEnabled,
  normalizeFileBookmarks,
  recordFileTextHistory,
} from "./hooks/useWorkspaceActiveFileEditor";
import { getWorkspaceShortcutAction } from "./hooks/useWorkspaceKeyboardShortcuts";
import {
  findWorkspaceAboutFile,
  getWorkspaceAboutFileDraft,
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
  getMarkdownWordCount,
  getWorkspaceFileSearchText,
  getWorkspaceFileStatus,
  getWorkspaceStatusLabel,
} from "./workspaceViewModel";
import { isUsableLiveRoomFile, type FileBookmark, type WorkspaceFile } from "./workspaceStorage";

const VALID_ROOM_KEY = "A".repeat(43);

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
    };

    writeWorkspacePreferences(preferences, storage);

    expect(storage.getItem(WORKSPACE_PREFERENCES_KEY)).toBe(JSON.stringify(preferences));
    expect(readWorkspacePreferences(storage)).toEqual(preferences);
  });
});

describe("workspace help markdown", () => {
  const shortcutLabels = { primary: "Cmd", alternate: "Option" } as const;

  it("creates HELP.md with the app shortcut table", () => {
    expect(getKeyboardShortcuts(shortcutLabels)).toContainEqual({
      keys: "Cmd + Option + N",
      action: "New File",
    });
    expect(createHelpMarkdown(shortcutLabels)).toContain("| Cmd + Option + 2 | Split mode |");
  });
});

describe("workspace identity controller", () => {
  it("normalizes guest names to anonymous names and trims long names", () => {
    const identity: Collaborator = {
      id: "abcdef",
      name: "Guest 42",
      color: "#000000",
      lastSeen: 1,
    };

    expect(normalizeWorkspaceIdentity(identity, () => 1234)).toEqual({
      id: "abcdef",
      name: "Anonymous abc",
      color: "#000000",
      lastSeen: 1234,
    });
  });

  it("persists a created identity when no stored identity exists", () => {
    const storage = new MemoryStorage();
    const identity = createWorkspaceIdentity({
      storage,
      createId: () => "id-12345",
      random: () => 0,
      now: () => 10,
    });

    expect(identity).toEqual({
      id: "id-12345",
      name: "Anonymous 100",
      color: "#0f766e",
      lastSeen: 10,
    });
    expect(JSON.parse(storage.getItem(IDENTITY_KEY) ?? "{}")).toEqual(identity);
  });

  it("creates a tab-scoped collaborator id even when a stored profile exists", () => {
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
      random: () => 0,
      now: () => 20,
    });

    expect(identity).toEqual({
      id: "next-tab",
      name: "Taeha",
      color: "#2563eb",
      lastSeen: 20,
    });
  });

  it("does not reuse generated anonymous names across tabs", () => {
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
      random: () => 0,
      now: () => 20,
    });

    expect(identity.name).toBe("Anonymous 100");
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
});

describe("split view controller", () => {
  it("magnetizes near-center split ratios and clamps out-of-range ratios", () => {
    expect(getMagnetizedSplitRatio(0.49)).toBe(0.5);
    expect(getMagnetizedSplitRatio(0.2)).toBe(0.28);
    expect(getMagnetizedSplitRatio(0.8)).toBe(0.72);
  });
});

describe("project IO controller", () => {
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

  it("creates file and project download drafts without DOM side effects", () => {
    const activeFile = file("brief", "# Brief");
    const currentFileDownload = createCurrentFileDownloadDraft(activeFile);

    expect(currentFileDownload).toEqual({
      fileName: "brief.md",
      content: "# Brief",
      type: "text/markdown;charset=utf-8",
    });

    const projectDownload = createWorkspaceProjectDownloadDraft({
      files: [activeFile],
      openFileIds: [activeFile.id],
      activeFileId: activeFile.id,
      commentsByFileId: {
        [activeFile.id]: [
          {
            id: "comment-one",
            body: "Needs review",
            createdAt: "2026-06-30T00:00:00.000Z",
            authorName: "Taeha",
            resolved: false,
            replies: [],
          },
        ],
      },
    });

    expect(projectDownload.fileName).toMatch(/^tabula-project-v\d+\.json$/);
    expect(projectDownload.type).toBe("application/json");
    expect(JSON.parse(projectDownload.content)).toMatchObject({
      activeFileId: activeFile.id,
      files: {
        [activeFile.id]: {
          id: activeFile.id,
          title: "brief.md",
          text: "# Brief",
        },
      },
      commentsByFileId: {
        [activeFile.id]: [{ id: "comment-one", body: "Needs review" }],
      },
    });
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

    expect(getUnreadableProjectJsonMessage()).toBe("This file is not readable JSON.");
    expect(getUnsupportedProjectSchemaMessage()).toContain("project v");
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

  it("derives file status without exposing App component state logic", () => {
    expect(
      getWorkspaceFileStatus({
        file: file(),
        activeFileId: "file",
        activeConnectionStatus: "connecting",
      }),
    ).toBe("connecting");
    expect(
      getWorkspaceFileStatus({
        file: file({
          id: "room-file",
          roomId: "room-1",
          shareUrl: `https://tabula.md/#room=room-1,${VALID_ROOM_KEY}`,
        }),
        activeFileId: "file",
        activeConnectionStatus: "connected",
      }),
    ).toBe("offline");
    expect(
      getWorkspaceFileStatus({
        file: file({
          id: "remote-file",
          roomId: "room-2",
          shareUrl: `https://tabula.md/#room=room-2,${VALID_ROOM_KEY}`,
          connectionStatus: "connected",
        }),
        activeFileId: "file",
        activeConnectionStatus: "idle",
      }),
    ).toBe("connected");
  });

  it("builds file search text and word count from Markdown content", () => {
    expect(getWorkspaceFileSearchText(file())).toBe("README.md Product Requirements");
    expect(getMarkdownWordCount(" one\n two   three ")).toBe(3);
    expect(getMarkdownWordCount("   ")).toBe(0);
  });
});

describe("workspace active file editor controller", () => {
  it("disables whole-document fallback history for live collaboration files", () => {
    expect(isFileTextFallbackHistoryEnabled({ roomId: undefined })).toBe(true);
    expect(isFileTextFallbackHistoryEnabled({ roomId: "room-1" })).toBe(false);
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

describe("workspace live room contract", () => {
  const liveFile = (overrides: Partial<WorkspaceFile>): WorkspaceFile => ({
    id: "live",
    title: "Live.md",
    text: "Live",
    viewMode: "edit",
    readingWidth: "wide",
    lineWrapping: true,
    lineNumbers: true,
    ...overrides,
  });

  it("only treats complete canonical room links as usable live rooms", () => {
    expect(
      isUsableLiveRoomFile(
        liveFile({
          roomId: "room",
          shareUrl: `https://tabula.md/#room=room,${VALID_ROOM_KEY}`,
        }),
      ),
    ).toBe(true);

    expect(isUsableLiveRoomFile(liveFile({ roomId: "room" }))).toBe(false);
    expect(
      isUsableLiveRoomFile(
        liveFile({
          roomId: "room",
          shareUrl: `https://tabula.md/#room=other,${VALID_ROOM_KEY}`,
        }),
      ),
    ).toBe(false);
    expect(
      isUsableLiveRoomFile(
        liveFile({
          roomId: "room",
          shareUrl: "https://tabula.md/#room=room,not-a-valid-key",
        }),
      ),
    ).toBe(false);
  });

  it("reports broken live room metadata as local workspace status", () => {
    const brokenFile = liveFile({
      roomId: "room",
      connectionStatus: "offline",
    });

    expect(
      getWorkspaceFileStatus({
        file: brokenFile,
        activeFileId: "other",
        activeConnectionStatus: "connected",
      }),
    ).toBe("idle");

    expect(getActiveWorkspaceStatus({ isLive: isUsableLiveRoomFile(brokenFile), connectionStatus: "offline" })).toBe(
      "idle",
    );
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

  it("resolves the About file from README identity before title fallback", () => {
    const readmeByTitle = { ...file("title-readme"), title: "README.md" };
    const readmeById = { ...file("tabula-readme"), title: "About.md" };

    expect(normalizeWorkspaceFileTitleForLookup({ title: " README.md " })).toBe("readme");
    expect(findWorkspaceAboutFile([readmeByTitle])?.id).toBe("title-readme");
    expect(findWorkspaceAboutFile([readmeByTitle, readmeById])?.id).toBe("tabula-readme");
  });

  it("creates a preview README draft for About when no README exists", () => {
    expect(getWorkspaceAboutFileDraft()).toMatchObject({
      title: "README.md",
      viewMode: "preview",
      overrides: {
        id: "tabula-readme",
        lineNumbers: true,
        lineWrapping: true,
        readingWidth: "wide",
      },
    });
    expect(getWorkspaceAboutFileDraft().text).toContain("Tabula.md");
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
