import { afterEach, describe, expect, it, vi } from "vitest";
import { COMMENT_ANCHOR_CONTEXT_LENGTH, getCommentRangeInText } from "./commentAnchors";
import {
  createWorkspaceFile,
  createStoredWorkspace,
  ensureDefaultFiles,
  ensureLiveFileForRoom,
  finalizeWorkspaceState,
  getRoomFromLocation,
  getLiveFileTitle,
  migrateWorkspacePayload,
  PROJECT_STORAGE_VERSION,
  syncUrlForFile,
  type WorkspaceFile,
} from "./workspaceStorage";

const VALID_ROOM_KEY = "A".repeat(43);
const NEXT_VALID_ROOM_KEY = "B".repeat(43);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("file tab state transitions", () => {
  it("opens the product README first and keeps a blank file available", () => {
    const files = ensureDefaultFiles([], { ensureUntitled: true });

    expect(files.map((file) => file.title)).toEqual(["README.md", "Untitled.md"]);
    expect(files[0].viewMode).toBe("preview");
    expect(files[0].text).toContain(
      "Tabula.md is a local-first Markdown workspace for files that people and coding agents can share safely.",
    );
    expect(files[0].text).not.toContain("AI agents can both read");
    expect(files[1].viewMode).toBe("edit");
    expect(files[1].text).toBe("");
  });

  it("opens a shared room without replacing local tabs", () => {
    const localFiles = ensureDefaultFiles([], { ensureUntitled: true });
    const files = ensureLiveFileForRoom(localFiles, {
      roomId: "browserroom",
      shareUrl: `http://localhost:5174/#room=browserroom,${VALID_ROOM_KEY}`,
    });

    expect(files.map((file) => file.title)).toEqual([
      "README.md",
      "Untitled.md",
      getLiveFileTitle("browserroom"),
    ]);
    expect(files[2].roomId).toBe("browserroom");
    expect(files[2].connectionStatus).toBe("connecting");
  });

  it("reactivates an existing shared room instead of duplicating it", () => {
    const files = ensureLiveFileForRoom(
      ensureLiveFileForRoom(ensureDefaultFiles([], { ensureUntitled: true }), {
        roomId: "room-a",
        shareUrl: `http://localhost:5174/#room=room-a,${VALID_ROOM_KEY}`,
      }),
      {
        roomId: "room-a",
        shareUrl: `http://localhost:5174/#room=room-a,${NEXT_VALID_ROOM_KEY}`,
      },
    );

    expect(files.filter((file) => file.roomId === "room-a")).toHaveLength(1);
    expect(files.find((file) => file.roomId === "room-a")?.shareUrl).toBe(
      `http://localhost:5174/#room=room-a,${NEXT_VALID_ROOM_KEY}`,
    );
  });

  it("only treats canonical room hashes as live rooms when the client-only key fragment is present", () => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://tabula.test",
        pathname: "/",
        hash: "",
      },
    });

    expect(getRoomFromLocation()).toBeNull();

    vi.stubGlobal("window", {
      location: {
        origin: "https://tabula.test",
        pathname: "/",
        hash: `#room=room-a,${VALID_ROOM_KEY}`,
      },
    });

    expect(getRoomFromLocation()).toEqual({
      roomId: "room-a",
      shareUrl: `https://tabula.test/#room=room-a,${VALID_ROOM_KEY}`,
    });
  });

  it("syncs browser URLs only from valid stored live room share URLs", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: {
        pathname: "/",
        hash: "",
      },
      history: {
        replaceState,
      },
    });

    syncUrlForFile({ roomId: "room-a", shareUrl: `https://tabula.test/#room=room-a,${VALID_ROOM_KEY}` }, "replace");

    expect(replaceState).toHaveBeenCalledWith(null, "", `/#room=room-a,${VALID_ROOM_KEY}`);
  });

  it("does not keep invalid stored live room share URLs in the browser URL", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: {
        pathname: "/r/stale",
        hash: "#key=stale",
      },
      history: {
        replaceState,
      },
    });

    expect(() => syncUrlForFile({ roomId: "room-a", shareUrl: "not a url" }, "replace")).not.toThrow();
    syncUrlForFile({ roomId: "room-a", shareUrl: `https://tabula.test/#room=room-b,${VALID_ROOM_KEY}` }, "replace");

    expect(replaceState).toHaveBeenCalledTimes(2);
    expect(replaceState).toHaveBeenNthCalledWith(1, null, "", "/");
    expect(replaceState).toHaveBeenNthCalledWith(2, null, "", "/");
  });

  it("opens a fresh project on the product README", () => {
    const restored = finalizeWorkspaceState([], undefined, {}, { includeLocationRoom: false });

    expect(restored.files.map((file) => file.title)).toEqual(["README.md", "Untitled.md"]);
    expect(restored.activeFileId).toBe(restored.files[0].id);
  });
});

