import remarkBreaks from "remark-breaks";
import remarkDeflist from "remark-deflist";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkSupersub from "remark-supersub";
import type { Options as ReactMarkdownOptions } from "react-markdown";
import {
  scanMarkdownWikiLinks,
  type MarkdownWikiLinkToken,
} from "@tabula-md/tabula";

type MarkdownAstPosition = {
  start?: { offset?: number };
  end?: { offset?: number };
};

type MarkdownAstNode = {
  type?: string;
  value?: string;
  url?: string;
  data?: Record<string, unknown>;
  position?: MarkdownAstPosition;
  children?: MarkdownAstNode[];
};

const MARK_INLINE_PATTERN = "==";
const markdownMarkIgnoredNodeTypes = new Set(["code", "html", "inlineCode", "yaml"]);
const markdownWikiLinkIgnoredNodeTypes = new Set([
  "code",
  "html",
  "image",
  "imageReference",
  "inlineCode",
  "link",
  "linkReference",
  "yaml",
]);

const createPositionFromOffsets = (
  sourcePosition: MarkdownAstPosition | undefined,
  start: number,
  end: number,
) => {
  const baseOffset = sourcePosition?.start?.offset;
  if (typeof baseOffset !== "number") return undefined;
  return {
    start: { offset: baseOffset + start },
    end: { offset: baseOffset + end },
  };
};

const splitMarkedTextNode = (node: MarkdownAstNode): MarkdownAstNode[] | null => {
  const value = node.value ?? "";
  let cursor = 0;
  const nextNodes: MarkdownAstNode[] = [];

  while (cursor < value.length) {
    const markerStart = value.indexOf(MARK_INLINE_PATTERN, cursor);
    if (markerStart === -1) break;
    const markerEnd = value.indexOf(MARK_INLINE_PATTERN, markerStart + MARK_INLINE_PATTERN.length);
    if (markerEnd === -1) break;

    const markedValue = value.slice(markerStart + MARK_INLINE_PATTERN.length, markerEnd);
    if (markedValue.length === 0 || markedValue.includes("\n")) {
      cursor = markerEnd + MARK_INLINE_PATTERN.length;
      continue;
    }

    if (markerStart > cursor) {
      nextNodes.push({
        type: "text",
        value: value.slice(cursor, markerStart),
        position: createPositionFromOffsets(node.position, cursor, markerStart),
      });
    }

    nextNodes.push({
      type: "mark",
      data: { hName: "mark" },
      position: createPositionFromOffsets(node.position, markerStart, markerEnd + MARK_INLINE_PATTERN.length),
      children: [{
        type: "text",
        value: markedValue,
        position: createPositionFromOffsets(
          node.position,
          markerStart + MARK_INLINE_PATTERN.length,
          markerEnd,
        ),
      }],
    });
    cursor = markerEnd + MARK_INLINE_PATTERN.length;
  }

  if (nextNodes.length === 0) return null;
  if (cursor < value.length) {
    nextNodes.push({
      type: "text",
      value: value.slice(cursor),
      position: createPositionFromOffsets(node.position, cursor, value.length),
    });
  }
  return nextNodes;
};

const createRemarkMarkPlugin = () => (tree: MarkdownAstNode) => {
  const walk = (node: MarkdownAstNode) => {
    if (!node.children || markdownMarkIgnoredNodeTypes.has(node.type ?? "")) return;
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      const child = node.children[index];
      if (child.type === "text") {
        const replacementNodes = splitMarkedTextNode(child);
        if (replacementNodes) node.children.splice(index, 1, ...replacementNodes);
      } else {
        walk(child);
      }
    }
  };
  walk(tree);
};

type MappedWikiLinkToken = MarkdownWikiLinkToken & {
  valueFrom: number;
  valueTo: number;
};

const mapWikiLinkTokensToRenderedText = (
  source: string,
  value: string,
): MappedWikiLinkToken[] => {
  const mapped: MappedWikiLinkToken[] = [];
  let valueCursor = 0;
  for (const token of scanMarkdownWikiLinks(source)) {
    const markup = source.slice(token.from, token.to);
    const valueFrom = value.indexOf(markup, valueCursor);
    if (valueFrom === -1) continue;
    const valueTo = valueFrom + markup.length;
    mapped.push({ ...token, valueFrom, valueTo });
    valueCursor = valueTo;
  }
  return mapped;
};

