import { describe, expect, it } from "vitest";
import { applyMarkdownFormat, type MarkdownFormatCommand } from "./formatting";

describe("markdown formatting commands", () => {
  it("wraps selected text with bold markers", () => {
    expect(applyMarkdownFormat("hello", { from: 0, to: 5 }, "bold")).toEqual({
      text: "**hello**",
      selection: { from: 2, to: 7 },
    });
  });

  it("inserts a selected bold placeholder for an empty selection", () => {
    expect(applyMarkdownFormat("Say ", { from: 4, to: 4 }, "bold")).toEqual({
      text: "Say **bold text**",
      selection: { from: 6, to: 15 },
    });
  });

  it("toggles external inline wrappers around the selected text", () => {
    expect(applyMarkdownFormat("**hello**", { from: 2, to: 7 }, "bold")).toEqual({
      text: "hello",
      selection: { from: 0, to: 5 },
    });
  });

  it("supports italic and inline code wrappers", () => {
    expect(applyMarkdownFormat("note", { from: 0, to: 4 }, "italic")).toEqual({
      text: "_note_",
      selection: { from: 1, to: 5 },
    });
    expect(applyMarkdownFormat("value", { from: 0, to: 5 }, "inline-code")).toEqual({
      text: "`value`",
      selection: { from: 1, to: 6 },
    });
  });

  it("supports strikethrough wrappers", () => {
    expect(applyMarkdownFormat("obsolete", { from: 0, to: 8 }, "strikethrough")).toEqual({
      text: "~~obsolete~~",
      selection: { from: 2, to: 10 },
    });
    expect(applyMarkdownFormat("~~obsolete~~", { from: 2, to: 10 }, "strikethrough")).toEqual({
      text: "obsolete",
      selection: { from: 0, to: 8 },
    });
  });

  it("inserts selected italic and inline code placeholders for empty selections", () => {
    expect(applyMarkdownFormat("", { from: 0, to: 0 }, "italic")).toEqual({
      text: "_italic text_",
      selection: { from: 1, to: 12 },
    });
    expect(applyMarkdownFormat("", { from: 0, to: 0 }, "inline-code")).toEqual({
      text: "`code`",
      selection: { from: 1, to: 5 },
    });
  });

  it("inserts links and selects the URL placeholder", () => {
    expect(applyMarkdownFormat("docs", { from: 0, to: 4 }, "link")).toEqual({
      text: "[docs](url)",
      selection: { from: 7, to: 10 },
    });
  });

  it("inserts images and selects the URL placeholder", () => {
    expect(applyMarkdownFormat("diagram", { from: 0, to: 7 }, "image")).toEqual({
      text: "![diagram](image-url)",
      selection: { from: 11, to: 20 },
    });
  });

  it("applies and toggles heading markers", () => {
    expect(applyMarkdownFormat("Intro\nTitle", { from: 6, to: 11 }, "heading-2")).toEqual({
      text: "Intro\n## Title",
      selection: { from: 6, to: 14 },
    });
    expect(applyMarkdownFormat("## Title", { from: 0, to: 8 }, "heading-2")).toEqual({
      text: "Title",
      selection: { from: 0, to: 5 },
    });
  });

  it("inserts selected heading placeholders on empty lines", () => {
    expect(applyMarkdownFormat("", { from: 0, to: 0 }, "heading-2")).toEqual({
      text: "## Heading",
      selection: { from: 3, to: 10 },
    });
  });

  it("replaces existing heading markers with the requested level", () => {
    expect(applyMarkdownFormat("# Title", { from: 0, to: 7 }, "heading-3")).toEqual({
      text: "### Title",
      selection: { from: 0, to: 9 },
    });
  });

  it("applies and toggles quote markers across selected lines", () => {
    expect(applyMarkdownFormat("alpha\nbeta", { from: 0, to: 10 }, "quote")).toEqual({
      text: "> alpha\n> beta",
      selection: { from: 0, to: 14 },
    });
    expect(applyMarkdownFormat("> alpha\n> beta", { from: 0, to: 14 }, "quote")).toEqual({
      text: "alpha\nbeta",
      selection: { from: 0, to: 10 },
    });
  });

  it("inserts selected quote placeholders on empty lines", () => {
    expect(applyMarkdownFormat("", { from: 0, to: 0 }, "quote")).toEqual({
      text: "> quote",
      selection: { from: 2, to: 7 },
    });
  });

  it("applies bullet lists across non-empty selected lines", () => {
    expect(applyMarkdownFormat("alpha\n\nbeta", { from: 0, to: 11 }, "bullet-list")).toEqual({
      text: "- alpha\n\n- beta",
      selection: { from: 0, to: 15 },
    });
  });

  it("inserts selected list placeholders on empty lines", () => {
    expect(applyMarkdownFormat("", { from: 0, to: 0 }, "bullet-list")).toEqual({
      text: "- item",
      selection: { from: 2, to: 6 },
    });
    expect(applyMarkdownFormat("", { from: 0, to: 0 }, "numbered-list")).toEqual({
      text: "1. item",
      selection: { from: 3, to: 7 },
    });
    expect(applyMarkdownFormat("", { from: 0, to: 0 }, "check-list")).toEqual({
      text: "- [ ] item",
      selection: { from: 6, to: 10 },
    });
  });

  it("converts existing list markers into numbered lists", () => {
    expect(applyMarkdownFormat("- alpha\n- beta", { from: 0, to: 14 }, "numbered-list")).toEqual({
      text: "1. alpha\n2. beta",
      selection: { from: 0, to: 16 },
    });
  });

  it("applies and toggles checklist markers", () => {
    expect(applyMarkdownFormat("1. alpha\n2. beta", { from: 0, to: 17 }, "check-list")).toEqual({
      text: "- [ ] alpha\n- [ ] beta",
      selection: { from: 0, to: 22 },
    });
    expect(applyMarkdownFormat("- [x] alpha\n- [ ] beta", { from: 0, to: 22 }, "check-list")).toEqual({
      text: "alpha\nbeta",
      selection: { from: 0, to: 10 },
    });
  });

  it("inserts horizontal rules as independent blocks", () => {
    expect(applyMarkdownFormat("", { from: 0, to: 0 }, "horizontal-rule")).toEqual({
      text: "---",
      selection: { from: 3, to: 3 },
    });
    expect(applyMarkdownFormat("alpha\nbeta", { from: 2, to: 2 }, "horizontal-rule")).toEqual({
      text: "alpha\n\n---\n\nbeta",
      selection: { from: 10, to: 10 },
    });
  });

  it("toggles selected horizontal rule lines", () => {
    expect(applyMarkdownFormat("alpha\n---\nbeta", { from: 6, to: 9 }, "horizontal-rule")).toEqual({
      text: "alpha\n\nbeta",
      selection: { from: 6, to: 6 },
    });
  });

  it("wraps selected text in fenced code blocks", () => {
    expect(applyMarkdownFormat("const x=1;", { from: 0, to: 10 }, "code-block")).toEqual({
      text: "```language\nconst x=1;\n```",
      selection: { from: 3, to: 11 },
    });
  });

  it("inserts a selected language placeholder for an empty code block", () => {
    expect(applyMarkdownFormat("", { from: 0, to: 0 }, "code-block")).toEqual({
      text: "```language\ncode\n```",
      selection: { from: 3, to: 11 },
    });
  });

  it("toggles selected fenced code blocks", () => {
    expect(applyMarkdownFormat("```ts\nconst x=1;\n```", { from: 0, to: 20 }, "code-block")).toEqual({
      text: "const x=1;",
      selection: { from: 0, to: 10 },
    });
  });

  it("inserts table blocks and selects the first heading", () => {
    expect(applyMarkdownFormat("", { from: 0, to: 0 }, "table")).toEqual({
      text: "| Column 1 | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |",
      selection: { from: 2, to: 10 },
    });
  });

  it("inserts frontmatter at the top of a document", () => {
    expect(applyMarkdownFormat("Body", { from: 0, to: 0 }, "frontmatter")).toEqual({
      text: "---\ntitle: Untitled\n---\n\nBody",
      selection: { from: 11, to: 19 },
    });
  });

  it("inserts footnotes and selects the footnote body", () => {
    expect(applyMarkdownFormat("remember", { from: 0, to: 8 }, "footnote")).toEqual({
      text: "[^1]\n\n[^1]: remember",
      selection: { from: 12, to: 20 },
    });
  });

  it("clears common Markdown formatting from the selected text", () => {
    expect(
      applyMarkdownFormat("## **Title**\n- [ ] [Task](url)\n![Alt](image.png)", { from: 0, to: 48 }, "clear-formatting"),
    ).toEqual({
      text: "Title\nTask\nAlt",
      selection: { from: 0, to: 14 },
    });
  });

  it("exports the full MVP command set", () => {
    const commands: MarkdownFormatCommand[] = [
      "bold",
      "italic",
      "strikethrough",
      "inline-code",
      "link",
      "image",
      "quote",
      "heading-1",
      "heading-2",
      "heading-3",
      "bullet-list",
      "numbered-list",
      "check-list",
      "horizontal-rule",
      "code-block",
      "table",
      "frontmatter",
      "footnote",
      "clear-formatting",
    ];

    expect(commands).toHaveLength(19);
  });
});