describe("project persistence", () => {
  it("preserves per-file view modes and active file", () => {
    const files: WorkspaceFile[] = [
      createWorkspaceFile(1, { id: "prd", title: "PRD.md", text: "# PRD", viewMode: "split" }),
      createWorkspaceFile(2, { id: "design", title: "DESIGN.md", text: "# Design", viewMode: "preview" }),
    ];
    const stored = createStoredWorkspace({
      files,
      activeFileId: "design",
      commentsByFileId: {},
    });
    const restored = migrateWorkspacePayload(stored, { includeLocationRoom: false });

    expect(stored).toMatchObject({
      schema: "tabula.project",
      version: PROJECT_STORAGE_VERSION,
      activeFileId: "design",
      openFileIds: ["prd", "design"],
      fileOrder: ["prd", "design"],
      commentsByFileId: {},
    });
    expect(Object.keys(stored).sort()).toEqual([
      "activeFileId",
      "commentsByFileId",
      "fileOrder",
      "files",
      "openFileIds",
      "savedAt",
      "schema",
      "version",
    ]);
    expect(restored?.activeFileId).toBe("design");
    expect(restored?.openFileIds).toEqual(["prd", "design"]);
    expect(restored?.files.map((file) => [file.title, file.viewMode])).toEqual([
      ["PRD.md", "split"],
      ["DESIGN.md", "preview"],
    ]);
  });

  it("rejects non-Tabula project payloads", () => {
    const restored = migrateWorkspacePayload(
      {
        schema: "unknown.workspace",
        version: 2,
        activeDocumentId: "local",
        documentOrder: ["local"],
        documents: {
          local: createWorkspaceFile(1, { id: "local", title: "LOCAL.md", text: "# Local" }),
        },
        commentsByDocumentId: {},
      },
      { includeLocationRoom: false },
    );

    expect(restored).toBeNull();
  });

  it("does not force the product README back into an existing project", () => {
    const stored = createStoredWorkspace({
      files: [createWorkspaceFile(1, { id: "local", title: "LOCAL.md", text: "# Local" })],
      activeFileId: "local",
      commentsByFileId: {},
    });
    const restored = migrateWorkspacePayload(stored, { includeLocationRoom: false });

    expect(restored?.files.map((file) => file.title)).toEqual(["LOCAL.md"]);
    expect(restored?.activeFileId).toBe("local");
  });

  it("keeps the product README before the blank starter project", () => {
    const stored = createStoredWorkspace({
      files: [
        createWorkspaceFile(1, { id: "tabula-readme", title: "README.md", text: "# Guide", viewMode: "preview" }),
        createWorkspaceFile(2, { id: "blank", title: "Untitled.md", text: "", viewMode: "edit" }),
      ],
      activeFileId: "blank",
      commentsByFileId: {},
    });
    const restored = migrateWorkspacePayload(stored, { includeLocationRoom: false });

    expect(restored?.files.map((file) => file.title)).toEqual(["README.md", "Untitled.md"]);
    expect(restored?.activeFileId).toBe("tabula-readme");
  });

  it("preserves local text and live room metadata across reloads", () => {
    const stored = createStoredWorkspace({
      files: [
        createWorkspaceFile(1, { id: "local", title: "LOCAL.md", text: "# Local\n\nDraft" }),
        createWorkspaceFile(2, {
          id: "live",
          title: "Shared room.md",
          text: "# Live",
          roomId: "room-live",
          shareUrl: `http://localhost:5174/#room=room-live,${VALID_ROOM_KEY}`,
          connectionStatus: "connected",
          snapshotCount: 3,
          lastSnapshotAt: "2026-06-11T00:00:00.000Z",
          lastRecoveryType: "snapshot-recovered",
          lastRecoveryMessage: "Recovered",
          lastRecoveryAt: "2026-06-11T00:01:00.000Z",
        }),
      ],
      activeFileId: "live",
      commentsByFileId: {},
    });
    const restored = migrateWorkspacePayload(stored, { includeLocationRoom: false });
    const localFile = restored?.files.find((file) => file.id === "local");
    const liveFile = restored?.files.find((file) => file.id === "live");

    expect(localFile?.text).toBe("# Local\n\nDraft");
    expect(liveFile).toMatchObject({
      roomId: "room-live",
      shareUrl: `http://localhost:5174/#room=room-live,${VALID_ROOM_KEY}`,
      connectionStatus: "disconnected",
      snapshotCount: 3,
      lastSnapshotAt: "2026-06-11T00:00:00.000Z",
      lastRecoveryType: "snapshot-recovered",
      lastRecoveryMessage: "Recovered",
      lastRecoveryAt: "2026-06-11T00:01:00.000Z",
    });
  });

  it("drops incomplete live room metadata across reloads", () => {
    const stored = createStoredWorkspace({
      files: [
        createWorkspaceFile(1, {
          id: "broken-live",
          title: "Broken.md",
          text: "# Broken",
          roomId: "room-live",
          shareUrl: "https://tabula.test/",
          connectionStatus: "disconnected",
          collaboratorCount: 2,
          snapshotCount: 3,
          lastSnapshotAt: "2026-06-11T00:00:00.000Z",
          lastRecoveryType: "invalid-message",
          lastRecoveryMessage: "This room URL is missing its client-only room key.",
          lastRecoveryAt: "2026-06-11T00:01:00.000Z",
        }),
      ],
      activeFileId: "broken-live",
      commentsByFileId: {},
    });
    const restored = migrateWorkspacePayload(stored, { includeLocationRoom: false });
    const brokenFile = restored?.files.find((file) => file.id === "broken-live");

    expect(stored.files["broken-live"]).toMatchObject({
      connectionStatus: "idle",
      collaboratorCount: 0,
      snapshotCount: 0,
    });
    expect(stored.files["broken-live"]?.roomId).toBeUndefined();
    expect(stored.files["broken-live"]?.shareUrl).toBeUndefined();
    expect(stored.files["broken-live"]?.lastRecoveryType).toBeUndefined();
    expect(stored.files["broken-live"]?.lastRecoveryMessage).toBeUndefined();
    expect(brokenFile).toMatchObject({
      connectionStatus: "idle",
      collaboratorCount: 0,
      snapshotCount: 0,
    });
    expect(brokenFile?.roomId).toBeUndefined();
    expect(brokenFile?.shareUrl).toBeUndefined();
    expect(brokenFile?.lastRecoveryType).toBeUndefined();
    expect(brokenFile?.lastRecoveryMessage).toBeUndefined();
  });

  it("preserves comment source ranges across reloads", () => {
    const stored = createStoredWorkspace({
      files: [createWorkspaceFile(1, { id: "local", title: "LOCAL.md", text: "Quoted source text." })],
      activeFileId: "local",
      commentsByFileId: {
        local: [
          {
            id: "comment",
            body: "Explain this.",
            authorName: "Taeha",
            authorColor: "#111111",
            quote: "Quoted source",
            sourceQuote: "Quoted source",
            prefix: "",
            suffix: " text.",
            selectionStart: 0,
            selectionEnd: 13,
            resolved: false,
            replies: [
              {
                id: "reply",
                body: "Follow-up.",
                authorName: "Guest",
                authorColor: "#222222",
                createdAt: "2026-06-14T00:01:00.000Z",
              },
            ],
            createdAt: "2026-06-14T00:00:00.000Z",
          },
        ],
      },
    });
    const restored = migrateWorkspacePayload(stored, { includeLocationRoom: false });

    expect(restored?.commentsByFileId.local[0]).toMatchObject({
      quote: "Quoted source",
      sourceQuote: "Quoted source",
      prefix: "",
      suffix: " text.",
      selectionStart: 0,
      selectionEnd: 13,
      resolved: false,
      replies: [
        {
          id: "reply",
          body: "Follow-up.",
          authorName: "Guest",
          authorColor: "#222222",
          createdAt: "2026-06-14T00:01:00.000Z",
        },
      ],
    });
  });
});

