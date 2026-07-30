import { describe, expect, it } from "vitest";
import { analyzeMdxSource } from "./mdxAnalysis";

describe("analyzeMdxSource", () => {
  it("indexes Markdown structure while recording inert MDX syntax ranges", () => {
    const source = [
      "---",
      "title: MDX Guide",
      "---",
      "import Widget from 'https://example.com/widget.js'",
      "export const answer = 42",
      "",
      "<Callout tone=\"info\">",
      "# Guide",
      "",
      "[Read next](./next.md)",
      "{answer}",
      "</Callout>",
      "<UnknownPanel />",
    ].join("\n");
    const analysis = analyzeMdxSource({
      id: "guide",
      path: "guide.mdx",
      markdown: source,
    });

    expect(analysis.document.metadata).toMatchObject({ title: "MDX Guide" });
    expect(analysis.document.headings).toEqual([
      expect.objectContaining({ depth: 1, text: "Guide" }),
    ]);
    expect(analysis.document.links).toEqual([
      expect.objectContaining({ syntax: "markdown", target: "./next.md" }),
    ]);
    expect(analysis.ranges.map((range) => range.kind)).toEqual([
      "esm-import",
      "esm-export",
      "jsx-component",
      "expression",
      "jsx-component",
      "jsx-component",
    ]);
    expect(analysis.ranges.filter((range) => range.kind === "jsx-component"))
      .toEqual([
        expect.objectContaining({ name: "Callout", registered: true }),
        expect.objectContaining({ name: "Callout", registered: true }),
        expect.objectContaining({ name: "UnknownPanel", registered: false }),
      ]);
    expect(analysis.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "mdx-import-not-loaded" }),
      expect.objectContaining({ code: "mdx-export-not-evaluated" }),
      expect.objectContaining({ code: "mdx-expression-not-evaluated" }),
      expect.objectContaining({
        code: "unknown-mdx-component",
        componentName: "UnknownPanel",
      }),
    ]));
  });

  it("never evaluates expressions and ignores MDX-looking text in code fences", () => {
    const globalState = globalThis as typeof globalThis & { __tabulaMdxExecuted?: boolean };
    globalState.__tabulaMdxExecuted = false;
    const source = [
      "{globalThis.__tabulaMdxExecuted = true}",
      "",
      "```mdx",
      "import Danger from 'https://example.com/danger.js'",
      "<Danger>{globalThis.__tabulaMdxExecuted = true}</Danger>",
      "```",
    ].join("\n");

    const analysis = analyzeMdxSource({
      id: "unsafe",
      path: "unsafe.mdx",
      markdown: source,
    });

    expect(globalState.__tabulaMdxExecuted).toBe(false);
    expect(analysis.ranges).toEqual([
      expect.objectContaining({ kind: "expression" }),
    ]);
    delete globalState.__tabulaMdxExecuted;
  });
});
