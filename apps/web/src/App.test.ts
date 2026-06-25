import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLlmsFullTxt, buildLlmsTxt, buildPublishBundle } from "./agentExports";
import { COMMENT_ANCHOR_CONTEXT_LENGTH, getCommentRangeInText } from "./commentAnchors";
import { getPreviewBody, parseFrontmatter } from "./markdown";
import {
  createPublishedSnapshot,
  createServerPublishedSnapshot,
  getEmptyPublishFiles,
  getEmptyPublishFilesMessage,
  getPublishRoute,
  readServerPublishedSnapshot,
  republishServerPublishedSnapshot,
  unpublishServerPublishedSnapshot,
} from "./publish";
import {
  createMarkdownFile,
  createStoredWorkspace,
  ensureDefaultFiles,
  ensureLiveFileForRoom,
  finalizeWorkspaceState,
  getLiveFileTitle,
  migrateWorkspacePayload,
  PROJECT_STORAGE_VERSION,
  type MarkdownFile,
} from "./workspaceStorage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("frontmatter parsing", () => {
  it("parses title, description, and body", () => {
    const parsed = parseFrontmatter(`---
title: Diagnose
description: Hard bug loop
---

# Diagnose

Body`);

    expect(parsed.attributes).toEqual([
      { key: "title", value: "Diagnose" },
      { key: "description", value: "Hard bug loop" },
    ]);
    expect(parsed.body).toBe("\n# Diagnose\n\nBody");
  });

  it("formats multiline, arrays, and nested object metadata", () => {
    const parsed = parseFrontmatter(`---
description: |
  First line
  Second line
summary: >
  Folded
  value
tags:
  - prd
  - design
owner:
  name: Taeha
  team: Product
inline: { status: draft, owner: taeha }
---

Body`);

    expect(parsed.attributes).toContainEqual({ key: "description", value: "First line\nSecond line" });
    expect(parsed.attributes).toContainEqual({ key: "summary", value: "Folded value" });
    expect(parsed.attributes).toContainEqual({ key: "tags", value: "prd, design" });
    expect(parsed.attributes).toContainEqual({ key: "owner", value: "name: Taeha\nteam: Product" });
    expect(parsed.attributes).toContainEqual({ key: "inline", value: "status: draft\nowner: taeha" });
    expect(parsed.body).toBe("\nBody");
  });

  it("does not treat top horizontal rules as frontmatter without metadata key-values", () => {
    const markdown = `---
Intro divider
---

Body`;

    expect(parseFrontmatter(markdown)).toEqual({
      attributes: [],
      body: markdown,
    });
  });

  it("does not coerce bare frontmatter lines into boolean metadata", () => {
    const markdown = `---
title: HELP
a
---

# HELP`;

    expect(parseFrontmatter(markdown)).toEqual({
      attributes: [],
      body: markdown,
    });
  });

  it("only closes frontmatter on a standalone delimiter line", () => {
    const markdown = `---
title: Diagnose
--- not a delimiter
---

Body`;

    expect(parseFrontmatter(markdown)).toEqual({
      attributes: [],
      body: markdown,
    });
  });

  it("keeps the Markdown body unchanged even when frontmatter title matches the first H1", () => {
    expect(getPreviewBody("\n# Diagnose\n\nA discipline.")).toEqual({
      body: "\n# Diagnose\n\nA discipline.",
      sourceLineOffset: 0,
    });
  });
});

