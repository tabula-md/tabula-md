import { markdown } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorSelection, EditorState } from "@codemirror/state";
import { GFM } from "@lezer/markdown";
import { createPreviewBlockIndex } from "@tabula-md/tabula";
import { describe, expect, it } from "vitest";
import {
  buildEditorVisualModel,
  findEditorVisualReplacementOnLine,
} from "./editorVisualModeModel";
import {
  markdownSurfaceContractMarkdown,
  markdownSurfaceFeatureAnchors,
  markdownSurfaceFeatures,
  markdownSurfaceNavigationFixture,
  previewSurfaceExpectations,
  visualSurfaceExpectations,
} from "./fixtures/markdownSurfaceContractFixture";

const createState = (doc: string) => {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] })],
    selection: EditorSelection.cursor(doc.length),
  });
  if (!ensureSyntaxTree(state, state.doc.length, 5_000)) {
    throw new Error("Markdown surface fixture did not finish parsing.");
  }
  return state;
};

const findUniqueSourceRange = (source: string, anchor: string) => {
  const from = source.indexOf(anchor);
  expect(from, `Missing fixture anchor: ${anchor}`).toBeGreaterThanOrEqual(0);
  expect(
    source.indexOf(anchor, from + 1),
    `Fixture anchor must be unique: ${anchor}`,
  ).toBe(-1);
  return { from, to: from + anchor.length };
};

describe("Markdown surface contract fixture", () => {
  it("keeps every declared feature anchored to unique canonical Markdown", () => {
    expect(markdownSurfaceFeatures).toHaveLength(
      Object.keys(markdownSurfaceFeatureAnchors).length,
    );
    expect(new Set(markdownSurfaceFeatures).size).toBe(markdownSurfaceFeatures.length);

    for (const feature of markdownSurfaceFeatures) {
      findUniqueSourceRange(
        markdownSurfaceContractMarkdown,
        markdownSurfaceFeatureAnchors[feature],
      );
    }
  });

  it("keeps preview block kinds and source ranges stable", () => {
    const preview = createPreviewBlockIndex(markdownSurfaceContractMarkdown);

    for (const expectation of previewSurfaceExpectations) {
      const range = findUniqueSourceRange(
        markdownSurfaceContractMarkdown,
        expectation.source,
      );
      const block = preview.blocks.find(
        (candidate) =>
          candidate.startOffset <= range.from &&
          candidate.endOffset >= range.to,
      );

      expect(block, `Missing preview block for ${expectation.feature}`)
        .toMatchObject({ kind: expectation.kind });
      expect(block?.text).toContain(expectation.source);
      expect(block?.startOffset).toBeLessThanOrEqual(range.from);
      expect(block?.endOffset).toBeGreaterThanOrEqual(range.to);
    }
  });

  it("keeps Visual replacement kinds and source ranges stable", () => {
    const state = createState(markdownSurfaceContractMarkdown);
    const visual = buildEditorVisualModel(
      state,
      [{ from: 0, to: state.doc.length }],
      null,
      false,
    );

    for (const expectation of visualSurfaceExpectations) {
      const replacements = visual.replacements.filter(
        (candidate) =>
          candidate.kind === expectation.kind &&
          markdownSurfaceContractMarkdown.slice(candidate.from, candidate.to) ===
            expectation.source,
      );

      expect(
        replacements,
        `Missing Visual replacement for ${expectation.feature}`,
      ).toHaveLength(1);
    }
  });

  it("keeps heading and inline source semantics observable in Visual mode", () => {
    const state = createState(markdownSurfaceContractMarkdown);
    const visual = buildEditorVisualModel(
      state,
      [{ from: 0, to: state.doc.length }],
      null,
      false,
    );
    const hiddenSource = visual.hiddenRanges.map(({ from, to }) =>
      markdownSurfaceContractMarkdown.slice(from, to));
    const headingRange = findUniqueSourceRange(
      markdownSurfaceContractMarkdown,
      markdownSurfaceFeatureAnchors.heading,
    );

    expect(visual.lines).toContainEqual({
      className: "cm-visual-heading cm-visual-heading-1",
      from: headingRange.from,
    });
    expect(hiddenSource).toEqual(expect.arrayContaining([
      "#",
      "**",
      "*",
      "~~",
      "`",
      "https://example.com",
      "./notes.md",
      "#surface-contract",
      "./missing.md",
    ]));
  });

  it("keeps atomic blocks and surrounding blank lines as separate navigation stops", () => {
    const { lines, markdown: source } = markdownSurfaceNavigationFixture;
    const state = createState(source);
    const preview = createPreviewBlockIndex(source);

    expect(findEditorVisualReplacementOnLine(state, lines.codeStart))
      .toEqual(expect.objectContaining({ kind: "code" }));
    expect(findEditorVisualReplacementOnLine(state, lines.codeBody))
      .toEqual(expect.objectContaining({ kind: "code" }));
    expect(findEditorVisualReplacementOnLine(state, lines.codeEnd))
      .toEqual(expect.objectContaining({ kind: "code" }));
    expect(findEditorVisualReplacementOnLine(state, lines.image))
      .toEqual(expect.objectContaining({ kind: "image" }));

    for (const lineNumber of [
      lines.before,
      lines.blankBeforeCode,
      lines.blankAfterCode,
      lines.blankAfterImage,
      lines.after,
    ]) {
      expect(findEditorVisualReplacementOnLine(state, lineNumber)).toBeUndefined();
    }

    for (const lineNumber of [
      lines.blankBeforeCode,
      lines.blankAfterCode,
      lines.blankAfterImage,
    ]) {
      expect(
        preview.blocks.find(
          (block) => block.startLine <= lineNumber && block.endLine >= lineNumber,
        ),
      ).toMatchObject({
        endLine: lineNumber,
        estimatedHeight: 0,
        kind: "blank",
        startLine: lineNumber,
      });
    }
  });
});
