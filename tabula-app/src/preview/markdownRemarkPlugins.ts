import remarkBreaks from "remark-breaks";
import remarkDeflist from "remark-deflist";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkSupersub from "remark-supersub";
import type { Options as ReactMarkdownOptions } from "react-markdown";

type MarkdownAstPosition = {
  start?: { offset?: number };
  end?: { offset?: number };
};

type MarkdownAstNode = {
  type?: string;
  value?: string;
  data?: Record<string, unknown>;
  position?: MarkdownAstPosition;
  children?: MarkdownAstNode[];
};

const MARK_INLINE_PATTERN = "==";
const markdownMarkIgnoredNodeTypes = new Set(["code", "html", "inlineCode", "yaml"]);

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

export const MARKDOWN_REMARK_PLUGINS: NonNullable<ReactMarkdownOptions["remarkPlugins"]> = [
  remarkMath,
  remarkSupersub,
  [remarkGfm, { singleTilde: false }],
  remarkDeflist,
  createRemarkMarkPlugin,
  remarkBreaks,
];
