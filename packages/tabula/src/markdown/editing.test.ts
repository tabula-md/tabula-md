import { describe, expect, it } from "vitest";
import { getMarkdownIndentEdit } from "./editing";

describe("markdown editing input rules", () => {
  it("indents the current list item on Tab", () => {
    expect(getMarkdownIndentEdit("- item", { from: 6, to: 6 }, "indent")).toEqual({
      from: 0,
      to: 6,
      insert: "  - item",
      selection: { from: 8, to: 8 },
    });
  });

  it("outdents the current nested list item on Shift+Tab", () => {
    expect(getMarkdownIndentEdit("  - item", { from: 8, to: 8 }, "outdent")).toEqual({
      from: 0,
      to: 8,
      insert: "- item",
      selection: { from: 6, to: 6 },
    });
  });

  it("indents selected list lines without changing plain lines", () => {
    expect(getMarkdownIndentEdit("- one\nplain\n1. two", { from: 0, to: 18 }, "indent")).toEqual({
      from: 0,
      to: 18,
      insert: "  - one\nplain\n  1. two",
      selection: { from: 2, to: 22 },
    });
  });

  it("renumbers selected ordered list runs after indent", () => {
    expect(getMarkdownIndentEdit("1. one\n1. two", { from: 0, to: 13 }, "indent")).toEqual({
      from: 0,
      to: 13,
      insert: "  1. one\n  2. two",
      selection: { from: 2, to: 17 },
    });
  });

  it("renumbers selected ordered list runs after outdent", () => {
    expect(getMarkdownIndentEdit("  1. one\n  1. two", { from: 0, to: 17 }, "outdent")).toEqual({
      from: 0,
      to: 17,
      insert: "1. one\n2. two",
      selection: { from: 0, to: 13 },
    });
  });

  it("does not consume Tab on plain paragraphs", () => {
    expect(getMarkdownIndentEdit("plain text", { from: 5, to: 5 }, "indent")).toBeNull();
  });
});
