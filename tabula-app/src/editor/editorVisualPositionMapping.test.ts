import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { GFM } from "@lezer/markdown";
import { describe, expect, it } from "vitest";
import {
  buildEditorVisualModel,
  type EditorVisualReplacement,
} from "./editorVisualModeModel";
import {
  findEditorVisualMappedBlockAt,
  findEditorVisualMappedBlockOnLine,
  getEditorVisualBlockEntryPosition,
  getEditorVisualPointerPosition,
  getEditorVisualSourceMap,
  mapEditorVisualRenderedOffsetToSource,
} from "./editorVisualPositionMapping";

const source = [
  "before",
  "",
  "```js",
  "const alpha = 1;",
  "const beta = 2;",
  "```",
  "",
  "![Sample](https://example.com/sample.png)",
  "",
  "| Name | Value |",
  "| :--- | ---: |",
  "| Total | 12 |",
  "",
  "$$",
  "x^2 + y^2",
  "$$",
  "",
  "> [!NOTE] Context",
  "> Callout body",
  "",
  "after",
].join("\n");

const state = EditorState.create({
  doc: source,
  extensions: [markdown({ extensions: [GFM] })],
});

const replacements = buildEditorVisualModel(
  state,
  [{ from: 0, to: state.doc.length }],
  null,
  false,
).replacements;

const replacement = (kind: EditorVisualReplacement["kind"]) => {
  const result = replacements.find((candidate) => candidate.kind === kind);
  if (!result) throw new Error(`Missing ${kind} replacement`);
  return result;
};

describe("editor visual position mapping", () => {
  it("preserves presentation source and content ranges for every atomic block", () => {
    for (const kind of ["code", "image", "table", "math", "callout"] as const) {
      const block = replacement(kind);
      const mapping = getEditorVisualSourceMap(block);

      expect(mapping.range).toEqual({ from: block.from, to: block.to });
      expect(mapping.contentRange?.from ?? mapping.range.from)
        .toBeGreaterThanOrEqual(mapping.range.from);
      expect(mapping.contentRange?.to ?? mapping.range.to)
        .toBeLessThanOrEqual(mapping.range.to);
    }

    const code = replacement("code");
    expect(source.slice(
      code.sourceMap?.contentRange?.from,
      code.sourceMap?.contentRange?.to,
    )).toBe("const alpha = 1;\nconst beta = 2;");
  });

  it("maps source positions and logical lines through one block index", () => {
    const code = replacement("code");
    const codeBody = state.doc.line(4);

    expect(findEditorVisualMappedBlockAt(replacements, codeBody.from))
      .toBe(code);
    expect(findEditorVisualMappedBlockOnLine(state, replacements, 4))
      .toBe(code);
    expect(findEditorVisualMappedBlockOnLine(state, replacements, 7))
      .toBeUndefined();
  });

  it("uses content ranges for keyboard entry and pointer placement", () => {
    const code = replacement("code");

    expect(getEditorVisualBlockEntryPosition(state, code, true))
      .toBe(state.doc.line(3).from);
    expect(getEditorVisualBlockEntryPosition(state, code, false))
      .toBe(state.doc.line(6).from);
    expect(getEditorVisualPointerPosition(state, code, {
      clientX: 50,
      clientY: 75,
      height: 100,
      left: 0,
      top: 0,
      width: 100,
    })).toBe(state.doc.line(5).from + Math.round(state.doc.line(5).length / 2));
  });

  it("maps rendered text boundaries through hidden Markdown markers", () => {
    expect(mapEditorVisualRenderedOffsetToSource(
      "**Rich** and `code`",
      "Rich and code",
      2,
    )).toBe(4);
    expect(mapEditorVisualRenderedOffsetToSource(
      "**Rich** and `code`",
      "Rich and code",
      "Rich and ".length,
    )).toBe("**Rich** and `".length);
  });

  it("prefers semantic DOM text positions over block geometry ratios", () => {
    const code = replacement("code");
    const contentRange = code.sourceMap?.contentRange;
    if (!contentRange) throw new Error("Missing code content range");

    expect(getEditorVisualPointerPosition(
      state,
      code,
      {
        clientX: 95,
        clientY: 95,
        height: 100,
        left: 0,
        top: 0,
        width: 100,
      },
      {
        renderedOffset: "const al".length,
        renderedText: "const alpha = 1;\nconst beta = 2;",
        sourceRange: contentRange,
      },
    )).toBe(state.doc.line(4).from + "const al".length);
  });
});
