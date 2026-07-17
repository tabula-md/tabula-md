import { describe, expect, it } from "vitest";
import { unwrapPreviewDocsBlockParagraphs } from "./markdownRehypePlugins";

describe("preview rehype plugins", () => {
  it("moves a standalone fallback component out of its generated paragraph", () => {
    const fallback = {
      type: "element",
      tagName: "tabula-unsupported-component",
      properties: { dataComponentName: "ChartPanel" },
      children: [],
    };
    const tree = {
      type: "root",
      children: [{
        type: "element",
        tagName: "p",
        properties: {},
        children: [{ type: "text", value: " " }, fallback],
      }],
    };

    unwrapPreviewDocsBlockParagraphs(tree);

    expect(tree.children).toEqual([fallback]);
  });

  it("leaves inline components inside mixed paragraphs", () => {
    const tree = {
      type: "root",
      children: [{
        type: "element",
        tagName: "p",
        properties: {},
        children: [
          { type: "text", value: "Status " },
          { type: "element", tagName: "tabula-card", properties: {}, children: [] },
        ],
      }],
    };

    unwrapPreviewDocsBlockParagraphs(tree);

    expect(tree.children[0].tagName).toBe("p");
  });
});
