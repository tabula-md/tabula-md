import { markdown } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import { GFM } from "@lezer/markdown";
import { describe, expect, it } from "vitest";
import { buildEditorVisualModel } from "./editorVisualModeModel";
import {
  normalizeEditorVisualNativeMove,
  resolveEditorVisualVerticalMove,
} from "./editorVisualNavigation";

const source = [
  "before",
  "",
  "```js",
  "const x = 1;",
  "```",
  "",
  "![Sample](https://example.com/sample.png)",
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

const cursor = (line: number, column = 0) =>
  EditorSelection.cursor(state.doc.line(line).from + column);

describe("editor visual logical navigation", () => {
  it("stops on atomic blocks before entering their source symmetrically", () => {
    const downOntoCode = resolveEditorVisualVerticalMove(
      state,
      cursor(2),
      true,
      replacements,
      null,
    );
    const upOntoCode = resolveEditorVisualVerticalMove(
      state,
      cursor(6),
      false,
      replacements,
      null,
    );
    const downOntoImage = resolveEditorVisualVerticalMove(
      state,
      cursor(6),
      true,
      replacements,
      null,
    );
    const upOntoImage = resolveEditorVisualVerticalMove(
      state,
      cursor(8),
      false,
      replacements,
      null,
    );

    expect(downOntoCode).toMatchObject({
      anchor: state.doc.line(3).from,
      block: { kind: "code" },
      forward: true,
      kind: "block-stop",
    });
    expect(upOntoCode).toMatchObject({
      anchor: state.doc.line(5).from,
      block: { kind: "code" },
      forward: false,
      kind: "block-stop",
    });
    expect(downOntoImage).toMatchObject({
      anchor: state.doc.line(7).from,
      block: { kind: "image" },
      forward: true,
      kind: "block-stop",
    });
    expect(upOntoImage).toMatchObject({
      anchor: state.doc.line(7).from,
      block: { kind: "image" },
      forward: false,
      kind: "block-stop",
    });
  });

  it("enters on the second matching move and reverses to the adjacent blank line", () => {
    const code = replacements.find((candidate) => candidate.kind === "code");
    if (!code) throw new Error("Missing code replacement");
    const downStop = {
      forward: true,
      from: code.from,
      goalColumn: 0,
      to: code.to,
    };
    const upStop = { ...downStop, forward: false };

    expect(resolveEditorVisualVerticalMove(
      state,
      cursor(3),
      true,
      replacements,
      null,
      downStop,
    )).toMatchObject({
      anchor: state.doc.line(3).from,
      block: { kind: "code" },
      kind: "block-entry",
    });
    expect(resolveEditorVisualVerticalMove(
      state,
      cursor(3),
      false,
      replacements,
      null,
      downStop,
    )).toMatchObject({
      kind: "logical-line",
      selection: { head: state.doc.line(2).from },
    });
    expect(resolveEditorVisualVerticalMove(
      state,
      cursor(5),
      true,
      replacements,
      null,
      upStop,
    )).toMatchObject({
      kind: "logical-line",
      selection: { head: state.doc.line(6).from },
    });
  });

  it("leaves editable atomic source through each adjacent logical line", () => {
    const code = replacements.find((candidate) => candidate.kind === "code");
    if (!code) throw new Error("Missing code replacement");
    const editing = { from: code.from, to: code.to };

    expect(resolveEditorVisualVerticalMove(
      state,
      cursor(5),
      true,
      replacements,
      editing,
    )).toMatchObject({
      kind: "logical-line",
      selection: { head: state.doc.line(6).from },
    });
    expect(resolveEditorVisualVerticalMove(
      state,
      cursor(3),
      false,
      replacements,
      editing,
    )).toMatchObject({
      kind: "logical-line",
      selection: { head: state.doc.line(2).from },
    });
  });

  it("keeps visual wrapping inside a source line and clamps cross-line moves", () => {
    const current = cursor(9, 3);
    const sameLogicalLine = EditorSelection.cursor(state.doc.line(9).from + 1);
    const nextLogicalLine = EditorSelection.cursor(state.doc.line(8).from);

    expect(normalizeEditorVisualNativeMove(
      state,
      current,
      sameLogicalLine,
      8,
      false,
    )).toBe(sameLogicalLine);
    expect(normalizeEditorVisualNativeMove(
      state,
      current,
      nextLogicalLine,
      8,
      false,
    )).toMatchObject({
      head: state.doc.line(8).from,
    });
  });
});
