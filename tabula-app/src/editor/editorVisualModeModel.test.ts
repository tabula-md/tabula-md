import { markdown } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import { GFM } from "@lezer/markdown";
import { applyMarkdownFormat, type MarkdownFormatCommand } from "@tabula-md/tabula";
import { describe, expect, it } from "vitest";
import {
  buildEditorVisualModel,
  findEditorVisualReplacementInRange,
  findEditorVisualReplacementOnLine,
  type EditorVisualReplacement,
} from "./editorVisualModeModel";

const createState = (
  doc: string,
  selection: number | { anchor: number; head: number } = 0,
) =>
  EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] })],
    selection: typeof selection === "number"
      ? EditorSelection.cursor(selection)
      : EditorSelection.single(selection.anchor, selection.head),
  });

describe("editor visual mode model", () => {
  it("uses the Markdown tree for inline syntax and keeps the active syntax editable", () => {
    const doc = "# Heading\n\nParagraph with **bold**, *italic*, `code`, and [link](https://example.com).";
    const model = buildEditorVisualModel(createState(doc, doc.indexOf("\n") + 1));
    const hidden = model.hiddenRanges.map(({ from, to }) => doc.slice(from, to));

    expect(hidden).toContain("#");
    expect(hidden).toContain("**");
    expect(hidden).toContain("*");
    expect(hidden).toContain("`");
    expect(hidden).toContain("https://example.com");
    expect(model.lines).toContainEqual({
      className: "cm-visual-heading cm-visual-heading-1",
      from: 0,
    });

    const activeHeading = buildEditorVisualModel(createState(doc, 1));
    expect(activeHeading.hiddenRanges.some(({ from, to }) => doc.slice(from, to) === "#")).toBe(false);
  });

  it("reveals every inline marker on the active source line", () => {
    const doc = [
      "before",
      "**bold text**, *italic text*, `code`, ~~strike~~, [link](https://example.com), and $formula$.[^note]",
      "",
      "[^note]: Footnote body.",
    ].join("\n");
    const activeLinePosition = doc.indexOf("italic text") + 3;
    const model = buildEditorVisualModel(createState(doc, activeLinePosition));
    const hidden = model.hiddenRanges.map(({ from, to }) => doc.slice(from, to));

    expect(hidden).not.toContain("**");
    expect(hidden).not.toContain("*");
    expect(hidden).not.toContain("`");
    expect(hidden).not.toContain("~~");
    expect(hidden).not.toContain("https://example.com");
    expect(
      model.replacements.some(({ kind }) => kind === "inline-math"),
    ).toBe(false);
    expect(
      model.replacements.some(({ kind }) => kind === "footnote-reference"),
    ).toBe(false);
  });

  it("keeps other formatted lines rendered inside the same Markdown paragraph", () => {
    const doc = [
      "**first bold**",
      "*second italic*",
      "`third code`",
      "$fourth formula$",
      "**active bold**",
    ].join("\n");
    const activeFrom = doc.indexOf("active bold");
    const model = buildEditorVisualModel(createState(doc, {
      anchor: activeFrom,
      head: activeFrom + "active bold".length,
    }));
    const hidden = model.hiddenRanges.map(({ from, to }) => ({
      from,
      source: doc.slice(from, to),
    }));

    expect(hidden.filter(({ source }) => source === "**")).toHaveLength(2);
    expect(hidden.filter(({ source }) => source === "*")).toHaveLength(2);
    expect(hidden.filter(({ source }) => source === "`")).toHaveLength(2);
    expect(
      model.replacements.some((replacement) =>
        replacement.kind === "inline-math" &&
        replacement.expression === "fourth formula"),
    ).toBe(true);
    expect(
      hidden.some(({ from }) => from > activeFrom),
    ).toBe(false);
  });

  it("reveals canonical source across a dragged selection", () => {
    const doc = [
      "before",
      "**bold** and $formula$",
      "![Sample](https://example.com/sample.png)",
      "[^note]: Footnote body.",
      "after",
    ].join("\n");
    const selection = {
      anchor: doc.indexOf("bold"),
      head: doc.indexOf("after") + 2,
    };
    const model = buildEditorVisualModel(createState(doc, selection));

    expect(model.hiddenRanges).toEqual([]);
    expect(
      model.replacements.some(({ kind }) =>
        kind === "inline-math" ||
        kind === "image" ||
        kind === "footnote-definition"),
    ).toBe(false);
  });

  it("turns GFM tables and task markers into editable visual replacements", () => {
    const doc = [
      "- [x] Done",
      "- [ ] Todo",
      "",
      "| Column 1 | Column 2 |",
      "| --- | --- |",
      "| Value 1 | Value 2 |",
    ].join("\n");
    const model = buildEditorVisualModel(createState(doc, doc.indexOf("| Column") - 1));

    expect(model.replacements).toContainEqual(
      expect.objectContaining({ kind: "task", checked: true }),
    );
    expect(model.replacements).toContainEqual(
      expect.objectContaining({ kind: "task", checked: false }),
    );
    expect(model.replacements).toContainEqual(
      expect.objectContaining({
        kind: "table",
        alignments: [null, null],
        header: ["Column 1", "Column 2"],
        rows: [["Value 1", "Value 2"]],
      }),
    );
  });

  it("preserves GFM table alignment and inline cell Markdown", () => {
    const doc = [
      "| Name | Value |",
      "| :--- | ---: |",
      "| **Total** | `12` |",
    ].join("\n");
    const table = buildEditorVisualModel(createState(doc)).replacements
      .find((replacement) => replacement.kind === "table");

    expect(table).toEqual(expect.objectContaining({
      alignments: ["left", "right"],
      rows: [["**Total**", "`12`"]],
    }));
  });

  it("creates block replacements for code, images, separators, and callouts", () => {
    const doc = [
      "```js",
      "const value = 1;",
      "```",
      "",
      "```mermaid",
      "graph TD",
      "  A --> B",
      "```",
      "",
      "![Diagram](https://example.com/image.png)",
      "",
      "$$",
      "x^2 + y^2",
      "$$",
      "",
      "---",
      "",
      "> [!NOTE] Context",
      "> Callout body",
    ].join("\n");
    const model = buildEditorVisualModel(createState(doc, 0));

    expect(model.replacements).toContainEqual(
      expect.objectContaining({
        kind: "diagram",
        source: ["graph TD", "  A --> B"].join("\n"),
      }),
    );
    expect(model.replacements).toContainEqual(
      expect.objectContaining({
        kind: "image",
        alt: "Diagram",
        source: "https://example.com/image.png",
      }),
    );
    expect(model.replacements).toContainEqual(
      expect.objectContaining({ kind: "math", expression: "x^2 + y^2" }),
    );
    expect(model.replacements).toContainEqual(
      expect.objectContaining({ kind: "horizontal-rule" }),
    );
    expect(model.replacements).toContainEqual(
      expect.objectContaining({
        kind: "callout",
        calloutType: "note",
        title: "Context",
        body: "Callout body",
      }),
    );

    const codeModel = buildEditorVisualModel(createState(doc, doc.indexOf("image.png")));
    expect(codeModel.replacements).toContainEqual(
      expect.objectContaining({
        kind: "code",
        language: "js",
        code: "const value = 1;",
      }),
    );
  });

  it("renders inline math while keeping code-span dollars literal", () => {
    const doc = "before\nEnergy is $E = mc^2$, but `$literal$` remains code.";
    const model = buildEditorVisualModel(createState(doc, 0));
    const inlineMath = model.replacements.filter(
      (replacement) => replacement.kind === "inline-math",
    );

    expect(inlineMath).toEqual([
      expect.objectContaining({
        expression: "E = mc^2",
        kind: "inline-math",
      }),
    ]);

    const replacement = inlineMath[0];
    const editing = buildEditorVisualModel(
      createState(doc, replacement.from),
      undefined,
      { from: replacement.from, to: replacement.to },
    );
    expect(
      editing.replacements.some((candidate) => candidate.kind === "inline-math"),
    ).toBe(false);
    expect(
      findEditorVisualReplacementInRange(
        createState(doc, replacement.from + 1),
        replacement.from + 1,
        replacement.to - 1,
      ),
    ).toEqual(expect.objectContaining({
      expression: "E = mc^2",
      kind: "inline-math",
    }));
  });

  it("renders GFM footnote references and definitions with stable numbering", () => {
    const doc = [
      "First[^source] and again[^source], then second[^other].",
      "",
      "[^source]: The canonical Markdown source.",
      "[^other]: Another note.",
    ].join("\n");
    const model = buildEditorVisualModel(createState(doc, doc.indexOf("\n") + 1));

    expect(
      model.replacements.filter(({ kind }) => kind === "footnote-reference"),
    ).toEqual([
      expect.objectContaining({ index: 1, label: "source" }),
      expect.objectContaining({ index: 1, label: "source" }),
      expect.objectContaining({ index: 2, label: "other" }),
    ]);
    expect(
      model.replacements.filter(({ kind }) => kind === "footnote-definition"),
    ).toEqual([
      expect.objectContaining({
        body: "The canonical Markdown source.",
        index: 1,
        label: "source",
      }),
      expect.objectContaining({
        body: "Another note.",
        index: 2,
        label: "other",
      }),
    ]);
  });

  it("uses shared reference order when footnote definitions appear first", () => {
    const doc = [
      "[^unused]: Not referenced.",
      "[^later]: Defined before its reference.",
      "",
      "First[^first], later[^later], first again[^first].",
      "",
      "[^first]: Referenced twice.",
    ].join("\n");
    const replacements = buildEditorVisualModel(
      createState(doc, doc.indexOf("\n\n[^first]") + 1),
    ).replacements;
    const isFootnoteReference = (
      replacement: EditorVisualReplacement,
    ): replacement is Extract<
      EditorVisualReplacement,
      { kind: "footnote-reference" }
    > => replacement.kind === "footnote-reference";
    const isFootnoteDefinition = (
      replacement: EditorVisualReplacement,
    ): replacement is Extract<
      EditorVisualReplacement,
      { kind: "footnote-definition" }
    > => replacement.kind === "footnote-definition";

    expect(
      replacements
        .filter(isFootnoteReference)
        .sort((left, right) => left.from - right.from)
        .map(({ index, label }) => ({ index, label })),
    ).toEqual([
      { index: 1, label: "first" },
      { index: 2, label: "later" },
      { index: 1, label: "first" },
    ]);
    expect(
      replacements
        .filter(isFootnoteDefinition)
        .map(({ index, label }) => ({ index, label })),
    ).toEqual([
      { index: 1, label: "first" },
      { index: 2, label: "later" },
      { index: 3, label: "unused" },
    ]);
  });

  it("hides valid frontmatter from Visual mode", () => {
    const doc = [
      "---",
      "title: Visual mode",
      "tags:",
      "  - tabula",
      "  - markdown",
      "---",
      "",
      "# Body",
    ].join("\n");
    const model = buildEditorVisualModel(createState(doc));

    expect(model.hiddenRanges).toContainEqual({
      from: 0,
      to: doc.indexOf("\n\n# Body") + 1,
    });
    expect(
      model.replacements.filter(({ kind }) => kind === "horizontal-rule"),
    ).toEqual([]);

  });

  it.each([
    ["horizontal-rule", "horizontal-rule"],
    ["code-block", "code"],
    ["math-block", "math"],
    ["mermaid", "diagram"],
    ["table", "table"],
    ["image", "image"],
    ["callout", "callout"],
    ["accordion", "accordion"],
    ["tabs", "tabs"],
  ] as Array<[MarkdownFormatCommand, string]>)(
    "renders the %s toolbar insertion in Visual mode",
    (command, expectedKind) => {
      const result = applyMarkdownFormat("", { from: 0, to: 0 }, command);
      const model = buildEditorVisualModel(createState(result.text));
      expect(
        model.replacements.some(({ kind }) => kind === expectedKind),
      ).toBe(true);
    },
  );

  it("renders both halves of a toolbar-inserted footnote", () => {
    const result = applyMarkdownFormat("", { from: 0, to: 0 }, "footnote");
    const replacements = buildEditorVisualModel(
      createState(result.text, result.text.length),
    ).replacements;
    expect(
      replacements.filter(({ kind }) => kind === "footnote-reference"),
    ).toHaveLength(1);
    expect(
      replacements.filter(({ kind }) => kind === "footnote-definition"),
    ).toHaveLength(1);
  });

  it("keeps structural rendering stable when the cursor crosses its source range", () => {
    const doc = ["| A | B |", "| --- | --- |", "| C | D |"].join("\n");
    const model = buildEditorVisualModel(createState(doc, doc.indexOf("C")));

    expect(model.replacements.some(({ kind }) => kind === "table")).toBe(true);
  });

  it("reveals a structural block only when it enters source editing", () => {
    const doc = ["| A | B |", "| --- | --- |", "| C | D |"].join("\n");
    const state = createState(doc, doc.indexOf("C"));
    const model = buildEditorVisualModel(state, undefined, { from: 0, to: doc.length });

    expect(model.replacements.some(({ kind }) => kind === "table")).toBe(false);
    expect(
      model.lines.some(({ className }) => className.includes("cm-visual-source-block")),
    ).toBe(false);
  });

  it("keeps every fence visible while a code block is being edited", () => {
    const doc = ["```javascript", "const ready = true;", "```"].join("\n");
    const state = createState(doc, 0);
    const model = buildEditorVisualModel(state, undefined, { from: 0, to: doc.length });

    expect(model.hiddenRanges).toEqual([]);
    expect(model.lines).toHaveLength(3);
    expect(model.lines.every(({ className }) =>
      className.includes("ui-selection-aware-inline"))).toBe(true);
    expect(model.lines[0]?.className).toContain("cm-visual-source-block-first");
    expect(model.lines[1]?.className).toContain("cm-visual-source-code");
    expect(model.lines[2]?.className).toContain("cm-visual-source-block-last");
  });

  it("keeps selected code source transparent so the native selection remains visible", () => {
    const doc = ["## Code", "", "```bash", "npm run build", "```"].join("\n");
    const state = createState(doc, { anchor: 0, head: doc.length });
    const model = buildEditorVisualModel(state);
    const codeLines = model.lines.filter(({ className }) =>
      className.includes("cm-visual-source-code"));

    expect(codeLines).toHaveLength(3);
    expect(codeLines.every(({ className }) =>
      className.includes("ui-selection-aware-inline"))).toBe(true);
    expect(codeLines[0]?.className).toContain("cm-visual-selected-code-first");
    expect(codeLines[2]?.className).toContain("cm-visual-selected-code-last");
    expect(
      codeLines.some(({ className }) => className.includes("cm-visual-source-block")),
    ).toBe(false);
  });

  it("uses the complete Markdown source as the canonical select-all surface", () => {
    const doc = [
      "# Selection",
      "",
      "![Diagram](https://example.com/image.png)",
      "",
      "```mermaid",
      "graph TD",
      "  A --> B",
      "```",
      "",
      "$$",
      "x^2 + y^2",
      "$$",
    ].join("\n");
    const model = buildEditorVisualModel(
      createState(doc, { anchor: 0, head: doc.length }),
    );

    expect(model.replacements).toEqual([]);
    expect(model.hiddenRanges).toEqual([]);
  });

  it.each([
    ["separator", "---"],
    ["image", "![Diagram](https://example.com/image.png)"],
    ["math", ["$$", "x^2 + y^2", "$$"].join("\n")],
    ["callout", ["> [!NOTE] Context", "> Callout body"].join("\n")],
    [
      "Tabula component",
      [
        '<Callout type="warning" title="Context">',
        "Callout body",
        "</Callout>",
      ].join("\n"),
    ],
  ])("keeps edited %s source as plain Markdown lines", (_label, doc) => {
    const state = createState(doc, 0);
    const model = buildEditorVisualModel(
      state,
      undefined,
      { from: 0, to: doc.length },
    );

    expect(model.replacements).toEqual([]);
    expect(
      model.lines.some(({ className }) =>
        className.includes("cm-visual-source-block")),
    ).toBe(false);
  });

  it("recognizes the supported Tabula component blocks", () => {
    const doc = [
      '<Callout type="warning" title="Heads up">',
      "Callout body",
      "</Callout>",
      "",
      '<Accordion title="Details">',
      "Accordion body",
      "</Accordion>",
      "",
      "<Tabs>",
      '<Tab title="First">One</Tab>',
      '<Tab title="Second">Two</Tab>',
      "</Tabs>",
    ].join("\n");
    const model = buildEditorVisualModel(createState(doc, doc.indexOf("<Accordion") - 1));

    expect(model.replacements).toContainEqual(
      expect.objectContaining({
        kind: "callout",
        calloutType: "warning",
        title: "Heads up",
        body: "Callout body",
      }),
    );
    expect(model.replacements).toContainEqual(
      expect.objectContaining({
        kind: "accordion",
        title: "Details",
        body: "Accordion body",
      }),
    );
    expect(model.replacements).toContainEqual(
      expect.objectContaining({
        kind: "tabs",
        tabs: [
          { title: "First", body: "One" },
          { title: "Second", body: "Two" },
        ],
      }),
    );
  });

  it("parses nested supported components without splitting quoted tag text", () => {
    const doc = [
      '<Callout type="warning" title="A > B">',
      "Outer body",
      "",
      '<Accordion title="Nested details">',
      "Nested body",
      "</Accordion>",
      "</Callout>",
      "",
      "<Tabs>",
      '<Tab title="First > second">',
      "**Rich** body",
      "</Tab>",
      '<Tab title="Second">',
      "<Callout>Nested tab callout</Callout>",
      "</Tab>",
      "</Tabs>",
    ].join("\n");
    const replacements = buildEditorVisualModel(createState(doc)).replacements;

    expect(replacements).toContainEqual(expect.objectContaining({
      kind: "callout",
      title: "A > B",
      body: expect.stringContaining('<Accordion title="Nested details">'),
    }));
    expect(replacements).toContainEqual(expect.objectContaining({
      kind: "tabs",
      tabs: [
        { title: "First > second", body: "**Rich** body" },
        { title: "Second", body: "<Callout>Nested tab callout</Callout>" },
      ],
    }));
  });

  it("does not treat supported component tags inside fenced code as visual components", () => {
    const doc = [
      "```mdx",
      '<Callout type="warning" title="Source only">',
      "Not a rendered callout",
      "</Callout>",
      "```",
    ].join("\n");
    const replacements = buildEditorVisualModel(createState(doc)).replacements;

    expect(replacements).toContainEqual(expect.objectContaining({
      kind: "code",
      language: "mdx",
    }));
    expect(replacements).not.toContainEqual(expect.objectContaining({
      kind: "callout",
    }));
  });

  it("keeps complete image URLs and resolves reference images", () => {
    const doc = [
      "![Direct](https://example.com/image_(wide).png)",
      "",
      "![Reference][diagram]",
      "",
      "[diagram]: https://example.com/reference.png",
    ].join("\n");
    const state = createState(doc, doc.length);
    const images = buildEditorVisualModel(state).replacements
      .filter((replacement) => replacement.kind === "image");

    expect(images).toEqual([
      expect.objectContaining({
        alt: "Direct",
        source: "https://example.com/image_(wide).png",
      }),
      expect.objectContaining({
        alt: "Reference",
        source: "https://example.com/reference.png",
      }),
    ]);
  });

  it("keeps the final code line when a fenced block is still open", () => {
    const doc = ["```bash", "npm install", "npm run dev"].join("\n");
    const code = buildEditorVisualModel(createState(doc)).replacements
      .find((replacement) => replacement.kind === "code");

    expect(code).toEqual(expect.objectContaining({
      code: "npm install\nnpm run dev",
      language: "bash",
    }));
  });

  it("indexes visual blocks by source range and source line", () => {
    const doc = [
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
    const state = createState(doc);
    const codeLine = state.doc.line(4);
    const blankAfterCode = state.doc.line(6);
    const imageLine = state.doc.line(7);

    expect(findEditorVisualReplacementOnLine(state, codeLine.number))
      .toEqual(expect.objectContaining({ kind: "code" }));
    expect(findEditorVisualReplacementOnLine(state, blankAfterCode.number)).toBeUndefined();
    expect(findEditorVisualReplacementOnLine(state, imageLine.number))
      .toEqual(expect.objectContaining({ kind: "image" }));
    expect(findEditorVisualReplacementInRange(state, codeLine.from, codeLine.to))
      .toEqual(expect.objectContaining({ kind: "code" }));
  });

});
