import { describe, expect, it } from "vitest";
import {
  getMarkdownDocumentTitle,
  getOutlineHeadings,
  getPreviewBody,
  getSearchMatches,
  parseFrontmatter,
} from "./markdown";

describe("markdown document model", () => {
  it("parses valid frontmatter without hiding body headings", () => {
    const parsed = parseFrontmatter(`---\ntitle: HELP\ndescription: Quick reference\n---\n\n# HELP`);

    expect(parsed.attributes).toEqual([
      { key: "title", value: "HELP" },
      { key: "description", value: "Quick reference" },
    ]);
    expect(parsed.body).toBe("\n# HELP");
  });

  it("treats invalid frontmatter as normal markdown text", () => {
    const markdown = `---\ntitle: HELP\na\n---\n\n# HELP`;

    expect(parseFrontmatter(markdown)).toEqual({
      attributes: [],
      body: markdown,
    });
  });

  it("derives document titles from frontmatter before headings", () => {
    expect(getMarkdownDocumentTitle("---\ntitle: Brief\n---\n\n# Other")).toBe("Brief");
    expect(getMarkdownDocumentTitle("# Heading")).toBe("Heading");
  });

  it("extracts outline headings from preview body line positions", () => {
    expect(getOutlineHeadings(getPreviewBody("\n# Intro\n\n## Scope"))).toEqual([
      { depth: 1, text: "Intro", lineIndex: 1, sourceLineIndex: 1 },
      { depth: 2, text: "Scope", lineIndex: 3, sourceLineIndex: 3 },
    ]);
  });

  it("returns case-insensitive search matches with compact previews", () => {
    expect(getSearchMatches("Alpha beta alpha", "ALPHA")).toEqual([
      { start: 0, end: 5, preview: "Alpha beta alpha" },
      { start: 11, end: 16, preview: "Alpha beta alpha" },
    ]);
  });
});