describe("comment anchors", () => {
  it("uses the stored selection range while the quote still matches", () => {
    const sourceText = "Alpha quoted text omega.";

    expect(
      getCommentRangeInText(sourceText, {
        id: "comment",
        body: "Review this.",
        quote: "quoted text",
        prefix: "Alpha ",
        suffix: " omega.",
        selectionStart: 6,
        selectionEnd: 17,
        createdAt: "2026-06-14T00:00:00.000Z",
      }),
    ).toEqual({ start: 6, end: 17 });
  });

  it("repairs shifted offsets by matching prefix, quote, and suffix together", () => {
    const sourceText = "Inserted lead.\nAlpha quoted text omega.";

    expect(
      getCommentRangeInText(sourceText, {
        id: "comment",
        body: "Review this.",
        quote: "quoted text",
        prefix: "Alpha ",
        suffix: " omega.",
        selectionStart: 6,
        selectionEnd: 17,
        createdAt: "2026-06-14T00:00:00.000Z",
      }),
    ).toEqual({ start: 21, end: 32 });
  });

  it("chooses the repeated quote with the strongest surrounding context match", () => {
    const sourceText = "Intro repeated target end.\nBetter prefix target better suffix.";

    expect(
      getCommentRangeInText(sourceText, {
        id: "comment",
        body: "Review this.",
        quote: "target",
        prefix: "Better prefix ",
        suffix: " better suffix.",
        selectionStart: 0,
        selectionEnd: 6,
        createdAt: "2026-06-14T00:00:00.000Z",
      }),
    ).toEqual({ start: 41, end: 47 });
  });

  it("repairs anchors after formatting shifts the stored selection offsets", () => {
    const sourceText = "**Alpha _target_ omega**";

    expect(
      getCommentRangeInText(sourceText, {
        id: "comment",
        body: "Review this.",
        quote: "target",
        prefix: "Alpha _",
        suffix: "_ omega",
        selectionStart: 7,
        selectionEnd: 13,
        createdAt: "2026-06-14T00:00:00.000Z",
      }),
    ).toEqual({ start: 9, end: 15 });
  });

  it("uses the stored source quote when the rendered quote differs from Markdown source", () => {
    const sourceText = "Alpha **target** omega.";

    expect(
      getCommentRangeInText(sourceText, {
        id: "comment",
        body: "Review this.",
        quote: "Alpha target omega",
        sourceQuote: "Alpha **target** omega",
        prefix: "",
        suffix: ".",
        selectionStart: 0,
        selectionEnd: 22,
        createdAt: "2026-06-14T00:00:00.000Z",
      }),
    ).toEqual({ start: 0, end: 22 });
  });

  it("repairs shifted source quote anchors with surrounding source context", () => {
    const sourceText = "Intro.\nAlpha **target** omega.";

    expect(
      getCommentRangeInText(sourceText, {
        id: "comment",
        body: "Review this.",
        quote: "Alpha target omega",
        sourceQuote: "Alpha **target** omega",
        prefix: "",
        suffix: ".",
        selectionStart: 0,
        selectionEnd: 22,
        createdAt: "2026-06-14T00:00:00.000Z",
      }),
    ).toEqual({ start: 7, end: 29 });
  });

  it("exports the context length used when creating new anchors", () => {
    expect(COMMENT_ANCHOR_CONTEXT_LENGTH).toBe(48);
  });
});
