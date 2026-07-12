import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import type { MarkdownFormatCommand } from "@tabula-md/tabula";

const nodeFormats = new Map<string, MarkdownFormatCommand>([
  ["ATXHeading1", "heading-1"],
  ["ATXHeading2", "heading-2"],
  ["ATXHeading3", "heading-3"],
  ["Blockquote", "quote"],
  ["BulletList", "bullet-list"],
  ["Emphasis", "italic"],
  ["FencedCode", "code-block"],
  ["InlineCode", "inline-code"],
  ["Link", "link"],
  ["OrderedList", "numbered-list"],
  ["StrongEmphasis", "bold"],
]);

const formatOrder: MarkdownFormatCommand[] = [
  "bold",
  "italic",
  "strikethrough",
  "inline-code",
  "link",
  "heading-1",
  "heading-2",
  "heading-3",
  "bullet-list",
  "numbered-list",
  "check-list",
  "quote",
  "code-block",
];

const collectNodeFormats = (
  state: EditorState,
  position: number,
  association: -1 | 1,
  formats: Set<MarkdownFormatCommand>,
) => {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, association);
  while (node) {
    const format = nodeFormats.get(node.name);
    if (format) formats.add(format);
    node = node.parent;
  }
};

const isInsideStrikethrough = (state: EditorState, position: number) => {
  const line = state.doc.lineAt(position);
  const lineText = line.text;
  const linePosition = position - line.from;
  const pattern = /~~(?=\S)(.*?\S)~~/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(lineText))) {
    const start = match.index + 2;
    const end = match.index + match[0].length - 2;
    if (linePosition >= start && linePosition <= end) return true;
  }

  return false;
};

export const getActiveMarkdownFormats = (state: EditorState): MarkdownFormatCommand[] => {
  const formats = new Set<MarkdownFormatCommand>();
  const selection = state.selection.main;
  const position = selection.head;

  collectNodeFormats(state, position, -1, formats);
  collectNodeFormats(state, position, 1, formats);

  const line = state.doc.lineAt(position);
  if (/^\s*[-*+]\s+\[[ xX]\]\s/.test(line.text)) {
    formats.delete("bullet-list");
    formats.add("check-list");
  }
  if (isInsideStrikethrough(state, position)) formats.add("strikethrough");

  return formatOrder.filter((format) => formats.has(format));
};
