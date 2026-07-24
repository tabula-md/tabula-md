import { describe, expect, it } from "vitest";
import { namespacePreviewIds } from "./markdownRehypePlugins";

type TestNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: TestNode[];
};

describe("preview rehype plugins", () => {
  it("namespaces embedded document ids and their local references", () => {
    const tree: TestNode = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "h2",
          properties: { id: "decision" },
          children: [],
        },
        {
          type: "element",
          tagName: "a",
          properties: {
            href: "#decision",
            ariaDescribedBy: "decision other",
          },
          children: [],
        },
      ],
    };
    namespacePreviewIds(tree, "embed-1-");

    expect(tree.children?.[0]?.properties?.id).toBe("embed-1-decision");
    expect(tree.children?.[1]?.properties).toMatchObject({
      href: "#embed-1-decision",
      ariaDescribedBy: "embed-1-decision other",
    });
  });
});
