import { describe, expect, it, vi } from "vitest";
import { buildLlmsFullTxt, buildLlmsTxt, buildPublishBundle } from "../../agentExports";
import { createWorkspaceFile, type WorkspaceFile } from "../../workspaceStorage";
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

describe("publish outputs", () => {
  const files: WorkspaceFile[] = [
    createWorkspaceFile(1, {
      id: "readme",
      title: "README.md",
      text: `---
title: Tabula.md
description: Product entry point.
---

# Tabula.md

Start here.`,
    }),
    createWorkspaceFile(2, {
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
      createWorkspaceFile(3, {
        id: "empty",
        title: "Untitled 2.md",
        text: "  \n",
      }),
      createWorkspaceFile(4, {
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
    const snapshotFiles: WorkspaceFile[] = files;
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
      files: snapshotFiles,
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
      createWorkspaceFile(1, {
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
