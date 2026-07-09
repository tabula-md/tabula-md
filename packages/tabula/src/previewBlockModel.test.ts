import { describe, expect, it } from "vitest";
import {
  applyPreviewBlockMeasurements,
  createPreviewBlockIndex,
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

  it("preserves preview block identity when measurements do not change layout", () => {
    const index = createPreviewBlockIndex(["# Title", "", "paragraph", "continued"].join("\n"));
    const measured = applyPreviewBlockMeasurements(index, {});

    expect(measured.blocks[0]).toBe(index.blocks[0]);
    expect(measured.blocks[1]).toBe(index.blocks[1]);
    expect(measured.blocks[2]).toBe(index.blocks[2]);
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
