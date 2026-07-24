import { describe, expect, it } from "vitest";
import { analyzeWorkspaceDocument } from "@tabula-md/tabula";
import {
  getWorkspaceEmbedMarkdown,
  MAX_WORKSPACE_EMBED_DEPTH,
} from "./workspacePreviewEmbeds";

const markdown = [
  "---",
  "title: Guide",
  "---",
  "# Guide",
  "",
  "Introduction.",
  "",
  "## Decision",
  "",
  "Use the shared contract.",
  "",
  "### Detail",
  "",
  "Keep nested context.",
  "",
  "## Next",
  "",
  "Continue.",
].join("\n");
const source = { id: "guide", path: "docs/guide.md", markdown };
const document = {
  ...source,
  headings: analyzeWorkspaceDocument(source).headings,
};

describe("workspace preview embeds", () => {
  it("removes valid frontmatter when embedding a whole document", () => {
    expect(getWorkspaceEmbedMarkdown(document)).toBe([
      "# Guide",
      "",
      "Introduction.",
      "",
      "## Decision",
      "",
      "Use the shared contract.",
      "",
      "### Detail",
      "",
      "Keep nested context.",
      "",
      "## Next",
      "",
      "Continue.",
    ].join("\n"));
  });

  it("embeds one heading section including its nested headings", () => {
    expect(getWorkspaceEmbedMarkdown(document, "decision")).toBe([
      "## Decision",
      "",
      "Use the shared contract.",
      "",
      "### Detail",
      "",
      "Keep nested context.",
    ].join("\n"));
  });

  it("returns undefined for a heading that is not in the indexed document", () => {
    expect(getWorkspaceEmbedMarkdown(document, "missing")).toBeUndefined();
  });

  it("keeps recursive rendering bounded", () => {
    expect(MAX_WORKSPACE_EMBED_DEPTH).toBeGreaterThan(1);
    expect(MAX_WORKSPACE_EMBED_DEPTH).toBeLessThanOrEqual(8);
  });
});