describe("file tab state transitions", () => {
  it("opens the product README first and keeps a blank file available", () => {
    const files = ensureDefaultFiles([], { ensureUntitled: true });

    expect(files.map((file) => file.title)).toEqual(["README.md", "Untitled.md"]);
    expect(files[0].viewMode).toBe("preview");
    expect(files[0].text).toContain("Tabula.md is a local-first Markdown workspace");
    expect(files[1].viewMode).toBe("edit");
    expect(files[1].text).toBe("");
  });

  it("opens a shared room without replacing local tabs", () => {
    const localFiles = ensureDefaultFiles([], { ensureUntitled: true });
    const files = ensureLiveFileForRoom(localFiles, {
      roomId: "browserroom",
      shareUrl: "http://localhost:5174/r/browserroom#key=test",
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
        shareUrl: "http://localhost:5174/r/room-a#key=old",
      }),
      {
        roomId: "room-a",
        shareUrl: "http://localhost:5174/r/room-a#key=new",
      },
    );

    expect(files.filter((file) => file.roomId === "room-a")).toHaveLength(1);
    expect(files.find((file) => file.roomId === "room-a")?.shareUrl).toBe(
      "http://localhost:5174/r/room-a#key=new",
    );
  });

  it("opens a fresh project on the product README", () => {
    const restored = finalizeWorkspaceState([], undefined, {}, { includeLocationRoom: false });

    expect(restored.files.map((file) => file.title)).toEqual(["README.md", "Untitled.md"]);
    expect(restored.activeFileId).toBe(restored.files[0].id);
  });
});

