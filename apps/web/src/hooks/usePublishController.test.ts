import { describe, expect, it } from "vitest";
import type { PublishedSnapshot } from "../publish";
import { getPublishLifecyclePolicy } from "./usePublishController";

const publishedSnapshot = (ownerToken?: string): PublishedSnapshot => ({
  id: "publish_123",
  createdAt: "2026-06-21T17:38:00.000Z",
  activeFileId: "file_1",
  fileCount: 1,
  files: [{ id: "file_1", title: "README.md", text: "# README" }],
  commentsByFileId: {},
  urls: {
    page: "https://tabula.md/p/publish_123",
    llmsTxt: "https://tabula.md/p/publish_123/llms.txt",
    llmsFullTxt: "https://tabula.md/p/publish_123/llms-full.txt",
  },
  ...(ownerToken ? { ownerToken } : {}),
  llmsTxt: "# README",
  llmsFullTxt: "# README",
  markdownBundle: "# README",
  publishBundle: "# README",
});

describe("publish lifecycle policy", () => {
  it("treats local fallback snapshots as manageable and updateable", () => {
    expect(getPublishLifecyclePolicy(null, publishedSnapshot())).toEqual({
      canManagePublishedPage: true,
      isUpdatingPublishedPage: true,
      mode: "local",
      serviceUrl: null,
    });
  });

  it("requires an owner token to manage server-backed snapshots", () => {
    expect(getPublishLifecyclePolicy("https://publish.tabula.md", publishedSnapshot())).toEqual({
      canManagePublishedPage: false,
      isUpdatingPublishedPage: false,
      mode: "server",
      serviceUrl: "https://publish.tabula.md",
    });

    expect(getPublishLifecyclePolicy("https://publish.tabula.md", publishedSnapshot("owner_secret"))).toEqual({
      canManagePublishedPage: true,
      isUpdatingPublishedPage: true,
      mode: "server",
      serviceUrl: "https://publish.tabula.md",
    });
  });
});
