import { describe, expect, it } from "vitest";
import { createWorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import {
  decodeMarkdownPreviewFragment,
  resolveMarkdownPreviewWorkspaceLink,
} from "./workspacePreviewLinks";

const index = createWorkspaceKnowledgeIndex([
  {
    id: "start",
    path: "graph/start.md",
    markdown: [
      "# Start",
      "[Middle](./middle.md#decision)",
      "[This section](#start)",
      "[Missing](./missing.md)",
      "[External](https://example.com)",
      "[Email](mailto:hello@example.com)",
      "[[middle#Decision|Wiki middle]]",
      "![[middle#Decision]]",
      "[[Missing Wiki]]",
      "[[Shared]]",
    ].join("\n\n"),
  },
  {
    id: "middle",
    path: "graph/middle.md",
    markdown: "# Middle\n\n## Decision",
  },
  { id: "shared-a", path: "team-a/Shared.md", markdown: "# Shared A" },
  { id: "shared-b", path: "team-b/Shared.md", markdown: "# Shared B" },
]);

describe("workspace preview links", () => {
  it("maps resolved Markdown hrefs to workspace documents and fragments", () => {
    expect(resolveMarkdownPreviewWorkspaceLink(index, "start", "./middle.md#decision")).toEqual({
      status: "resolved",
      relation: "link",
      syntax: "markdown",
      targetDocumentId: "middle",
      targetPath: "graph/middle.md",
      fragment: "decision",
      sourceLineNumber: 3,
    });
    expect(resolveMarkdownPreviewWorkspaceLink(index, "start", "#start")).toEqual({
      status: "resolved",
      relation: "link",
      syntax: "markdown",
      targetDocumentId: "start",
      targetPath: "graph/start.md",
      fragment: "start",
      sourceLineNumber: 1,
    });
  });

  it("preserves broken state without treating safe external links as workspace links", () => {
    expect(resolveMarkdownPreviewWorkspaceLink(index, "start", "./missing.md")).toEqual({
      status: "broken",
      relation: "link",
      syntax: "markdown",
      targetPath: "graph/missing.md",
    });
    expect(resolveMarkdownPreviewWorkspaceLink(index, "start", "https://example.com")).toBeUndefined();
    expect(resolveMarkdownPreviewWorkspaceLink(index, "start", "mailto:hello@example.com")).toBeUndefined();
  });

  it("uses the same resolved and broken states for wiki links", () => {
    expect(
      resolveMarkdownPreviewWorkspaceLink(
        index,
        "start",
        "middle#Decision",
        "wikilink",
      ),
    ).toEqual({
      status: "resolved",
      relation: "link",
      syntax: "wikilink",
      targetDocumentId: "middle",
      targetPath: "graph/middle.md",
      fragment: "decision",
      sourceLineNumber: 3,
    });
    expect(
      resolveMarkdownPreviewWorkspaceLink(index, "start", "Missing Wiki", "wikilink"),
    ).toEqual({
      status: "broken",
      relation: "link",
      syntax: "wikilink",
      targetPath: "graph/Missing Wiki",
    });
    expect(
      resolveMarkdownPreviewWorkspaceLink(index, "start", "Shared", "wikilink"),
    ).toEqual({
      status: "ambiguous",
      relation: "link",
      syntax: "wikilink",
      targetPath: "graph/Shared",
    });
  });

  it("distinguishes an embed from a link with the same wiki target", () => {
    expect(
      resolveMarkdownPreviewWorkspaceLink(
        index,
        "start",
        "middle#Decision",
        "wikilink",
        "embed",
      ),
    ).toMatchObject({
      status: "resolved",
      relation: "embed",
      targetDocumentId: "middle",
      fragment: "decision",
    });
  });

  it("decodes URL-encoded heading fragments without throwing on malformed input", () => {
    expect(decodeMarkdownPreviewFragment("review%20notes")).toBe("review notes");
    expect(decodeMarkdownPreviewFragment("%E0%A4%A")).toBe("%E0%A4%A");
  });
});
