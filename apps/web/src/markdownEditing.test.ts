import { describe, expect, it } from "vitest";
import { getMarkdownEnterEdit, getMarkdownIndentEdit, getMarkdownPasteEdit } from "./markdownEditing";

describe("markdown editing input rules", () => {
  it("continues bullet lists on Enter", () => {
    expect(getMarkdownEnterEdit("- item", 6)).toEqual({
      from: 6,
      to: 6,
      insert: "\n- ",
      selection: 9,
    });
  });

  it("continues numbered lists with the next number", () => {
    expect(getMarkdownEnterEdit("9. item", 7)).toEqual({
      from: 7,
      to: 7,
      insert: "\n10. ",
      selection: 12,
    });
  });

  it("continues checklists as unchecked items", () => {
    expect(getMarkdownEnterEdit("- [x] done", 10)).toEqual({
      from: 10,
      to: 10,
      insert: "\n- [ ] ",
      selection: 17,
    });
  });

  it("continues blockquotes on Enter", () => {
    expect(getMarkdownEnterEdit("> quoted", 8)).toEqual({
      from: 8,
      to: 8,
      insert: "\n> ",
      selection: 11,
    });
  });

  it("removes an empty list marker instead of creating another empty item", () => {
    expect(getMarkdownEnterEdit("- ", 2)).toEqual({
      from: 0,
      to: 2,
      insert: "",
      selection: 0,
    });
  });

  it("does not treat horizontal rules as list continuation", () => {
    expect(getMarkdownEnterEdit("---", 3)).toBeNull();
  });

  it("does not change plain paragraphs", () => {
    expect(getMarkdownEnterEdit("plain text", 10)).toBeNull();
  });

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

  it("does not consume Tab on plain paragraphs", () => {
    expect(getMarkdownIndentEdit("plain text", { from: 5, to: 5 }, "indent")).toBeNull();
  });

  it("turns a pasted URL over selected text into a Markdown link", () => {
    expect(getMarkdownPasteEdit("Open docs", { from: 5, to: 9 }, "https://example.com/docs")).toEqual({
      from: 5,
      to: 9,
      insert: "[docs](https://example.com/docs)",
      selection: { from: 37, to: 37 },
    });
  });

  it("normalizes pasted Markdown-hostile text", () => {
    expect(getMarkdownPasteEdit("", { from: 0, to: 0 }, "“Title”\r\n\titem\r\n\r\n\r\nnext")).toEqual({
      from: 0,
      to: 0,
      insert: '"Title"\n  item\n\nnext',
      selection: { from: 20, to: 20 },
    });
  });

  it("lets unchanged plain paste use the native editor path", () => {
    expect(getMarkdownPasteEdit("", { from: 0, to: 0 }, "plain text")).toBeNull();
  });
});
