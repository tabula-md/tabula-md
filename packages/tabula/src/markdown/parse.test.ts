import { describe, expect, it } from "vitest";
import {
  getMarkdownDocumentTitle,
  getOutlineHeadings,
  getOutlineHeadingsFromMarkdown,
  getPreviewBody,
  parseFrontmatter,
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

  it("treats invalid frontmatter as normal markdown text", () => {
    const markdown = `---\ntitle: HELP\na\n---\n\n# HELP`;

    expect(parseFrontmatter(markdown)).toEqual({
      attributes: [],
      body: markdown,
    });
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
    expect(getOutlineHeadings(getPreviewBody("\n# Intro\n\n## Scope"))).toEqual([
      { depth: 1, text: "Intro", lineIndex: 1, sourceLineIndex: 1 },
      { depth: 2, text: "Scope", lineIndex: 3, sourceLineIndex: 3 },
    ]);
  });

  it("extracts outline headings directly from markdown text", () => {
    expect(getOutlineHeadingsFromMarkdown("\n# Intro\n\n## Scope\n\n#### Hidden")).toEqual([
      { depth: 1, text: "Intro", lineIndex: 1, sourceLineIndex: 1 },
      { depth: 2, text: "Scope", lineIndex: 3, sourceLineIndex: 3 },
    ]);
  });
});
