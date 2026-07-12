import { markdown } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { getActiveMarkdownFormats } from "./editorFormattingState";

const createState = (doc: string, cursor: number) =>
  EditorState.create({
    doc,
    extensions: [markdown()],
    selection: EditorSelection.cursor(cursor),
  });

describe("editor formatting state", () => {
  it("reports nested inline formats at the cursor", () => {
    const text = "**bold and *italic***";
    const cursor = text.indexOf("italic") + 2;

    expect(getActiveMarkdownFormats(createState(text, cursor))).toEqual(["bold", "italic"]);
  });

  it("reports heading and list block context", () => {
    expect(getActiveMarkdownFormats(createState("## Heading", 5))).toEqual(["heading-2"]);
    expect(getActiveMarkdownFormats(createState("1. Item", 5))).toEqual(["numbered-list"]);
    expect(getActiveMarkdownFormats(createState("- [ ] Task", 7))).toEqual(["check-list"]);
  });

  it("recognizes inline formats that the base Markdown parser does not expose", () => {
    expect(getActiveMarkdownFormats(createState("before ~~strike~~ after", 12))).toEqual([
      "strikethrough",
    ]);
  });

  it("returns no active format for plain text", () => {
    expect(getActiveMarkdownFormats(createState("Plain text", 4))).toEqual([]);
  });
});
