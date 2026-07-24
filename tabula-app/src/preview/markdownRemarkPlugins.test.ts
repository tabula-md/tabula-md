import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { createPreviewRehypePlugins } from "./markdownRehypePlugins";
import {
  MARKDOWN_REMARK_PLUGINS,
  transformMarkdownWikiLinks,
} from "./markdownRemarkPlugins";

type MarkdownTree = Parameters<typeof transformMarkdownWikiLinks>[0];

describe("Markdown wiki-link remark transform", () => {
  it("turns links, aliases, and embeds into annotated Markdown links", () => {
    const markdown = "\\[[Escaped]] and [[Page|Alias]] plus ![[Embed]]";
    const tree: MarkdownTree = {
      type: "root",
      children: [{
        type: "paragraph",
        children: [{
          type: "text",
          value: "[[Escaped]] and [[Page|Alias]] plus ![[Embed]]",
          position: {
            start: { offset: 0 },
            end: { offset: markdown.length },
          },
        }],
      }],
    };

    transformMarkdownWikiLinks(tree, markdown);

    expect(tree.children?.[0]?.children).toEqual([
      { type: "text", value: "[[Escaped]] and " },
      {
        type: "link",
        url: "Page",
        data: {
          hProperties: {
            "data-wikilink-relation": "link",
            "data-wikilink-target": "Page",
          },
        },
        position: {
          start: { offset: markdown.indexOf("[[Page") },
          end: { offset: markdown.indexOf("[[Page") + "[[Page|Alias]]".length },
        },
        children: [{ type: "text", value: "Alias" }],
      },
      { type: "text", value: " plus " },
      {
        type: "link",
        url: "Embed",
        data: {
          hProperties: {
            "data-wikilink-relation": "embed",
            "data-wikilink-target": "Embed",
          },
        },
        position: {
          start: { offset: markdown.indexOf("![[Embed]]") },
          end: { offset: markdown.length },
        },
        children: [{ type: "text", value: "Embed" }],
      },
    ]);
  });

  it("does not transform wiki-link examples inside existing links or code", () => {
    const tree: MarkdownTree = {
      type: "root",
      children: [
        {
          type: "link",
          url: "Target.md",
          children: [{ type: "text", value: "[[Nested]]" }],
        },
        { type: "inlineCode", value: "[[Code]]" },
      ],
    };

    transformMarkdownWikiLinks(tree, "[[Nested]] `[[Code]]`");

    expect(tree.children).toEqual([
      {
        type: "link",
        url: "Target.md",
        children: [{ type: "text", value: "[[Nested]]" }],
      },
      { type: "inlineCode", value: "[[Code]]" },
    ]);
  });

  it("passes wiki-link targets and relations through React Markdown", () => {
    let receivedProps: Record<string, unknown> | undefined;
    const html = renderToStaticMarkup(createElement(
      ReactMarkdown,
      {
        components: {
          a: ({ node: _node, ...props }) => {
            receivedProps = props;
            return createElement("a", props);
          },
        },
        rehypePlugins: createPreviewRehypePlugins([]),
        remarkPlugins: MARKDOWN_REMARK_PLUGINS,
      },
      "[[Guide.md#Guide|Wiki guide]] and ![[Guide.md|Embedded guide]]",
    ));

    expect(receivedProps).toMatchObject({
      "data-wikilink-relation": "embed",
      "data-wikilink-target": "Guide.md",
    });
    expect(html).toContain(
      '<a href="Guide.md#Guide" data-wikilink-relation="link" data-wikilink-target="Guide.md#Guide">Wiki guide</a>',
    );
    expect(html).toContain(
      '<a href="Guide.md" data-wikilink-relation="embed" data-wikilink-target="Guide.md">Embedded guide</a>',
    );
  });
});