const splitWikiLinkTextNode = (
  node: MarkdownAstNode,
  markdown: string,
): MarkdownAstNode[] | null => {
  const value = node.value ?? "";
  const sourceStart = node.position?.start?.offset;
  const sourceEnd = node.position?.end?.offset;
  const source =
    typeof sourceStart === "number" && typeof sourceEnd === "number"
      ? markdown.slice(sourceStart, sourceEnd)
      : value;
  const tokens = mapWikiLinkTokensToRenderedText(source, value);
  if (tokens.length === 0) return null;

  const nextNodes: MarkdownAstNode[] = [];
  let valueCursor = 0;
  for (const token of tokens) {
    if (token.valueFrom > valueCursor) {
      nextNodes.push({
        type: "text",
        value: value.slice(valueCursor, token.valueFrom),
      });
    }
    nextNodes.push(
      token.relation === "embed"
        ? {
            type: "workspaceEmbed",
            data: {
              hName: "tabula-workspace-embed",
              hProperties: {
                "data-workspace-embed-target": token.target,
              },
            },
            position: createPositionFromOffsets(node.position, token.from, token.to),
          }
        : {
            type: "link",
            url: token.target,
            data: {
              hProperties: {
                "data-wikilink-relation": token.relation,
                "data-wikilink-target": token.target,
              },
            },
            position: createPositionFromOffsets(node.position, token.from, token.to),
            children: [{ type: "text", value: token.label }],
          },
    );
    valueCursor = token.valueTo;
  }
  if (valueCursor < value.length) {
    nextNodes.push({ type: "text", value: value.slice(valueCursor) });
  }
  return nextNodes;
};

const splitParagraphsAroundWorkspaceEmbeds = (node: MarkdownAstNode) => {
  if (!node.children) return;

  const nextChildren: MarkdownAstNode[] = [];
  for (const child of node.children) {
    splitParagraphsAroundWorkspaceEmbeds(child);
    if (
      child.type !== "paragraph" ||
      !child.children?.some((candidate) => candidate.type === "workspaceEmbed")
    ) {
      nextChildren.push(child);
      continue;
    }

    let inlineChildren: MarkdownAstNode[] = [];
    const flushInlineChildren = () => {
      if (inlineChildren.length === 0) return;
      const hasVisibleContent = inlineChildren.some((candidate) =>
        candidate.type !== "text" || (candidate.value ?? "").trim().length > 0
      );
      if (hasVisibleContent) {
        nextChildren.push({
          ...child,
          children: inlineChildren,
        },
        );
      }
      inlineChildren = [];
    };

    for (const paragraphChild of child.children) {
      if (paragraphChild.type === "workspaceEmbed") {
        flushInlineChildren();
        nextChildren.push(paragraphChild);
      } else {
        inlineChildren.push(paragraphChild);
      }
    }
    flushInlineChildren();
  }
  node.children = nextChildren;
};

export const transformMarkdownWikiLinks = (
  tree: MarkdownAstNode,
  markdown: string,
) => {
  const walk = (node: MarkdownAstNode) => {
    if (!node.children || markdownWikiLinkIgnoredNodeTypes.has(node.type ?? "")) return;
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      const child = node.children[index];
      if (child.type === "text") {
        const replacementNodes = splitWikiLinkTextNode(child, markdown);
        if (replacementNodes) node.children.splice(index, 1, ...replacementNodes);
      } else {
        walk(child);
      }
    }
  };
  walk(tree);
  splitParagraphsAroundWorkspaceEmbeds(tree);
};

const createRemarkWikiLinkPlugin = () => (
  tree: MarkdownAstNode,
  file: { value?: unknown },
) => {
  transformMarkdownWikiLinks(tree, typeof file.value === "string" ? file.value : "");
};

export const MARKDOWN_REMARK_PLUGINS: NonNullable<ReactMarkdownOptions["remarkPlugins"]> = [
  remarkMath,
  remarkSupersub,
  [remarkGfm, { singleTilde: false }],
  remarkDeflist,
  createRemarkMarkPlugin,
  createRemarkWikiLinkPlugin,
  remarkBreaks,
];
