import { describe, expect, it } from "vitest";
import {
  addFrontmatterValue,
  removeFrontmatterValue,
  renameFrontmatterKey,
  getMarkdownDocumentTitle,
  getOutlineHeadings,
  getOutlineHeadingsFromMarkdown,
  getPreviewBody,
  inspectFrontmatterData,
  parseFrontmatter,
  parseFrontmatterData,
  updateFrontmatterValue,
} from "./parse";

describe("markdown document model", () => {
  it("parses valid frontmatter without hiding body headings", () => {
    const parsed = parseFrontmatter(`---\ntitle: HELP\ndescription: Quick reference\n---\n\n# HELP`);

    expect(parsed.attributes).toEqual([
      { key: "title", value: "HELP" },
      { key: "description", value: "Quick reference" },
    ]);
    expect(parsed.body).toBe("\n# HELP");
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

  it("preserves typed frontmatter data and the body source offset", () => {
    const markdown = "---\r\ntags: [prd, design]\r\nowner:\r\n  team: Product\r\n---\r\n\r\nBody";
    const parsed = parseFrontmatterData(markdown);

    expect(parsed.metadata).toEqual({
      tags: ["prd", "design"],
      owner: { team: "Product" },
    });
    expect(parsed.body).toBe("\r\nBody");
    expect(parsed.bodyOffset).toBe(markdown.indexOf("\r\nBody"));
  });

  it("updates one frontmatter value without dropping comments or extension fields", () => {
    const markdown = [
      "---",
      "title: Guide # visible title",
      "status: draft",
      "extension: { owner: taeha }",
      "---",
      "",
      "# Body",
    ].join("\n");
    const result = updateFrontmatterValue(markdown, "status", "stable");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toContain("title: Guide # visible title");
    expect(result.markdown).toContain("status: stable");
    expect(result.markdown).toContain("extension: { owner: taeha }");
    expect(result.markdown.endsWith("\n# Body")).toBe(true);
  });

  it("does not reformat sibling frontmatter values", () => {
    const markdown = "---\ntags: [incident, operations]\nstatus: draft\n---\nBody";
    const result = updateFrontmatterValue(markdown, "status", "stable");

    expect(result).toEqual({
      ok: true,
      markdown: "---\ntags: [incident, operations]\nstatus: stable\n---\nBody",
    });
  });

  it("keeps comments attached to the value being edited", () => {
    const markdown = "---\nstatus: draft # lifecycle state\ntags: [docs, help] # search labels\n---\nBody";
    const statusResult = updateFrontmatterValue(markdown, "status", "stable");

    expect(statusResult).toEqual({
      ok: true,
      markdown: "---\nstatus: stable # lifecycle state\ntags: [docs, help] # search labels\n---\nBody",
    });
    if (!statusResult.ok) return;
    expect(updateFrontmatterValue(statusResult.markdown, "tags", ["docs", "reference"]))
      .toEqual({
        ok: true,
        markdown: "---\nstatus: stable # lifecycle state\ntags: [ docs, reference ] # search labels\n---\nBody",
      });
  });

  it("keeps the next key on a new line when replacing a block collection", () => {
    const markdown = [
      "---",
      "generated:",
      "  by: human:taeha",
      "  at: 2026-01-10T00:00:00Z",
      "verified:",
      "  - by: human:taeha",
      "---",
      "Body",
    ].join("\n");

    expect(updateFrontmatterValue(markdown, "generated", {
      by: "human:taeha",
      at: "2026-01-11T00:00:00Z",
    })).toEqual({
      ok: true,
      markdown: [
        "---",
        "generated:",
        "  { by: human:taeha, at: 2026-01-11T00:00:00Z }",
        "verified:",
        "  - by: human:taeha",
        "---",
        "Body",
      ].join("\n"),
    });
  });

  it("adds a property immediately before the closing delimiter", () => {
    expect(addFrontmatterValue("---\ntitle: Guide\n---\nBody", "owner", "team:docs"))
      .toEqual({
        ok: true,
        markdown: "---\ntitle: Guide\nowner: team:docs\n---\nBody",
      });
  });

  it("adds the first property to an empty frontmatter block", () => {
    expect(addFrontmatterValue("---\n---\nBody", "title", "Guide")).toEqual({
      ok: true,
      markdown: "---\ntitle: Guide\n---\nBody",
    });
  });

  it("creates frontmatter when adding the first property to a plain document", () => {
    expect(addFrontmatterValue("# Guide\n\nBody", "title", "Guide")).toEqual({
      ok: true,
      markdown: "---\ntitle: Guide\n---\n\n# Guide\n\nBody",
    });
  });

  it("creates frontmatter in an empty document without adding a visible body", () => {
    expect(addFrontmatterValue("", "draft", true)).toEqual({
      ok: true,
      markdown: "---\ndraft: true\n---\n",
    });
  });

  it("preserves CRLF line endings when creating frontmatter", () => {
    expect(addFrontmatterValue("# Guide\r\n\r\nBody", "title", "Guide")).toEqual({
      ok: true,
      markdown: "---\r\ntitle: Guide\r\n---\r\n\r\n# Guide\r\n\r\nBody",
    });
  });

  it("does not hide malformed frontmatter by prepending another block", () => {
    expect(addFrontmatterValue("---\ntitle: [\nBody", "owner", "team:docs")).toEqual({
      ok: false,
      reason: "invalid_frontmatter",
    });
  });

  it("supports human-readable and quoted YAML property names", () => {
    const added = addFrontmatterValue(
      "---\ntitle: Guide\n---\nBody",
      "검토 상태",
      "draft",
    );
    expect(added).toEqual({
      ok: true,
      markdown: "---\ntitle: Guide\n검토 상태: draft\n---\nBody",
    });
    if (!added.ok) return;
    expect(renameFrontmatterKey(added.markdown, "검토 상태", "#review state"))
      .toEqual({
        ok: true,
        markdown: "---\ntitle: Guide\n\"#review state\": draft\n---\nBody",
      });
  });

  it("renames and removes properties without reformatting their siblings", () => {
    const markdown = "---\ntitle: Guide\ntags: [docs, help]\nowner: team:docs\n---\nBody";
    expect(renameFrontmatterKey(markdown, "owner", "maintainer")).toEqual({
      ok: true,
      markdown: "---\ntitle: Guide\ntags: [docs, help]\nmaintainer: team:docs\n---\nBody",
    });
    expect(removeFrontmatterValue(markdown, "tags")).toEqual({
      ok: true,
      markdown: "---\ntitle: Guide\nowner: team:docs\n---\nBody",
    });
  });

  it("treats invalid frontmatter as normal markdown text", () => {
    const markdown = `---\ntitle: HELP\na\n---\n\n# HELP`;

    expect(parseFrontmatter(markdown)).toEqual({
      attributes: [],
      body: markdown,
    });
  });

  it("distinguishes absent, empty, malformed, and unclosed frontmatter", () => {
    expect(inspectFrontmatterData("# No frontmatter").status).toBe("absent");
    expect(inspectFrontmatterData("---\n---\n\nBody")).toMatchObject({
      status: "valid",
      metadata: {},
      body: "\nBody",
    });
    expect(inspectFrontmatterData("---\ntype: [\n---\n\nBody").status).toBe("invalid");
    expect(inspectFrontmatterData("---\ntype: Note").status).toBe("invalid");
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

  it("derives document titles from frontmatter before headings", () => {
    expect(getMarkdownDocumentTitle("---\ntitle: Product Requirements\n---\n\n# PRD\n")).toBe(
      "Product Requirements",
    );
    expect(getMarkdownDocumentTitle("\n# Design Brief\n\nBody")).toBe("Design Brief");
    expect(getMarkdownDocumentTitle("Plain body")).toBe("");
  });

  it("keeps preview body unchanged when frontmatter title matches the first H1", () => {
    expect(getPreviewBody("\n# Diagnose\n\nA discipline.")).toEqual({
      body: "\n# Diagnose\n\nA discipline.",
      sourceLineOffset: 0,
    });
  });

  it("extracts outline headings from preview body line positions", () => {
    expect(getOutlineHeadings({
      body: "\n# Intro\n\n```markdown\n## Example\n```\n\n## Scope",
      sourceLineOffset: 4,
    })).toEqual([
      { depth: 1, text: "Intro", lineIndex: 1, sourceLineIndex: 5 },
      { depth: 2, text: "Scope", lineIndex: 7, sourceLineIndex: 11 },
    ]);
  });

  it("extracts outline headings directly from markdown text", () => {
    expect(getOutlineHeadingsFromMarkdown("\n# Intro\n\n## Scope\n\n#### Hidden")).toEqual([
      { depth: 1, text: "Intro", lineIndex: 1, sourceLineIndex: 1 },
      { depth: 2, text: "Scope", lineIndex: 3, sourceLineIndex: 3 },
    ]);
  });

  it("excludes headings inside backtick and tilde fenced code blocks", () => {
    const markdown = [
      "# Document",
      "",
      "```markdown",
      "# Code heading",
      "## Nested code heading",
      "```",
      "",
      "## Visible",
      "",
      "~~~md",
      "### Tilde code heading",
      "~~~~",
      "",
      "### Also visible",
      "",
      "```markdown",
      "# Heading in an unclosed fence",
    ].join("\r\n");

    expect(getOutlineHeadingsFromMarkdown(markdown)).toEqual([
      { depth: 1, text: "Document", lineIndex: 0, sourceLineIndex: 0 },
      { depth: 2, text: "Visible", lineIndex: 7, sourceLineIndex: 7 },
      { depth: 3, text: "Also visible", lineIndex: 13, sourceLineIndex: 13 },
    ]);
  });
});
