import { describe, expect, it } from "vitest";
import {
  applyPreviewBlockMeasurements,
  choosePreviewRenderableAnchor,
  createOptimisticPreviewBlockIndex,
  createOptimisticPreviewBlockIndexFromPatches,
  createPreviewBlockIndex,
  getPreviewScrollTopForSourceLine,
  getPreviewWindow,
  hasGlobalMarkdownSyntax,
  hasHeavyMarkdownPreviewShape,
  hasLargeMarkdownWordCount,
  hasLongMarkdownLine,
  isLargeMarkdownDocument,
  mapPreviewLineToBlock,
  shouldUseImmediateMarkdownPreview,
} from "./previewBlockModel";

describe("preview block model", () => {
  it("keeps fenced code blocks intact", () => {
    const index = createPreviewBlockIndex(["# Title", "", "```ts", "const x = 1;", "```", "", "After"].join("\n"));

    const fence = index.blocks.find((block) => block.kind === "fence");
    expect(fence).toMatchObject({
      startLine: 3,
      endLine: 5,
      text: "```ts\nconst x = 1;\n```",
    });
  });

  it("groups tables, lists, blockquotes, and paragraphs without breaking markdown structure", () => {
    const index = createPreviewBlockIndex(
      [
        "| A | B |",
        "| - | - |",
        "| 1 | 2 |",
        "",
        "- one",
        "  continuation",
        "- two",
        "",
        "> quote",
        "> more",
        "",
        "paragraph",
        "continued",
      ].join("\n"),
    );

    expect(index.blocks.map((block) => block.kind)).toEqual([
      "table",
      "blank",
      "list",
      "blank",
      "blockquote",
      "blank",
      "paragraph",
    ]);
  });

  it("maps source lines to indexed blocks", () => {
    const index = createPreviewBlockIndex(["# Title", "", "paragraph", "continued"].join("\n"));

    expect(mapPreviewLineToBlock(index, 1)?.kind).toBe("heading");
    expect(mapPreviewLineToBlock(index, 3)?.kind).toBe("paragraph");
    expect(mapPreviewLineToBlock(index, 4)?.kind).toBe("paragraph");
    expect(mapPreviewLineToBlock(index, 99)).toBeNull();
  });

  it("tracks heading depth and estimates heading blocks by rendered scale", () => {
    const index = createPreviewBlockIndex(["# H1", "## H2", "###### H6"].join("\n"));
    const headings = index.blocks.filter((block) => block.kind === "heading");

    expect(headings.map((block) => block.headingLevel)).toEqual([1, 2, 6]);
    expect(headings[0].estimatedHeight).toBeGreaterThan(headings[1].estimatedHeight);
    expect(headings[1].estimatedHeight).toBeGreaterThan(headings[2].estimatedHeight);
  });

  it("treats blank source lines as zero-height preview structure", () => {
    const index = createPreviewBlockIndex(["before", "", "", "after"].join("\n"));
    const blankBlocks = index.blocks.filter((block) => block.kind === "blank");

    expect(blankBlocks).toHaveLength(1);
    expect(blankBlocks[0].estimatedHeight).toBe(0);
  });

  it("keeps paired raw HTML and MDX-like component blocks together across blank lines", () => {
    const index = createPreviewBlockIndex([
      "## How it works",
      "",
      "<CardGroup cols={2}>",
      "  <Card title=\"Credit-based\">",
      "    Purchase credits upfront.",
      "  </Card>",
      "",
      "  <Card title=\"No commitments\">",
      "    Start and stop anytime.",
      "  </Card>",
      "</CardGroup>",
      "",
      "## Credit consumption details",
    ].join("\n"));
    const htmlBlock = index.blocks.find((block) => block.kind === "html");

    expect(htmlBlock).toMatchObject({
      startLine: 3,
      endLine: 11,
    });
  });

  it("chunks very large paragraphs so virtual preview can render a window", () => {
    const lineParagraph = Array.from({ length: 100 }, (_, index) => `plain line ${index + 1}`).join("\n");
    const lineIndex = createPreviewBlockIndex(lineParagraph);

    expect(lineIndex.blocks).toHaveLength(3);
    expect(lineIndex.blocks.every((block) => block.kind === "paragraph")).toBe(true);
    expect(lineIndex.blocks[0]).toMatchObject({ startLine: 1, endLine: 40 });
    expect(lineIndex.blocks[1]).toMatchObject({ startLine: 41, endLine: 80 });
    expect(lineIndex.blocks[2]).toMatchObject({ startLine: 81, endLine: 100 });

    const longLineIndex = createPreviewBlockIndex(Array.from({ length: 2_000 }, (_, index) => `word-${index}`).join(" "));
    expect(longLineIndex.blocks.length).toBeGreaterThan(1);
    expect(longLineIndex.blocks.every((block) => block.startLine === 1 && block.endLine === 1)).toBe(true);
  });

  it("returns a visible block window with overscan", () => {
    const markdown = Array.from({ length: 200 }, (_, index) => `Line ${index + 1}`).join("\n\n");
    const blockIndex = createPreviewBlockIndex(markdown);
    const previewWindow = getPreviewWindow(blockIndex, 1_000, 600, 200);

    expect(previewWindow.blocks.length).toBeGreaterThan(0);
    expect(previewWindow.startIndex).toBeGreaterThanOrEqual(0);
    expect(previewWindow.endIndex).toBeGreaterThan(previewWindow.startIndex);
  });

  it("keeps large overscan windows anchored near the viewport", () => {
    const markdown = Array.from({ length: 500 }, (_, index) => `Line ${index + 1}`).join("\n\n");
    const blockIndex = createPreviewBlockIndex(markdown);
    const scrollTop = 5_000;
    const previewWindow = getPreviewWindow(blockIndex, scrollTop, 600, 1_800);

    expect(previewWindow.blocks.length).toBeGreaterThan(0);
    expect(previewWindow.blocks[0].estimatedTop).toBeGreaterThan(scrollTop - 400);
    expect(previewWindow.blocks.at(-1)?.estimatedTop).toBeGreaterThan(scrollTop + 1_800);
  });

  it("keeps the final block visible when scroll position is past the estimated preview height", () => {
    const markdown = Array.from({ length: 200 }, (_, index) => `Line ${index + 1}`).join("\n\n");
    const blockIndex = createPreviewBlockIndex(markdown);
    const previewWindow = getPreviewWindow(blockIndex, blockIndex.totalEstimatedHeight + 10_000, 600, 200);

    expect(previewWindow.blocks.length).toBeGreaterThan(0);
    expect(previewWindow.startIndex).toBeGreaterThan(0);
    expect(previewWindow.blocks.at(-1)?.text).toBe("Line 200");
  });

  it("applies measured block heights while preserving source block order", () => {
    const index = createPreviewBlockIndex(["# Title", "", "paragraph", "continued"].join("\n"));
    const measured = applyPreviewBlockMeasurements(index, {
      [index.blocks[0].id]: 120,
      [index.blocks[1].id]: 24,
    });

    expect(measured.blocks[0]).toMatchObject({
      estimatedTop: 0,
      estimatedHeight: 120,
    });
    expect(measured.blocks[1]).toMatchObject({
      estimatedTop: 120,
      estimatedHeight: 24,
    });
    expect(measured.blocks[2]?.estimatedTop).toBe(144);
    expect(measured.totalEstimatedHeight).toBeGreaterThan(index.totalEstimatedHeight);
  });

  it("applies zero-height measurements for sanitized or empty preview blocks", () => {
    const index = createPreviewBlockIndex(["visible", "", "<style>p { color: red; }</style>"].join("\n"));
    const htmlBlock = index.blocks.find((block) => block.kind === "html");
    expect(htmlBlock).toBeDefined();

    const measured = applyPreviewBlockMeasurements(index, {
      [htmlBlock!.id]: 0,
    });

    expect(measured.blocks.find((block) => block.id === htmlBlock!.id)?.estimatedHeight).toBe(0);
    expect(measured.totalEstimatedHeight).toBe(index.totalEstimatedHeight - htmlBlock!.estimatedHeight);
  });

  it("chooses the closest renderable preview anchor for a source line", () => {
    expect(
      choosePreviewRenderableAnchor(
        [
          { endLine: 10, rendered: true, startLine: 1 },
          { endLine: 25, rendered: true, startLine: 20, sourceElement: true },
          { endLine: 25, rendered: true, startLine: 20 },
        ],
        22,
      ),
    ).toMatchObject({ startLine: 20, sourceElement: true });
  });

  it("moves invisible or sanitized source lines to the nearest renderable preview anchor", () => {
    const anchors = [
      { endLine: 10, rendered: true, startLine: 1 },
      { endLine: 12, rendered: false, startLine: 11 },
      { endLine: 20, rendered: true, startLine: 13 },
    ];

    expect(choosePreviewRenderableAnchor(anchors, 11)).toMatchObject({ startLine: 13 });
    expect(choosePreviewRenderableAnchor(anchors, 12)).toMatchObject({ startLine: 13 });
  });

  it("falls back to the previous renderable preview anchor at the document end", () => {
    const anchors = [
      { endLine: 10, rendered: true, startLine: 1 },
      { endLine: 20, rendered: false, startLine: 11 },
    ];

    expect(choosePreviewRenderableAnchor(anchors, 18)).toMatchObject({ endLine: 10 });
  });

  it("maps renderable source lines to measured preview scroll positions", () => {
    const index = createPreviewBlockIndex(["# Title", "", "paragraph", "continued"].join("\n"));
    const measured = applyPreviewBlockMeasurements(index, {
      [index.blocks[0].id]: 80,
      [index.blocks[1].id]: 0,
      [index.blocks[2].id]: 120,
    });

    expect(
      getPreviewScrollTopForSourceLine(
        measured,
        { align: "preserve-offset", lineNumber: 3, lineOffsetRatio: 0 },
        { edgePadding: 0, viewportHeight: 100 },
      ),
    ).toBe(80);
    expect(
      getPreviewScrollTopForSourceLine(
        measured,
        { align: "preserve-offset", lineNumber: 4, lineOffsetRatio: 1 },
        { edgePadding: 0, viewportHeight: 100 },
      ),
    ).toBe(100);
  });

  it("collapses blank and zero-height source lines to stable renderable preview boundaries", () => {
    const index = createPreviewBlockIndex(["before", "", "<style>p { color: red; }</style>", "", "after"].join("\n"));
    const htmlBlock = index.blocks.find((block) => block.kind === "html");
    const blankBlocks = index.blocks.filter((block) => block.kind === "blank");
    const measured = applyPreviewBlockMeasurements(index, {
      [index.blocks[0].id]: 80,
      [htmlBlock!.id]: 0,
      [blankBlocks[0].id]: 0,
      [blankBlocks[1].id]: 0,
      [index.blocks.at(-1)!.id]: 100,
    });

    expect(
      getPreviewScrollTopForSourceLine(
        measured,
        { align: "preserve-offset", lineNumber: 2, lineOffsetRatio: 0 },
        { edgePadding: 0, viewportHeight: 80 },
      ),
    ).toBe(80);
    expect(
      getPreviewScrollTopForSourceLine(
        measured,
        { align: "preserve-offset", lineNumber: 3, lineOffsetRatio: 0 },
        { edgePadding: 0, viewportHeight: 80 },
      ),
    ).toBe(80);
  });

  it("maps document end to the final preview scroll position only when requested", () => {
    const index = createPreviewBlockIndex(Array.from({ length: 20 }, (_, line) => `Line ${line + 1}`).join("\n\n"));
    const endScrollTop = getPreviewScrollTopForSourceLine(
      index,
      { align: "end", lineNumber: 39, lineOffsetRatio: 0 },
      { viewportHeight: 240 },
    );

    expect(endScrollTop).toBe(Math.max(0, index.totalEstimatedHeight - 240));
  });

  it("remaps a delayed media block from fallback boundary to its measured rendered position", () => {
    const index = createPreviewBlockIndex(
      ["Before delayed media.", "", "![Delayed media](/tabula-delayed-media.svg)", "", "After delayed media."].join("\n"),
    );
    const mediaBlock = index.blocks.find((block) => block.text.includes("Delayed media"));
    const blankMeasurements = Object.fromEntries(
      index.blocks.filter((block) => block.kind === "blank").map((block) => [block.id, 0]),
    );
    expect(mediaBlock).toBeDefined();

    const collapsed = applyPreviewBlockMeasurements(index, {
      ...blankMeasurements,
      [index.blocks[0].id]: 80,
      [mediaBlock!.id]: 0,
      [index.blocks.at(-1)!.id]: 80,
    });
    const expanded = applyPreviewBlockMeasurements(index, {
      ...blankMeasurements,
      [index.blocks[0].id]: 80,
      [mediaBlock!.id]: 420,
      [index.blocks.at(-1)!.id]: 80,
    });

    expect(
      getPreviewScrollTopForSourceLine(
        collapsed,
        { align: "preserve-offset", lineNumber: mediaBlock!.startLine, lineOffsetRatio: 0 },
        { edgePadding: 0, viewportHeight: 80 },
      ),
    ).toBe(80);
    expect(
      getPreviewScrollTopForSourceLine(
        expanded,
        { align: "preserve-offset", lineNumber: mediaBlock!.startLine, lineOffsetRatio: 0 },
        { edgePadding: 0, viewportHeight: 80 },
      ),
    ).toBe(80);
    expect(
      getPreviewScrollTopForSourceLine(
        expanded,
        { align: "preserve-offset", lineNumber: mediaBlock!.endLine, lineOffsetRatio: 1 },
        { edgePadding: 0, viewportHeight: 80 },
      ),
    ).toBe(500);
  });

  it("shifts following source anchors by delayed async render height without changing source order", () => {
    const index = createPreviewBlockIndex(
      [
        "Before delayed media.",
        "",
        "![Delayed media](/tabula-delayed-media.svg)",
        "",
        "After delayed media.",
        "More after text.",
      ].join("\n"),
    );
    const mediaBlock = index.blocks.find((block) => block.text.includes("Delayed media"));
    const afterBlock = index.blocks.at(-1);
    const blankMeasurements = Object.fromEntries(
      index.blocks.filter((block) => block.kind === "blank").map((block) => [block.id, 0]),
    );
    const beforeLoad = applyPreviewBlockMeasurements(index, {
      ...blankMeasurements,
      [index.blocks[0].id]: 80,
      [mediaBlock!.id]: 1,
      [afterBlock!.id]: 100,
    });
    const afterLoad = applyPreviewBlockMeasurements(index, {
      ...blankMeasurements,
      [index.blocks[0].id]: 80,
      [mediaBlock!.id]: 421,
      [afterBlock!.id]: 100,
    });
    const beforeAfterBlockTop = getPreviewScrollTopForSourceLine(
      beforeLoad,
      { align: "preserve-offset", lineNumber: afterBlock!.startLine, lineOffsetRatio: 0 },
      { edgePadding: 0, viewportHeight: 80 },
    );
    const afterAfterBlockTop = getPreviewScrollTopForSourceLine(
      afterLoad,
      { align: "preserve-offset", lineNumber: afterBlock!.startLine, lineOffsetRatio: 0 },
      { edgePadding: 0, viewportHeight: 80 },
    );

    expect(afterAfterBlockTop - beforeAfterBlockTop).toBe(420);
    expect(afterLoad.blocks.map((block) => [block.startLine, block.endLine])).toEqual(
      beforeLoad.blocks.map((block) => [block.startLine, block.endLine]),
    );
  });

  it("keeps dense raw-html boundary mapping stable near the reported bottom fixture shape", () => {
    const markdown = [
      "<div>",
      "Config Variable | Info",
      "</div>",
      "",
      "You can set most options directly in JavaScript.",
      "",
      "> **Note:** Some options are read only once during initialisation.",
      "",
      "```html",
      "<meta name=\"htmx-config\" content='{\"defaultSwap\":\"innerHTML\"}'>",
      "```",
      "",
      "### Conclusion",
      "",
      "And that's it!",
      "",
      "## VS Code",
      "The HTMX Toolkit extension adds htmx support.",
    ].join("\n");
    const index = createPreviewBlockIndex(markdown);
    const measured = applyPreviewBlockMeasurements(
      index,
      Object.fromEntries(index.blocks.map((block) => [block.id, block.kind === "blank" ? 0 : block.estimatedHeight])),
    );
    const scrollBefore = getPreviewScrollTopForSourceLine(
      measured,
      { align: "preserve-offset", lineNumber: 4, lineOffsetRatio: 0 },
      { viewportHeight: 320 },
    );
    const scrollAfter = getPreviewScrollTopForSourceLine(
      measured,
      { align: "preserve-offset", lineNumber: 5, lineOffsetRatio: 0 },
      { viewportHeight: 320 },
    );

    expect(scrollAfter).toBeGreaterThanOrEqual(scrollBefore);
    expect(scrollAfter - scrollBefore).toBeLessThan(140);
  });

  it("preserves preview block identity when measurements do not change layout", () => {
    const index = createPreviewBlockIndex(["# Title", "", "paragraph", "continued"].join("\n"));
    const measured = applyPreviewBlockMeasurements(index, {});

    expect(measured.blocks[0]).toBe(index.blocks[0]);
    expect(measured.blocks[1]).toBe(index.blocks[1]);
    expect(measured.blocks[2]).toBe(index.blocks[2]);
  });

  it("creates an optimistic preview block index for a local line edit", () => {
    const previousMarkdown = [
      "# Title",
      "",
      "Before paragraph.",
      "",
      "Target paragraph.",
      "",
      "After paragraph.",
    ].join("\n");
    const nextMarkdown = previousMarkdown.replace("Target paragraph.", "Target paragraph updated.");
    const previousIndex = createPreviewBlockIndex(previousMarkdown);
    const optimisticIndex = createOptimisticPreviewBlockIndex(previousIndex, previousMarkdown, nextMarkdown);

    expect(optimisticIndex).not.toBeNull();
    expect(mapPreviewLineToBlock(optimisticIndex!, 5)?.text).toBe("Target paragraph updated.");
    expect(optimisticIndex!.lineCount).toBe(createPreviewBlockIndex(nextMarkdown).lineCount);
  });

  it("creates an optimistic preview block index from editor text patches", () => {
    const previousMarkdown = [
      "# Title",
      "",
      "Before paragraph.",
      "",
      "Target paragraph.",
      "",
      "After paragraph.",
    ].join("\n");
    const insertAt = previousMarkdown.indexOf(" paragraph.");
    const nextMarkdown = `${previousMarkdown.slice(0, insertAt)} updated${previousMarkdown.slice(insertAt)}`;
    const previousIndex = createPreviewBlockIndex(previousMarkdown);
    const optimisticIndex = createOptimisticPreviewBlockIndexFromPatches(
      previousIndex,
      previousMarkdown,
      nextMarkdown,
      [{ from: insertAt, to: insertAt, insert: " updated" }],
    );

    expect(optimisticIndex).not.toBeNull();
    expect(mapPreviewLineToBlock(optimisticIndex!, 3)?.text).toBe("Before updated paragraph.");
    expect(optimisticIndex).toEqual(createOptimisticPreviewBlockIndex(previousIndex, previousMarkdown, nextMarkdown));
  });

  it("rejects stale editor text patches for optimistic preview indexing", () => {
    const previousMarkdown = ["# Title", "", "Target paragraph."].join("\n");
    const nextMarkdown = previousMarkdown.replace("Target", "Changed");
    const previousIndex = createPreviewBlockIndex(previousMarkdown);

    expect(
      createOptimisticPreviewBlockIndexFromPatches(
        previousIndex,
        previousMarkdown,
        nextMarkdown,
        [{ from: 0, to: 0, insert: "stale" }],
      ),
    ).toBeNull();
  });

  it("skips optimistic preview indexing for edits on structural markdown boundaries", () => {
    const previousMarkdown = [
      "# Title",
      "",
      "Add these config lines:",
      "",
      "```html",
      "<script src=\"/js/htmx.min.js\"></script>",
      "```",
      "",
      "After paragraph.",
    ].join("\n");
    const insertAt = previousMarkdown.indexOf("\n\n```html") + 1;
    const insertedText = "typed text";
    const nextMarkdown = `${previousMarkdown.slice(0, insertAt)}${insertedText}${previousMarkdown.slice(insertAt)}`;
    const previousIndex = createPreviewBlockIndex(previousMarkdown);

    expect(
      createOptimisticPreviewBlockIndexFromPatches(
        previousIndex,
        previousMarkdown,
        nextMarkdown,
        [{ from: insertAt, to: insertAt, insert: insertedText }],
      ),
    ).toBeNull();
    expect(createOptimisticPreviewBlockIndex(previousIndex, previousMarkdown, nextMarkdown)).toBeNull();
  });

  it("shifts suffix source lines and offsets in an optimistic preview block index", () => {
    const previousMarkdown = [
      "# Title",
      "",
      "Before paragraph.",
      "",
      "Target paragraph.",
      "",
      "After paragraph.",
    ].join("\n");
    const nextMarkdown = previousMarkdown.replace("Target paragraph.", "Target paragraph.\nInserted line.");
    const previousIndex = createPreviewBlockIndex(previousMarkdown);
    const optimisticIndex = createOptimisticPreviewBlockIndex(previousIndex, previousMarkdown, nextMarkdown);
    const afterBlock = optimisticIndex?.blocks.find((block) => block.text === "After paragraph.");

    expect(afterBlock).toMatchObject({
      startLine: 8,
      endLine: 8,
      startOffset: nextMarkdown.indexOf("After paragraph."),
    });
  });

  it("detects large markdown by characters, line count, or word count", () => {
    expect(isLargeMarkdownDocument("a".repeat(64_000))).toBe(true);
    expect(isLargeMarkdownDocument(Array.from({ length: 800 }, () => "x").join("\n"))).toBe(true);
    expect(hasLargeMarkdownWordCount(Array.from({ length: 8_000 }, (_, index) => `word-${index}`).join(" "))).toBe(true);
    expect(isLargeMarkdownDocument(Array.from({ length: 8_000 }, (_, index) => `word-${index}`).join(" "))).toBe(true);
    expect(isLargeMarkdownDocument("short")).toBe(false);
  });

  it("detects pathological document shapes before the global size thresholds", () => {
    const longLine = "x".repeat(8_000);
    const tableRun = Array.from({ length: 120 }, (_, index) => `| ${index} | value |`).join("\n");

    expect(hasLongMarkdownLine(longLine)).toBe(true);
    expect(isLargeMarkdownDocument(longLine)).toBe(true);
    expect(isLargeMarkdownDocument(tableRun)).toBe(true);
  });

  it("keeps plain short markdown on the immediate preview path", () => {
    expect(shouldUseImmediateMarkdownPreview("# Title\n\nPlain notes")).toBe(true);
  });

  it("moves short but expensive preview shapes off the immediate preview path", () => {
    const mermaid = "```mermaid\ngraph TD\n  A --> B\n```";
    const html = "<Frame>\n  <img src=\"/diagram.png\" />\n</Frame>";
    const displayMath = "$$\na^2 + b^2 = c^2\n$$";
    const tableRun = Array.from({ length: 16 }, (_, index) => `| ${index} | value |`).join("\n");
    const longFence = ["```", ...Array.from({ length: 80 }, () => "code"), "```"].join("\n");

    expect(hasHeavyMarkdownPreviewShape(mermaid)).toBe(true);
    expect(hasHeavyMarkdownPreviewShape(html)).toBe(true);
    expect(hasHeavyMarkdownPreviewShape(displayMath)).toBe(true);
    expect(hasHeavyMarkdownPreviewShape(tableRun)).toBe(true);
    expect(hasHeavyMarkdownPreviewShape(longFence)).toBe(true);
    expect(shouldUseImmediateMarkdownPreview(mermaid)).toBe(false);
    expect(shouldUseImmediateMarkdownPreview(html)).toBe(false);
    expect(shouldUseImmediateMarkdownPreview(displayMath)).toBe(false);
    expect(shouldUseImmediateMarkdownPreview(tableRun)).toBe(false);
    expect(shouldUseImmediateMarkdownPreview(longFence)).toBe(false);
  });

  it("does not use immediate preview for medium documents", () => {
    expect(shouldUseImmediateMarkdownPreview("a".repeat(24_001))).toBe(false);
  });

  it("detects markdown syntax that needs whole-document preview context", () => {
    expect(hasGlobalMarkdownSyntax(["---", "title: Whole Document", "---", "", "# Title"].join("\n"))).toBe(true);
    expect(hasGlobalMarkdownSyntax("A footnote reference[^1]\n\n[^1]: Footnote text")).toBe(true);
    expect(hasGlobalMarkdownSyntax("[Tabula][tabula]\n\n[tabula]: https://tabula.md")).toBe(true);
    expect(hasGlobalMarkdownSyntax("Term\n: Definition")).toBe(true);
    expect(hasGlobalMarkdownSyntax("<Frame>\n  <img src=\"/diagram.png\" />\n</Frame>")).toBe(false);
    expect(
      hasGlobalMarkdownSyntax(Array.from({ length: 16 }, (_, index) => `| ${index} | value |`).join("\n")),
    ).toBe(false);
  });

  it("ignores global-looking markdown syntax inside fenced code", () => {
    const fenced = [
      "```md",
      "[Tabula][tabula]",
      "[tabula]: https://tabula.md",
      "<Frame>",
      "Term",
      ": Definition",
      "```",
    ].join("\n");

    expect(hasGlobalMarkdownSyntax(fenced)).toBe(false);
  });
});
