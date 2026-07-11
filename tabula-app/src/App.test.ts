import { afterEach, describe, expect, it, vi } from "vitest";
import { getCommentRangeInText, mapCommentAnchorThroughPatches } from "./commentAnchors";
import {
  createRoomWorkspaceState,
  createWorkspaceFile,
  createStoredWorkspace,
  ensureDefaultFiles,
  ensureLiveFileForRoom,
  finalizeWorkspaceState,
  getRoomFromLocation,
  getLiveFileTitle,
  parseWorkspacePayload,
  PROJECT_STORAGE_VERSION,
  readInitialWorkspaceSnapshot,
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

  it("opens a shared room as a room session before documents arrive", () => {
    const workspace = createRoomWorkspaceState({
      roomId: "browserroom",
      shareUrl: `http://localhost:5174/#room=browserroom,${VALID_ROOM_KEY}`,
    });

    expect(workspace.files).toEqual([]);
    expect(workspace.openFileIds).toEqual([]);
    expect(workspace.activeFileId).toBe("");
  });

  it("starts from a room-only workspace when the URL has a room hash", () => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://tabula.test",
        pathname: "/",
        hash: `#room=browserroom,${VALID_ROOM_KEY}`,
      },
    });

    const snapshot = readInitialWorkspaceSnapshot();

    expect(snapshot.source).toBe("room");
    expect(snapshot.room).toEqual({
      roomId: "browserroom",
      shareUrl: `https://tabula.test/#room=browserroom,${VALID_ROOM_KEY}`,
    });
    expect(snapshot.workspace.files).toEqual([]);
    expect(snapshot.workspace.openFileIds).toEqual([]);
    expect(snapshot.workspace.activeFileId).toBe("");
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
    const restored = parseWorkspacePayload(stored, { includeLocationRoom: false });

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
      "folderOrder",
      "folders",
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

  it("repairs cyclic v6 folders instead of exposing an unusable tree", () => {
    const stored = createStoredWorkspace({
      folders: [
        { id: "workspace-root", title: "Project", parentId: null },
        { id: "one", title: "One", parentId: "two" },
        { id: "two", title: "Two", parentId: "one" },
      ],
      files: [createWorkspaceFile(1, { id: "file", title: "folder/name", parentId: "missing" })],
      activeFileId: "file",
      commentsByFileId: {},
    });
    const restored = parseWorkspacePayload(stored, { includeLocationRoom: false });

    expect(restored?.files[0]).toMatchObject({ title: "folder name.md", parentId: "workspace-root" });
    expect(restored?.folders.some((folder) => folder.id !== "workspace-root" && folder.parentId === "workspace-root")).toBe(true);
  });

  it("rejects non-Tabula project payloads", () => {
    const restored = parseWorkspacePayload(
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
    const restored = parseWorkspacePayload(stored, { includeLocationRoom: false });

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
    const restored = parseWorkspacePayload(stored, { includeLocationRoom: false });

    expect(restored?.files.map((file) => file.title)).toEqual(["README.md", "Untitled.md"]);
    expect(restored?.activeFileId).toBe("tabula-readme");
  });

  it("preserves live-room text as a local file without persisting room credentials", () => {
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
          lastRecoveryType: "reconnected",
          lastRecoveryMessage: "Recovered",
          lastRecoveryAt: "2026-06-11T00:01:00.000Z",
        }),
      ],
      activeFileId: "live",
      commentsByFileId: {},
    });
    const restored = parseWorkspacePayload(stored, { includeLocationRoom: false });
    const localFile = restored?.files.find((file) => file.id === "local");
    const liveFile = restored?.files.find((file) => file.id === "live");

    expect(stored.files["live"]).toMatchObject({
      title: "Shared room.md",
      text: "# Live",
      connectionStatus: "idle",
    });
    expect(stored.files["live"]?.roomId).toBeUndefined();
    expect(stored.files["live"]?.shareUrl).toBeUndefined();
    expect(stored.files["live"]?.lastRecoveryType).toBeUndefined();
    expect(stored.files["live"]?.lastRecoveryMessage).toBeUndefined();
    expect(localFile?.text).toBe("# Local\n\nDraft");
    expect(liveFile).toMatchObject({
      title: "Shared room.md",
      text: "# Live",
      connectionStatus: "idle",
    });
    expect(liveFile?.roomId).toBeUndefined();
    expect(liveFile?.shareUrl).toBeUndefined();
    expect(liveFile?.lastRecoveryType).toBeUndefined();
    expect(liveFile?.lastRecoveryMessage).toBeUndefined();
  });

  it("drops empty generated live-room placeholders across reloads", () => {
    const stored = createStoredWorkspace({
      files: [
        createWorkspaceFile(1, { id: "local", title: "LOCAL.md", text: "# Local" }),
        createWorkspaceFile(2, {
          id: "live-room-empty",
          title: getLiveFileTitle("dp12Owqb123"),
          text: "",
          roomId: "dp12Owqb123",
          shareUrl: `http://localhost:5174/#room=dp12Owqb123,${VALID_ROOM_KEY}`,
          connectionStatus: "connecting",
        }),
      ],
      activeFileId: "live-room-empty",
      commentsByFileId: {},
    });
    const restored = parseWorkspacePayload(stored, { includeLocationRoom: false });

    expect(Object.keys(stored.files)).toEqual(["local"]);
    expect(stored.activeFileId).toBe("local");
    expect(restored?.files.map((file) => file.id)).toEqual(["local"]);
    expect(restored?.activeFileId).toBe("local");
  });

  it("keeps empty generated live-room placeholders when they have comments", () => {
    const liveFile = createWorkspaceFile(1, {
      id: "live-room-commented",
      title: getLiveFileTitle("dp12Owqb123"),
      text: "",
      roomId: "dp12Owqb123",
      shareUrl: `http://localhost:5174/#room=dp12Owqb123,${VALID_ROOM_KEY}`,
    });
    const stored = createStoredWorkspace({
      files: [liveFile],
      activeFileId: liveFile.id,
      commentsByFileId: {
        [liveFile.id]: [
          {
            id: "comment",
            body: "Keep this placeholder because it has review context.",
            createdAt: "2026-07-09T00:00:00.000Z",
          },
        ],
      },
    });
    const restored = parseWorkspacePayload(stored, { includeLocationRoom: false });

    expect(Object.keys(stored.files)).toEqual([liveFile.id]);
    expect(restored?.files.map((file) => file.id)).toEqual([liveFile.id]);
  });

  it("drops imported live room metadata across reloads", () => {
    const stored = createStoredWorkspace({
      files: [
        createWorkspaceFile(1, {
          id: "broken-live",
          title: "Broken.md",
          text: "# Broken",
          roomId: "room-live",
          shareUrl: "https://tabula.test/",
          connectionStatus: "disconnected",
          lastRecoveryType: "invalid-message",
          lastRecoveryMessage: "This room URL is missing its client-only room key.",
          lastRecoveryAt: "2026-06-11T00:01:00.000Z",
        }),
      ],
      activeFileId: "broken-live",
      commentsByFileId: {},
    });
    const restored = parseWorkspacePayload(stored, { includeLocationRoom: false });
    const brokenFile = restored?.files.find((file) => file.id === "broken-live");

    expect(stored.files["broken-live"]).toMatchObject({
      connectionStatus: "idle",
    });
    expect(stored.files["broken-live"]?.roomId).toBeUndefined();
    expect(stored.files["broken-live"]?.shareUrl).toBeUndefined();
    expect(stored.files["broken-live"]?.lastRecoveryType).toBeUndefined();
    expect(stored.files["broken-live"]?.lastRecoveryMessage).toBeUndefined();
    expect(brokenFile).toMatchObject({
      connectionStatus: "idle",
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
    const restored = parseWorkspacePayload(stored, { includeLocationRoom: false });

    expect(restored?.commentsByFileId.local[0]).toMatchObject({
      quote: "Quoted source",
      sourceQuote: "Quoted source",
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
  const repeatedText = "line 3 has -firs here\nline 6 has -firs here";
  const comment = {
    id: "comment",
    body: "Review this.",
    quote: "-firs",
    sourceQuote: "-firs",
    selectionStart: 33,
    selectionEnd: 38,
    createdAt: "2026-06-14T00:00:00.000Z",
  };

  it("keeps a repeated quote attached to its captured range", () => {
    expect(getCommentRangeInText(repeatedText, comment)).toEqual({ start: 33, end: 38 });
  });

  it("maps a captured range through text inserted before it", () => {
    const mapped = mapCommentAnchorThroughPatches(
      comment,
      [{ from: 0, to: 0, insert: "Intro\n" }],
      repeatedText.length,
    );
    expect(mapped).toMatchObject({ selectionStart: 39, selectionEnd: 44, anchorDetached: false });
  });

  it("does not absorb text inserted directly outside the captured range", () => {
    const mapped = mapCommentAnchorThroughPatches(
      comment,
      [
        { from: 33, to: 33, insert: "before " },
        { from: 38, to: 38, insert: " after" },
      ],
      repeatedText.length,
    );
    expect(mapped).toMatchObject({ selectionStart: 40, selectionEnd: 45 });
  });

  it("detaches an anchor when its selected text is deleted", () => {
    const mapped = mapCommentAnchorThroughPatches(
      comment,
      [{ from: 33, to: 38, insert: "" }],
      repeatedText.length,
    );
    expect(mapped).toMatchObject({ anchorDetached: true });
    expect(getCommentRangeInText(repeatedText, mapped)).toBeNull();
  });
});
