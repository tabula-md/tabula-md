import {
  createMarkdownPresentationDocument,
  type PresentationBlock,
  type PresentationNode,
} from "@tabula-md/tabula";
import { describe, expect, it } from "vitest";
import {
  markdownSurfaceContractMarkdown,
  markdownSurfaceFeatureAnchors,
} from "./fixtures/markdownSurfaceContractFixture";

const flattenNodes = (
  nodes: readonly PresentationNode[],
): PresentationNode[] => nodes.flatMap((node) => [
  node,
  ...flattenNodes(node.children),
]);

const findExactSourceNode = (
  source: string,
  nodes: readonly PresentationNode[],
) => nodes.find((node) =>
  markdownSurfaceContractMarkdown.slice(node.range.from, node.range.to)
    === source);

describe("Markdown presentation contract", () => {
  const document = createMarkdownPresentationDocument(
    markdownSurfaceContractMarkdown,
  );
  const nodes = flattenNodes(document.blocks);

  it("parses every shared block fixture into the UI-independent model", () => {
    const blockExpectations: Array<{
      source: string;
      type: PresentationBlock["type"];
    }> = [
      { source: markdownSurfaceFeatureAnchors.heading, type: "heading" },
      { source: markdownSurfaceFeatureAnchors.blockquote, type: "blockquote" },
      {
        source: markdownSurfaceFeatureAnchors["unordered-list"],
        type: "unordered-list",
      },
      {
        source: markdownSurfaceFeatureAnchors["ordered-list"],
        type: "ordered-list",
      },
      { source: markdownSurfaceFeatureAnchors["task-list"], type: "unordered-list" },
      { source: markdownSurfaceFeatureAnchors.table, type: "table" },
      {
        source: markdownSurfaceFeatureAnchors["thematic-break"],
        type: "thematic-break",
      },
      { source: markdownSurfaceFeatureAnchors.image, type: "image" },
      {
        source: markdownSurfaceFeatureAnchors["fenced-code"],
        type: "code-block",
      },
      {
        source: markdownSurfaceFeatureAnchors["plain-code"],
        type: "code-block",
      },
      {
        source: markdownSurfaceFeatureAnchors["display-math"],
        type: "display-math",
      },
      { source: markdownSurfaceFeatureAnchors.diagram, type: "diagram" },
      { source: markdownSurfaceFeatureAnchors.callout, type: "callout" },
      { source: markdownSurfaceFeatureAnchors.accordion, type: "accordion" },
      { source: markdownSurfaceFeatureAnchors.tabs, type: "tabs" },
      {
        source: markdownSurfaceFeatureAnchors["reference-definition"],
        type: "reference-definition",
      },
      {
        source: markdownSurfaceFeatureAnchors["footnote-definition"],
        type: "footnote-definition",
      },
    ];

    for (const expectation of blockExpectations) {
      expect(
        findExactSourceNode(expectation.source, nodes),
        `${expectation.type} should preserve its exact source range`,
      ).toMatchObject({ type: expectation.type });
    }
    expect(document.blocks[0]).toMatchObject({
      range: { from: 0 },
      type: "frontmatter",
    });
    expect(document.blocks.some((block) => block.type === "blank-line")).toBe(true);
  });

  it("preserves inline meaning and exact marker ranges", () => {
    const inlineExpectations: Array<{
      source: string;
      type: PresentationNode["type"];
    }> = [
      { source: markdownSurfaceFeatureAnchors.strong, type: "strong" },
      { source: markdownSurfaceFeatureAnchors.emphasis, type: "emphasis" },
      {
        source: markdownSurfaceFeatureAnchors.strikethrough,
        type: "strikethrough",
      },
      {
        source: markdownSurfaceFeatureAnchors["inline-code"],
        type: "inline-code",
      },
      {
        source: markdownSurfaceFeatureAnchors["inline-math"],
        type: "inline-math",
      },
      {
        source: markdownSurfaceFeatureAnchors["external-link"],
        type: "link",
      },
      {
        source: markdownSurfaceFeatureAnchors["internal-document-link"],
        type: "link",
      },
      {
        source: markdownSurfaceFeatureAnchors["internal-heading-link"],
        type: "link",
      },
      {
        source: markdownSurfaceFeatureAnchors["broken-internal-link"],
        type: "link",
      },
    ];

    for (const expectation of inlineExpectations) {
      expect(findExactSourceNode(expectation.source, nodes)).toMatchObject({
        type: expectation.type,
      });
    }
    expect(findExactSourceNode("[^source]", nodes)).toMatchObject({
      data: { identifier: "source" },
      type: "footnote-reference",
    });
  });

  it("indexes shared link and footnote relationships once", () => {
    expect(
      document.references.links.map(({ kind, target }) => ({ kind, target })),
    ).toEqual([
      { kind: "external", target: "https://example.com" },
      { kind: "internal-document", target: "./notes.md" },
      { kind: "internal-heading", target: "#surface-contract" },
      { kind: "internal-document", target: "./missing.md" },
    ]);
    expect(document.references.footnotes).toMatchObject([
      {
        definitionRange: expect.any(Object),
        identifier: "source",
        index: 1,
        references: [{ range: expect.any(Object) }],
      },
    ]);
  });
});
