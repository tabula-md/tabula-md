import { describe, expect, it } from "vitest";
import { createElement, type AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown, { type Components } from "react-markdown";
import { createPreviewRehypePlugins } from "./markdownRehypePlugins";
import {
  MARKDOWN_REMARK_PLUGINS,
  transformMarkdownWikiLinks,
} from "./markdownRemarkPlugins";

type MarkdownTree = Parameters<typeof transformMarkdownWikiLinks>[0];

describe("Markdown wiki-link remark transform", () => {
  it("turns links into annotated anchors and embeds into block nodes", () => {
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

    expect(tree.children).toEqual([{
      type: "paragraph",
      children: [
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
      ],
    }, {
      type: "workspaceEmbed",
      data: {
        hName: "tabula-workspace-embed",
        hProperties: {
          "data-workspace-embed-target": "Embed",
        },
      },
      position: {
        start: { offset: markdown.indexOf("![[Embed]]") },
        end: { offset: markdown.length },
      },
    }]);
  });

  it("splits inline prose around embeds into valid block siblings", () => {
    const markdown = "Before ![[Guide]] after";
    const tree: MarkdownTree = {
      type: "root",
      children: [{
        type: "paragraph",
        children: [{
          type: "text",
          value: markdown,
          position: {
            start: { offset: 0 },
            end: { offset: markdown.length },
          },
        }],
      }],
    };

    transformMarkdownWikiLinks(tree, markdown);

    expect(tree.children?.map((node) => node.type)).toEqual([
      "paragraph",
      "workspaceEmbed",
      "paragraph",
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

  it("passes wiki-link and embed targets through React Markdown", () => {
    let receivedProps: Record<string, unknown> | undefined;
    let receivedEmbedProps: Record<string, unknown> | undefined;
    const html = renderToStaticMarkup(createElement(
      ReactMarkdown,
      {
        components: {
          a: ({
            node: _node,
            ...props
          }: AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) => {
            receivedProps = props;
            return createElement("a", props);
          },
          "tabula-workspace-embed": ({ node: _node, ...props }: {
            node?: unknown;
            [key: string]: unknown;
          }) => {
            receivedEmbedProps = props;
            return createElement("section", props);
          },
        } as unknown as Components,
        rehypePlugins: createPreviewRehypePlugins([]),
        remarkPlugins: MARKDOWN_REMARK_PLUGINS,
      },
      "[[Guide.md#Guide|Wiki guide]] and ![[Guide.md|Embedded guide]]",
    ));

    expect(receivedProps).toMatchObject({
      "data-wikilink-relation": "link",
      "data-wikilink-target": "Guide.md#Guide",
    });
    expect(receivedEmbedProps).toMatchObject({
      "data-workspace-embed-target": "Guide.md",
    });
    expect(html).toContain(
      '<a href="Guide.md#Guide" data-wikilink-relation="link" data-wikilink-target="Guide.md#Guide">Wiki guide</a>',
    );
    expect(html).toContain(
      '<section data-workspace-embed-target="Guide.md"></section>',
    );
  });
});
