import { describe, expect, it } from "vitest";
import {
  createMarkdownPresentationDocument,
  type PresentationBlock,
  type PresentationNode,
} from "./presentation";

const flattenNodes = (
  nodes: readonly PresentationNode[],
): PresentationNode[] => nodes.flatMap((node) => [
  node,
  ...flattenNodes(node.children),
]);

const flattenBlocks = (
  blocks: readonly PresentationBlock[],
): PresentationNode[] => flattenNodes(blocks);

describe("Markdown presentation document", () => {
  it("keeps canonical source ranges while describing block and inline meaning", () => {
    const source = [
      "---",
      "title: Contract",
      "---",
      "",
      "# Heading",
      "",
      "Text with **strong**, *emphasis*, ~~strike~~, `code`, and $x^2$.",
      "",
      "| A | B |",
      "| :- | -: |",
      "| 1 | 2 |",
      "",
      "```ts",
      "const ready = true;",
      "```",
    ].join("\n");
    const document = createMarkdownPresentationDocument(source);
    const nodes = flattenBlocks(document.blocks);

    expect(document.source).toBe(source);
    expect(document.blocks.map((block) => block.type)).toEqual([
      "frontmatter",
      "blank-line",
      "heading",
      "blank-line",
      "paragraph",
      "blank-line",
      "table",
      "blank-line",
      "code-block",
    ]);
    expect(nodes.map((node) => node.type)).toEqual(expect.arrayContaining([
      "strong",
      "emphasis",
      "strikethrough",
      "inline-code",
      "inline-math",
      "table-row",
      "table-cell",
    ]));
    const strong = nodes.find((node) => node.type === "strong");
    expect(strong).toMatchObject({
      contentRange: expect.any(Object),
      markerRanges: [expect.any(Object), expect.any(Object)],
    });
    expect(
      strong?.markerRanges.map((range) =>
        source.slice(range.from, range.to)),
    ).toEqual(["**", "**"]);
    const inlineCode = nodes.find((node) => node.type === "inline-code");
    expect(
      inlineCode?.contentRange &&
        source.slice(inlineCode.contentRange.from, inlineCode.contentRange.to),
    ).toBe("code");
    expect(
      inlineCode?.markerRanges.map((range) =>
        source.slice(range.from, range.to)),
    ).toEqual(["`", "`"]);
    for (const node of nodes) {
      expect(node.range.from).toBeGreaterThanOrEqual(0);
      expect(node.range.to).toBeGreaterThanOrEqual(node.range.from);
      expect(node.range.to).toBeLessThanOrEqual(source.length);
    }
    const code = document.blocks.find((block) => block.type === "code-block");
    expect(code).toMatchObject({
      data: { language: "ts", text: "const ready = true;" },
      interaction: {
        arrowNavigation: "content",
        atomicWhenInactive: true,
        revealSourceWhenActive: true,
      },
    });
    expect(source.slice(code!.range.from, code!.range.to)).toBe(
      ["```ts", "const ready = true;", "```"].join("\n"),
    );
  });

  it("builds link, definition, and repeated footnote relationships", () => {
    const source = [
      "[external](https://example.com)",
      "[document](./notes.md)",
      "[heading](#target)",
      "[reference][docs]",
      "First[^note], again[^note], and missing[^missing].",
      "",
      "[docs]: /guide.md \"Guide\"",
      "[^note]: Definition",
    ].join("\n");
    const { references } = createMarkdownPresentationDocument(source);

    expect(references.links.map(({ kind, target }) => ({ kind, target }))).toEqual([
      { kind: "external", target: "https://example.com" },
      { kind: "internal-document", target: "./notes.md" },
      { kind: "internal-heading", target: "#target" },
      { kind: "internal-document", target: "/guide.md" },
    ]);
    expect(
      flattenBlocks(
        createMarkdownPresentationDocument(source).blocks,
      )
        .filter((node) => node.type === "link")
        .map((node) => node.data?.linkKind),
    ).toEqual([
      "external",
      "internal-document",
      "internal-heading",
      "internal-document",
    ]);
    expect(references.definitions).toMatchObject([
      {
        identifier: "docs",
        title: "Guide",
        url: "/guide.md",
      },
    ]);
    expect(references.footnotes).toHaveLength(2);
    expect(references.footnotes[0]).toMatchObject({
      identifier: "note",
      index: 1,
    });
    expect(references.footnotes[0].references).toHaveLength(2);
    expect(references.footnotes[0].definitionRange).toBeDefined();
    expect(references.footnotes[1]).toMatchObject({
      identifier: "missing",
      index: 2,
      references: [{ range: expect.any(Object) }],
    });
    expect(references.footnotes[1].definitionRange).toBeUndefined();
  });

  it("keeps primary block data and source ranges in one shared model", () => {
    const source = [
      "---",
      "",
      "![Sample](https://example.com/sample.png)",
      "",
      "```ts",
      "const ready = true;",
      "```",
      "",
      "| Name | State |",
      "| :--- | ---: |",
      "| Tabula | Ready |",
    ].join("\n");
    const document = createMarkdownPresentationDocument(source);
    const image = document.blocks.find((block) => block.type === "image");
    const code = document.blocks.find((block) => block.type === "code-block");
    const table = document.blocks.find((block) => block.type === "table");

    expect(document.blocks.map((block) => block.type)).toEqual([
      "thematic-break",
      "blank-line",
      "image",
      "blank-line",
      "code-block",
      "blank-line",
      "table",
    ]);
    expect(image?.data).toMatchObject({
      alt: "Sample",
      url: "https://example.com/sample.png",
    });
    expect(code?.data).toMatchObject({
      language: "ts",
      text: "const ready = true;",
    });
    expect(
      code?.contentRange &&
        source.slice(code.contentRange.from, code.contentRange.to),
    ).toBe("const ready = true;");
    expect(table?.data?.alignments).toEqual(["left", "right"]);
    expect(table?.children.map((row) =>
      row.children.map((cell) =>
        source.slice(
          cell.contentRange?.from ?? cell.range.from,
          cell.contentRange?.to ?? cell.range.to,
        ).trim()))).toEqual([
      ["Name", "State"],
      ["Tabula", "Ready"],
    ]);
  });

  it("models docs components as semantic blocks without UI objects", () => {
    const source = [
      '<Callout type="warning" title="Canonical source">',
      "",
      "Markdown stays canonical.",
      "",
      "</Callout>",
      "",
      "<Tabs>",
      "",
      '<Tab title="People">',
      "",
      "People edit visually.",
      "",
      "</Tab>",
      "",
      '<Tab title="Agents">',
      "",
      "Agents edit the same source.",
      "",
      "</Tab>",
      "",
      "</Tabs>",
    ].join("\n");
    const document = createMarkdownPresentationDocument(source);
    const callout = document.blocks.find((block) => block.type === "callout");
    const tabs = document.blocks.find((block) => block.type === "tabs");

    expect(callout).toMatchObject({
      data: {
        attributes: {
          title: "Canonical source",
          type: "warning",
        },
      },
      interaction: { atomicWhenInactive: true },
    });
    expect(tabs?.children.filter((child) => child.type === "tab")).toHaveLength(2);
    expect(
      flattenNodes(tabs?.children ?? [])
        .filter((node) => node.type === "paragraph")
        .map((node) => source.slice(node.range.from, node.range.to)),
    ).toEqual([
      "People edit visually.",
      "Agents edit the same source.",
    ]);
    expect(JSON.stringify(document)).not.toMatch(
      /className|react|widget|domNode/i,
    );
  });

  it("normalizes blockquote callouts into the shared semantic model", () => {
    const source = [
      "> [!WARNING] Canonical source",
      "> Keep Markdown as the source of truth.",
    ].join("\n");
    const callout = createMarkdownPresentationDocument(source).blocks[0];

    expect(callout).toMatchObject({
      data: {
        attributes: {
          title: "Canonical source",
          type: "warning",
        },
        text: "Keep Markdown as the source of truth.",
      },
      interaction: {
        atomicWhenInactive: true,
        revealSourceWhenActive: true,
      },
      range: { from: 0, to: source.length },
      type: "callout",
    });
  });
});