describe("project persistence", () => {
  it("preserves per-file view modes and active file", () => {
    const files: MarkdownFile[] = [
      createMarkdownFile(1, { id: "prd", title: "PRD.md", text: "# PRD", viewMode: "split" }),
      createMarkdownFile(2, { id: "design", title: "DESIGN.md", text: "# Design", viewMode: "preview" }),
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
          local: createMarkdownFile(1, { id: "local", title: "LOCAL.md", text: "# Local" }),
        },
        commentsByDocumentId: {},
      },
      { includeLocationRoom: false },
    );

    expect(restored).toBeNull();
  });

  it("does not force the product README back into an existing project", () => {
    const stored = createStoredWorkspace({
      files: [createMarkdownFile(1, { id: "local", title: "LOCAL.md", text: "# Local" })],
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
        createMarkdownFile(1, { id: "tabula-readme", title: "README.md", text: "# Guide", viewMode: "preview" }),
        createMarkdownFile(2, { id: "blank", title: "Untitled.md", text: "", viewMode: "edit" }),
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
        createMarkdownFile(1, { id: "local", title: "LOCAL.md", text: "# Local\n\nDraft" }),
        createMarkdownFile(2, {
          id: "live",
          title: "Shared room.md",
          text: "# Live",
          roomId: "room-live",
          shareUrl: "http://localhost:5174/r/room-live#key=secret",
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
      shareUrl: "http://localhost:5174/r/room-live#key=secret",
      connectionStatus: "offline",
      snapshotCount: 3,
      lastSnapshotAt: "2026-06-11T00:00:00.000Z",
      lastRecoveryType: "snapshot-recovered",
      lastRecoveryMessage: "Recovered",
      lastRecoveryAt: "2026-06-11T00:01:00.000Z",
    });
  });

  it("preserves comment source ranges across reloads", () => {
    const stored = createStoredWorkspace({
      files: [createMarkdownFile(1, { id: "local", title: "LOCAL.md", text: "Quoted source text." })],
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

describe("publish outputs", () => {
  const files: MarkdownFile[] = [
    createMarkdownFile(1, {
      id: "readme",
      title: "README.md",
      text: `---
title: Tabula.md
description: Product entry point.
---

# Tabula.md

Start here.`,
    }),
    createMarkdownFile(2, {
      id: "prd",
      title: "PRD.md",
      text: "# Product Requirements\n\nShip the project.",
    }),
  ];

  it("builds llms.txt as a compact project index", () => {
    const llms = buildLlmsTxt(files, "prd");

    expect(llms).toContain("- Active file: PRD.md");
    expect(llms).toContain("- README.md - Product entry point.");
    expect(llms).toContain("- PRD.md");
    expect(llms).toContain("Use llms-full.txt");
  });

  it("builds llms-full.txt and a publish bundle from open files", () => {
    const commentsByFileId = {
      prd: [
        {
          id: "comment",
          body: "Clarify launch scope.",
          authorName: "Taeha",
          quote: "Ship the project.",
          replies: [
            {
              id: "reply",
              body: "Added launch detail.",
              authorName: "Guest",
              createdAt: "2026-06-14T00:01:00.000Z",
            },
          ],
          resolved: false,
          createdAt: "2026-06-14T00:00:00.000Z",
        },
        {
          id: "resolved-comment",
          body: "Already handled.",
          quote: "Product Requirements",
          resolved: true,
          createdAt: "2026-06-14T00:00:00.000Z",
        },
      ],
    };
    const full = buildLlmsFullTxt(files, "prd", commentsByFileId);
    const bundle = buildPublishBundle(files, "prd", commentsByFileId);

    expect(full).toContain("## README.md");
    expect(full).toContain("## PRD.md");
    expect(full).toContain("## Open Comments");
    expect(full).toContain("Clarify launch scope.");
    expect(full).toContain("Ship the project.");
    expect(full).toContain("Guest: Added launch detail.");
    expect(full).not.toContain("Already handled.");
    expect(bundle).toContain("# Tabula.md Project Publish Bundle");
    expect(bundle).toContain("## llms.txt");
    expect(bundle).toContain("## llms-full.txt");
    expect(bundle).toContain("## Markdown Bundle");
  });

  it("creates a publish snapshot with page and agent endpoint URLs", () => {
    const snapshot = createPublishedSnapshot({
      id: "snapshot-1",
      origin: "https://tabula.md",
      ownerName: "Taeha",
      files,
      activeFileId: "prd",
      commentsByFileId: {},
    });

    expect(snapshot.ownerName).toBe("Taeha");
    expect(snapshot.urls.page).toBe("https://tabula.md/p/snapshot-1");
    expect(snapshot.urls.llmsTxt).toBe("https://tabula.md/p/snapshot-1/llms.txt");
    expect(snapshot.urls.llmsFullTxt).toBe("https://tabula.md/p/snapshot-1/llms-full.txt");
    expect(snapshot.llmsTxt).toContain("Use llms-full.txt");
    expect(snapshot.llmsFullTxt).toContain("## PRD.md");
    expect(snapshot.publishBundle).toContain("## Markdown Bundle");
  });

  it("creates a current-page publish payload from a single scoped file", () => {
    const snapshot = createPublishedSnapshot({
      id: "page-1",
      origin: "https://tabula.md",
      scope: "file",
      files: [files[1]],
      activeFileId: "prd",
      commentsByFileId: {
        readme: [
          {
            id: "readme-comment",
            body: "Keep this out of a page-only publish.",
            createdAt: "2026-06-14T00:00:00.000Z",
          },
        ],
        prd: [
          {
            id: "prd-comment",
            body: "Include this page comment.",
            createdAt: "2026-06-14T00:00:00.000Z",
          },
        ],
      },
    });

    expect(snapshot.fileCount).toBe(1);
    expect(snapshot.scope).toBe("file");
    expect(snapshot.files).toEqual([{ id: "prd", title: "PRD.md", text: files[1].text }]);
    expect(snapshot.commentsByFileId).toEqual({
      prd: [
        {
          id: "prd-comment",
          body: "Include this page comment.",
          createdAt: "2026-06-14T00:00:00.000Z",
        },
      ],
    });
    expect(snapshot.llmsTxt).toContain("Files: 1");
    expect(snapshot.llmsFullTxt).toContain("## PRD.md");
    expect(snapshot.llmsFullTxt).not.toContain("## README.md");
    expect(snapshot.llmsFullTxt).toContain("Include this page comment.");
    expect(snapshot.llmsFullTxt).not.toContain("Keep this out of a page-only publish.");
  });

  it("rejects publish payloads when any selected Markdown file is empty", () => {
    const emptyFiles = [
      files[0],
      createMarkdownFile(3, {
        id: "empty",
        title: "Untitled 2.md",
        text: "  \n",
      }),
      createMarkdownFile(4, {
        id: "empty-notes",
        title: "Notes.markdown",
        text: "",
      }),
    ];

    expect(getEmptyPublishFiles(emptyFiles).map((file) => file.id)).toEqual(["empty", "empty-notes"]);
    expect(getEmptyPublishFilesMessage([emptyFiles[1]], "file")).toBe("Add content to Untitled 2 before publishing.");
    expect(getEmptyPublishFilesMessage(emptyFiles, "project")).toBe(
      "Add content to Untitled 2 and 1 other empty project file before publishing.",
    );
    expect(() =>
      createPublishedSnapshot({
        id: "blocked",
        origin: "https://tabula.md",
        scope: "project",
        files: emptyFiles,
        activeFileId: "readme",
        commentsByFileId: {},
      }),
    ).toThrow("Add content to Untitled 2 and 1 other empty project file before publishing.");
  });

  it("creates server-backed publish snapshots with sanitized payload and service URLs", async () => {
    const liveFiles: MarkdownFile[] = [
      {
        ...files[0],
        roomId: "room-123",
        shareUrl: "https://tabula.md/r/room-123#key=secret",
        connectionStatus: "connected",
      },
      files[1],
    ];
    const commentsByFileId = {
      prd: [
        {
          id: "comment",
          body: "Clarify launch scope.",
          authorName: "Taeha",
          quote: "Ship the project.",
          resolved: false,
          createdAt: "2026-06-14T00:00:00.000Z",
        },
      ],
      deleted: [
        {
          id: "deleted-comment",
          body: "Do not publish this.",
          createdAt: "2026-06-14T00:00:00.000Z",
        },
      ],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://publish.tabula.md/v1/publishes");
      const payload = JSON.parse(String(init?.body)) as {
        ownerName?: string;
        activeFileId: string;
        files: Array<Record<string, unknown>>;
        commentsByFileId: Record<string, unknown>;
        llmsTxt: string;
        llmsFullTxt: string;
      };

      expect(payload.ownerName).toBe("Taeha");
      expect(payload.activeFileId).toBe("prd");
      expect(payload.files[0]).toEqual({
        id: "readme",
        title: "README.md",
        text: files[0].text,
      });
      expect(payload.files[0]).not.toHaveProperty("roomId");
      expect(payload.files[0]).not.toHaveProperty("shareUrl");
      expect(payload.files[0]).not.toHaveProperty("viewMode");
      expect(payload.commentsByFileId.prd).toEqual([
        {
          id: "comment",
          body: "Clarify launch scope.",
          authorName: "Taeha",
          quote: "Ship the project.",
          resolved: false,
          createdAt: "2026-06-14T00:00:00.000Z",
        },
      ]);
      expect(payload.commentsByFileId.deleted).toBeUndefined();
      expect(payload.llmsTxt).toContain("Use llms-full.txt");
      expect(payload.llmsFullTxt).toContain("Clarify launch scope.");

      return new Response(
        JSON.stringify({
          publishId: "publish_123456",
          createdAt: "2026-06-19T00:00:00.000Z",
          updatedAt: "2026-06-19T00:00:00.000Z",
          ownerToken: "owner-token",
          urls: {
            page: "https://publish.tabula.md/p/publish_123456",
            llmsTxt: "https://publish.tabula.md/p/publish_123456/llms.txt",
            llmsFullTxt: "https://publish.tabula.md/p/publish_123456/llms-full.txt",
            appPage: "https://tabula.md/p/publish_123456",
          },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const snapshot = await createServerPublishedSnapshot({
      serviceUrl: "https://publish.tabula.md/",
      origin: "https://tabula.md",
      scope: "project",
      ownerName: "Taeha",
      files: liveFiles,
      activeFileId: "prd",
      commentsByFileId,
      fetchImpl: fetchMock,
    });

    expect(snapshot.id).toBe("publish_123456");
    expect(snapshot.scope).toBe("project");
    expect(snapshot.ownerName).toBe("Taeha");
    expect(snapshot.urls.page).toBe("https://tabula.md/p/publish_123456");
    expect(snapshot.urls.llmsTxt).toBe("https://publish.tabula.md/p/publish_123456/llms.txt");
    expect(snapshot.servicePageUrl).toBe("https://publish.tabula.md/p/publish_123456");
    expect(snapshot.ownerToken).toBe("owner-token");
    expect(snapshot.files[0]).not.toHaveProperty("roomId");
  });

  it("reads public publish snapshots from the publish service for vanity pages", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://publish.tabula.md/v1/publishes/publish_123456");
      return new Response(
        JSON.stringify({
          v: 1,
          publishId: "publish_123456",
          createdAt: "2026-06-19T00:00:00.000Z",
          updatedAt: "2026-06-19T00:00:00.000Z",
          ownerName: "Taeha",
          activeFileId: "readme",
          fileCount: 2,
          files: [
            { id: "readme", title: "README.md", text: "# Published" },
            { id: "empty", title: "Untitled.md", text: "" },
          ],
          commentsByFileId: {},
          llmsTxt: "# Tabula.md\n\nUse llms-full.txt",
          llmsFullTxt: "# Tabula.md Agent Context\n\n## README.md",
          urls: {
            page: "https://publish.tabula.md/p/publish_123456",
            llmsTxt: "https://publish.tabula.md/p/publish_123456/llms.txt",
            llmsFullTxt: "https://publish.tabula.md/p/publish_123456/llms-full.txt",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const snapshot = await readServerPublishedSnapshot({
      serviceUrl: "https://publish.tabula.md",
      origin: "https://tabula.md",
      snapshotId: "publish_123456",
      fetchImpl: fetchMock,
    });

    expect(snapshot?.urls.page).toBe("https://tabula.md/p/publish_123456");
    expect(snapshot?.urls.llmsTxt).toBe("https://publish.tabula.md/p/publish_123456/llms.txt");
    expect(snapshot?.servicePageUrl).toBe("https://publish.tabula.md/p/publish_123456");
    expect(snapshot?.ownerToken).toBeUndefined();
    expect(snapshot?.ownerName).toBe("Taeha");
    expect(snapshot?.files).toEqual([
      { id: "readme", title: "README.md", text: "# Published" },
      { id: "empty", title: "Untitled.md", text: "" },
    ]);
  });

  it("republishes server-backed snapshots with the owner token and stable URLs", async () => {
    const existingSnapshot = {
      id: "publish_123456",
      createdAt: "2026-06-19T00:00:00.000Z",
      updatedAt: "2026-06-19T00:00:00.000Z",
      activeFileId: "readme",
      fileCount: 1,
      files: [{ id: "readme", title: "README.md", text: "# Before" }],
      commentsByFileId: {},
      urls: {
        page: "https://tabula.md/p/publish_123456",
        llmsTxt: "https://publish.tabula.md/p/publish_123456/llms.txt",
        llmsFullTxt: "https://publish.tabula.md/p/publish_123456/llms-full.txt",
      },
      servicePageUrl: "https://publish.tabula.md/p/publish_123456",
      ownerToken: "owner-token",
      llmsTxt: "# Tabula.md",
      llmsFullTxt: "# Tabula.md Agent Context",
      markdownBundle: "# Before",
      publishBundle: "# Bundle",
    };
    const updatedFiles = [
      createMarkdownFile(1, {
        id: "readme",
        title: "README.md",
        text: "# After",
      }),
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://publish.tabula.md/v1/publishes/publish_123456");
      expect(init?.method).toBe("PUT");
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.authorization).toBe("Bearer owner-token");
      const payload = JSON.parse(String(init?.body)) as { ownerName?: string; files: Array<Record<string, unknown>> };
      expect(payload.ownerName).toBe("Taeha");
      expect(payload.files).toEqual([{ id: "readme", title: "README.md", text: "# After" }]);

      return new Response(
        JSON.stringify({
          publishId: "publish_123456",
          createdAt: "2026-06-19T00:00:00.000Z",
          updatedAt: "2026-06-19T00:01:00.000Z",
          urls: {
            page: "https://publish.tabula.md/p/publish_123456",
            llmsTxt: "https://publish.tabula.md/p/publish_123456/llms.txt",
            llmsFullTxt: "https://publish.tabula.md/p/publish_123456/llms-full.txt",
            appPage: "https://tabula.md/p/publish_123456",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const snapshot = await republishServerPublishedSnapshot({
      serviceUrl: "https://publish.tabula.md",
      origin: "https://tabula.md",
      scope: "file",
      ownerName: "Taeha",
      snapshot: existingSnapshot,
      files: updatedFiles,
      activeFileId: "readme",
      commentsByFileId: {},
      fetchImpl: fetchMock,
    });

    expect(snapshot.id).toBe("publish_123456");
    expect(snapshot.scope).toBe("file");
    expect(snapshot.ownerName).toBe("Taeha");
    expect(snapshot.createdAt).toBe(existingSnapshot.createdAt);
    expect(snapshot.updatedAt).toBe("2026-06-19T00:01:00.000Z");
    expect(snapshot.urls.page).toBe(existingSnapshot.urls.page);
    expect(snapshot.ownerToken).toBe("owner-token");
    expect(snapshot.files).toEqual([{ id: "readme", title: "README.md", text: "# After" }]);
  });

  it("unpublishes server-backed snapshots with the owner token", async () => {
    const snapshot = {
      id: "publish_123456",
      createdAt: "2026-06-19T00:00:00.000Z",
      activeFileId: "readme",
      fileCount: 1,
      files: [{ id: "readme", title: "README.md", text: "# Published" }],
      commentsByFileId: {},
      urls: {
        page: "https://tabula.md/p/publish_123456",
        llmsTxt: "https://publish.tabula.md/p/publish_123456/llms.txt",
        llmsFullTxt: "https://publish.tabula.md/p/publish_123456/llms-full.txt",
      },
      ownerToken: "owner-token",
      llmsTxt: "# Tabula.md",
      llmsFullTxt: "# Tabula.md Agent Context",
      markdownBundle: "# Published",
      publishBundle: "# Bundle",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://publish.tabula.md/v1/publishes/publish_123456");
      expect(init?.method).toBe("DELETE");
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.authorization).toBe("Bearer owner-token");
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;

    await expect(
      unpublishServerPublishedSnapshot({
        serviceUrl: "https://publish.tabula.md",
        snapshot,
        fetchImpl: fetchMock,
      }),
    ).resolves.toBeUndefined();
  });

  it("surfaces unpublish service errors", async () => {
    const snapshot = {
      id: "publish_123456",
      createdAt: "2026-06-19T00:00:00.000Z",
      activeFileId: "readme",
      fileCount: 1,
      files: [{ id: "readme", title: "README.md", text: "# Published" }],
      commentsByFileId: {},
      urls: {
        page: "https://tabula.md/p/publish_123456",
        llmsTxt: "https://publish.tabula.md/p/publish_123456/llms.txt",
        llmsFullTxt: "https://publish.tabula.md/p/publish_123456/llms-full.txt",
      },
      ownerToken: "owner-token",
      llmsTxt: "# Tabula.md",
      llmsFullTxt: "# Tabula.md Agent Context",
      markdownBundle: "# Published",
      publishBundle: "# Bundle",
    };
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "Owner token is invalid" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
    ) as unknown as typeof fetch;

    await expect(
      unpublishServerPublishedSnapshot({
        serviceUrl: "https://publish.tabula.md",
        snapshot,
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow("Publish failed: Owner token is invalid");
  });

  it("surfaces publish service errors", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          statusText: "Too Many Requests",
          headers: { "content-type": "application/json" },
        }),
    ) as unknown as typeof fetch;

    await expect(
      createServerPublishedSnapshot({
        serviceUrl: "https://publish.tabula.md",
        origin: "https://tabula.md",
        files,
        activeFileId: "prd",
        commentsByFileId: {},
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow("Publish failed: Rate limit exceeded");
  });

  it("parses publish routes for page and agent outputs", () => {
    expect(getPublishRoute("/p/snapshot-1")).toEqual({ snapshotId: "snapshot-1", output: "page" });
    expect(getPublishRoute("/p/snapshot-1", "?file=prd")).toEqual({
      snapshotId: "snapshot-1",
      output: "page",
      fileId: "prd",
    });
    expect(getPublishRoute("/p/snapshot-1/llms.txt")).toEqual({ snapshotId: "snapshot-1", output: "llms.txt" });
    expect(getPublishRoute("/p/snapshot-1/llms.txt", "?file=prd")).toEqual({
      snapshotId: "snapshot-1",
      output: "llms.txt",
    });
    expect(getPublishRoute("/p/snapshot-1/llms-full.txt")).toEqual({
      snapshotId: "snapshot-1",
      output: "llms-full.txt",
    });
    expect(getPublishRoute("/")).toBeNull();
  });
});
