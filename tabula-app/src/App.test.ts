import { afterEach, describe, expect, it, vi } from "vitest";
import { getCommentRangeInText, mapCommentAnchorThroughPatches } from "./commentAnchors";
import {
  createRoomWorkspaceState,
  createStarterWorkspaceState,
  createWorkspaceFile,
  createStoredWorkspace,
  ensureDefaultFiles,
  getRoomFromLocation,
  parseWorkspacePayload,
  PROJECT_STORAGE_VERSION,
  readInitialWorkspaceSnapshot,
  syncUrlForLocalWorkspace,
  syncUrlForRoom,
  type WorkspaceFile,
} from "./workspaceStorage";

const VALID_ROOM_KEY = "A".repeat(43);

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
    const workspace = createRoomWorkspaceState();

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

  it("syncs browser URLs from the explicit room session", () => {
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

    syncUrlForRoom({
      roomId: "room-a",
      shareUrl: `https://tabula.test/#room=room-a,${VALID_ROOM_KEY}`,
    }, "replace");

    expect(replaceState).toHaveBeenCalledWith(null, "", `/#room=room-a,${VALID_ROOM_KEY}`);
  });

  it("returns to the local URL for invalid room sessions", () => {
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

    expect(() => syncUrlForRoom({ roomId: "room-a", shareUrl: "not a url" }, "replace")).not.toThrow();
    syncUrlForRoom({
      roomId: "room-a",
      shareUrl: `https://tabula.test/#room=room-b,${VALID_ROOM_KEY}`,
    }, "replace");
    syncUrlForLocalWorkspace("replace");

    expect(replaceState).toHaveBeenCalledTimes(3);
    expect(replaceState).toHaveBeenNthCalledWith(1, null, "", "/");
    expect(replaceState).toHaveBeenNthCalledWith(2, null, "", "/");
    expect(replaceState).toHaveBeenNthCalledWith(3, null, "", "/");
  });

  it("opens a fresh project with the product README available but no open tabs", () => {
    const restored = createStarterWorkspaceState();

    expect(restored.files.map((file) => file.title)).toEqual(["README.md"]);
    expect(restored.openFileIds).toEqual([]);
    expect(restored.activeFileId).toBe("");
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
    const restored = parseWorkspacePayload(stored);

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

  it("repairs cyclic v7 folders instead of exposing an unusable tree", () => {
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
    const restored = parseWorkspacePayload(stored);

    expect(restored?.files[0]).toMatchObject({ title: "folder name.md", parentId: "workspace-root" });
    expect(restored?.folders.some((folder) => folder.id !== "workspace-root" && folder.parentId === "workspace-root")).toBe(true);
  });

  it("rejects non-Tabula project payloads", () => {
    const restored = parseWorkspacePayload({
        schema: "unknown.workspace",
        version: 2,
        activeDocumentId: "local",
        documentOrder: ["local"],
        documents: {
          local: createWorkspaceFile(1, { id: "local", title: "LOCAL.md", text: "# Local" }),
        },
        commentsByDocumentId: {},
      });

    expect(restored).toBeNull();
  });

  it("does not force the product README back into an existing project", () => {
    const stored = createStoredWorkspace({
      files: [createWorkspaceFile(1, { id: "local", title: "LOCAL.md", text: "# Local" })],
      activeFileId: "local",
      commentsByFileId: {},
    });
    const restored = parseWorkspacePayload(stored);

    expect(restored?.files.map((file) => file.title)).toEqual(["LOCAL.md"]);
    expect(restored?.activeFileId).toBe("local");
  });

  it("preserves the active blank document in an existing starter project", () => {
    const stored = createStoredWorkspace({
      files: [
        createWorkspaceFile(1, { id: "tabula-readme", title: "README.md", text: "# Guide", viewMode: "preview" }),
        createWorkspaceFile(2, { id: "blank", title: "Untitled.md", text: "", viewMode: "edit" }),
      ],
      activeFileId: "blank",
      commentsByFileId: {},
    });
    const restored = parseWorkspacePayload(stored);

    expect(restored?.files.map((file) => file.title)).toEqual(["README.md", "Untitled.md"]);
    expect(restored?.activeFileId).toBe("blank");
  });

  it("stores only document data and never embeds room credentials", () => {
    const stored = createStoredWorkspace({
      files: [
        createWorkspaceFile(1, { id: "local", title: "LOCAL.md", text: "# Local\n\nDraft" }),
        createWorkspaceFile(2, {
          id: "notes",
          title: "Notes.md",
          text: "# Notes",
        }),
      ],
      activeFileId: "notes",
      commentsByFileId: {},
    });
    const restored = parseWorkspacePayload(stored);
    const serialized = JSON.stringify(stored);

    expect(restored?.files.map(({ id, text }) => [id, text])).toEqual([
      ["local", "# Local\n\nDraft"],
      ["notes", "# Notes"],
    ]);
    expect(serialized).not.toContain("roomId");
    expect(serialized).not.toContain("shareUrl");
    expect(serialized).not.toContain("connectionStatus");
    expect(serialized).not.toContain("lastRecovery");
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
    const restored = parseWorkspacePayload(stored);

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
