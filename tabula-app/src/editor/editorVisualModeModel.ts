import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import { inspectFrontmatterData, parseFrontmatter } from "@tabula-md/tabula";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFootnoteFromMarkdown } from "mdast-util-gfm-footnote";
import { mathFromMarkdown } from "mdast-util-math";
import { gfmFootnote } from "micromark-extension-gfm-footnote";
import { math as mathSyntax } from "micromark-extension-math";

export type EditorVisualHiddenRange = {
  from: number;
  to: number;
};

export type EditorVisualLine = {
  className: string;
  from: number;
};

export type EditorVisualReplacement =
  | { from: number; to: number; kind: "bullet"; label: string }
  | { from: number; to: number; kind: "task"; checked: boolean }
  | { from: number; to: number; kind: "horizontal-rule" }
  | { from: number; to: number; kind: "image"; alt: string; source: string; block: boolean }
  | { from: number; to: number; kind: "footnote-reference"; index: number; label: string }
  | {
      from: number;
      to: number;
      kind: "frontmatter";
      attributes: Array<{ key: string; value: string }>;
    }
  | {
      from: number;
      to: number;
      kind: "footnote-definition";
      body: string;
      index: number;
      label: string;
    }
  | { from: number; to: number; kind: "inline-math"; expression: string }
  | { from: number; to: number; kind: "math"; expression: string }
  | { from: number; to: number; kind: "code"; code: string; language: string }
  | { from: number; to: number; kind: "diagram"; source: string }
  | {
      from: number;
      to: number;
      kind: "table";
      alignments: Array<"left" | "center" | "right" | null>;
      header: string[];
      rows: string[][];
    }
  | { from: number; to: number; kind: "callout"; calloutType: string; title: string; body: string }
  | { from: number; to: number; kind: "accordion"; title: string; body: string }
  | { from: number; to: number; kind: "tabs"; tabs: Array<{ title: string; body: string }> };

export type EditorVisualModel = {
  hiddenRanges: EditorVisualHiddenRange[];
  lines: EditorVisualLine[];
  replacements: EditorVisualReplacement[];
};

type VisibleRange = {
  from: number;
  to: number;
};

export type EditorVisualBlockRange = {
  from: number;
  to: number;
};

const rangesOverlap = (from: number, to: number, range: VisibleRange) =>
  from <= range.to && to >= range.from;

const isVisible = (from: number, to: number, visibleRanges: readonly VisibleRange[]) =>
  visibleRanges.some((range) => rangesOverlap(from, to, range));

const isLineActive = (state: EditorState, from: number, to: number) => {
  const firstLine = state.doc.lineAt(from).number;
  const lastLine = state.doc.lineAt(Math.max(from, to - 1)).number;
  return state.selection.ranges.some((selection) => {
    const selectionFirstLine = state.doc.lineAt(selection.from).number;
    const selectionLastLine = state.doc.lineAt(
      selection.empty ? selection.to : Math.max(selection.from, selection.to - 1),
    ).number;
    return selectionFirstLine <= lastLine && selectionLastLine >= firstLine;
  });
};

const hasSelectedSource = (state: EditorState, from: number, to: number) =>
  state.selection.ranges.some((selection) =>
    !selection.empty && selection.from < to && selection.to > from);

const isEditingBlock = (
  editingBlock: EditorVisualBlockRange | null,
  from: number,
  to: number,
) => editingBlock?.from === from && editingBlock.to === to;

const getLineClass = (nodeName: string) => {
  if (nodeName.startsWith("ATXHeading")) {
    const level = Number(nodeName.slice("ATXHeading".length));
    return Number.isFinite(level) ? `cm-visual-heading cm-visual-heading-${level}` : "";
  }
  return "";
};

const splitTableRow = (line: string) => {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
};

const getDirectChildren = (node: SyntaxNode) => {
  const children: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) children.push(child);
  return children;
};

const parseTableNode = (state: EditorState, node: SyntaxNode) => {
  const readCells = (row: SyntaxNode) => getDirectChildren(row)
    .filter((child) => child.name === "TableCell")
    .map((cell) => state.doc.sliceString(cell.from, cell.to).trim());
  const children = getDirectChildren(node);
  const header = children.find((child) => child.name === "TableHeader");
  const delimiter = children.find((child) =>
    child.name === "TableDelimiter" &&
    state.doc.sliceString(child.from, child.to).includes("-"));
  const delimiterCells = splitTableRow(
    delimiter
      ? state.doc.sliceString(delimiter.from, delimiter.to)
      : state.doc.sliceString(node.from, node.to).split("\n")[1] ?? "",
  );
  const alignments = delimiterCells.map((cell) => {
    const trimmed = cell.trim();
    if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
    if (trimmed.endsWith(":")) return "right";
    if (trimmed.startsWith(":")) return "left";
    return null;
  });
  const rows = children
    .filter((child) => child.name === "TableRow")
    .map(readCells);

  if (header) return { alignments, header: readCells(header), rows };

  const lines = state.doc.sliceString(node.from, node.to).split("\n");
  return {
    alignments,
    header: splitTableRow(lines[0] ?? ""),
    rows: lines.slice(2).filter(Boolean).map(splitTableRow),
  };
};

const parseImageNode = (state: EditorState, node: SyntaxNode) => {
  const children = getDirectChildren(node);
  const marks = children.filter((child) => child.name === "LinkMark");
  const url = children.find((child) => child.name === "URL");
  const label = children.find((child) => child.name === "LinkLabel");
  const altFrom = marks[0]?.to ?? node.from + 2;
  const altTo = marks[1]?.from ?? altFrom;
  const alt = state.doc.sliceString(altFrom, altTo);

  if (url) {
    return {
      alt,
      source: state.doc.sliceString(url.from, url.to),
    };
  }

  if (!label) return null;
  const wantedLabel = state.doc.sliceString(label.from, label.to).toLowerCase();
  let source = "";
  syntaxTree(state).iterate({
    enter(reference) {
      if (reference.name !== "LinkReference") return;
      const referenceNode = reference.node;
      const referenceChildren = getDirectChildren(referenceNode);
      const referenceLabel = referenceChildren.find((child) => child.name === "LinkLabel");
      const referenceUrl = referenceChildren.find((child) => child.name === "URL");
      if (
        referenceLabel &&
        referenceUrl &&
        state.doc.sliceString(referenceLabel.from, referenceLabel.to).toLowerCase() === wantedLabel
      ) {
        source = state.doc.sliceString(referenceUrl.from, referenceUrl.to);
      }
    },
  });
  return source ? { alt, source } : null;
};

const parseCodeBlock = (source: string) => {
  const lines = source.split("\n");
  const opening = /^(`{3,}|~{3,})\s*([^\s`]*)/.exec(lines[0] ?? "");
  const fence = opening?.[1] ?? "";
  const closingPattern = fence
    ? new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`)
    : null;
  const hasClosingFence = Boolean(
    closingPattern && lines.length > 1 && closingPattern.test(lines.at(-1) ?? ""),
  );
  return {
    code: lines.slice(1, hasClosingFence ? -1 : undefined).join("\n"),
    language: opening?.[2]?.trim().toLowerCase() ?? "",
  };
};

const parseMathBlock = (source: string) => {
  const match = /^\$\$\s*\n?([\s\S]*?)\n?\s*\$\$$/.exec(source.trim());
  return match?.[1]?.trim() || null;
};

const parseCallout = (source: string) => {
  const lines = source.split("\n").map((line) => line.replace(/^\s*>\s?/, ""));
  const marker = /^\[!([A-Za-z-]+)\]\s*(.*)$/.exec(lines[0] ?? "");
  if (!marker) return null;
  const calloutType = marker[1].toLowerCase();
  return {
    body: lines.slice(1).join("\n").trim(),
    calloutType,
    title: marker[2].trim() || calloutType,
  };
};

type DocsComponentName = "Accordion" | "Callout" | "Tab" | "Tabs";

type DocsComponentNode = {
  attributes: Map<string, string>;
  children: DocsComponentNode[];
  closeFrom: number;
  from: number;
  name: DocsComponentName;
  openTo: number;
  to: number;
};

type OpenDocsComponent = Omit<DocsComponentNode, "closeFrom" | "to">;

const DOCS_COMPONENT_NAMES = new Set<DocsComponentName>([
  "Accordion",
  "Callout",
  "Tab",
  "Tabs",
]);

const getFencedCodeRanges = (source: string) => {
  const ranges: Array<{ from: number; to: number }> = [];
  let open: { character: string; from: number; length: number } | null = null;
  let offset = 0;
  for (const line of source.split("\n")) {
    if (!open) {
      const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (opening) {
        open = {
          character: opening[1][0],
          from: offset,
          length: opening[1].length,
        };
      }
    } else {
      const closing = new RegExp(
        `^ {0,3}${open.character === "`" ? "`" : "~"}{${open.length},}[ \\t]*$`,
      );
      if (closing.test(line)) {
        ranges.push({ from: open.from, to: offset + line.length });
        open = null;
      }
    }
    offset += line.length + 1;
  }
  if (open) ranges.push({ from: open.from, to: source.length });
  return ranges;
};

const isInsideRange = (
  position: number,
  ranges: readonly { from: number; to: number }[],
) => ranges.some((range) => position >= range.from && position <= range.to);

const findTagEnd = (source: string, from: number) => {
  let quote: "'" | '"' | null = null;
  for (let index = from; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote && source[index - 1] !== "\\") quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === ">") return index + 1;
  }
  return null;
};

const parseDocsComponentAttributes = (source: string) => {
  const attributes = new Map<string, string>();
  const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const match of source.matchAll(pattern)) {
    attributes.set(match[1], match[2] ?? match[3] ?? "");
  }
  return attributes;
};

const isFlowTagStart = (source: string, position: number) => {
  const lineStart = source.lastIndexOf("\n", position - 1) + 1;
  return /^ {0,3}$/.test(source.slice(lineStart, position));
};

const parseDocsComponentNodes = (source: string) => {
  const fencedCodeRanges = getFencedCodeRanges(source);
  const roots: DocsComponentNode[] = [];
  const stack: OpenDocsComponent[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const from = source.indexOf("<", cursor);
    if (from < 0) break;
    cursor = from + 1;
    if (isInsideRange(from, fencedCodeRanges)) continue;

    const to = findTagEnd(source, cursor);
    if (to === null) break;
    const rawTag = source.slice(from + 1, to - 1);
    const match = /^\s*(\/?)\s*([A-Za-z][\w.-]*)([\s\S]*?)\s*(\/?)\s*$/.exec(rawTag);
    if (!match || !DOCS_COMPONENT_NAMES.has(match[2] as DocsComponentName)) {
      cursor = to;
      continue;
    }

    const closing = match[1] === "/";
    const selfClosing = match[4] === "/";
    const name = match[2] as DocsComponentName;
    if (!closing && !isFlowTagStart(source, from)) {
      cursor = to;
      continue;
    }

    if (closing) {
      const open = stack.at(-1);
      if (!open || open.name !== name) {
        cursor = to;
        continue;
      }
      stack.pop();
      const node: DocsComponentNode = {
        ...open,
        closeFrom: from,
        to,
      };
      const parent = stack.at(-1);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else if (!selfClosing) {
      stack.push({
        attributes: parseDocsComponentAttributes(match[3]),
        children: [],
        from,
        name,
        openTo: to,
      });
    }
    cursor = to;
  }

  return roots;
};

const parseDocsComponents = (source: string): EditorVisualReplacement[] => {
  const parseComponent = (
    component: DocsComponentNode,
  ): EditorVisualReplacement | null => {
    const { from, to } = component;
    const body = source.slice(component.openTo, component.closeFrom).trim();

    if (component.name === "Callout") {
      const typeAttribute = component.attributes.get("type");
      const titleAttribute = component.attributes.get("title");
      const calloutType = typeAttribute?.toLowerCase() || "note";
      return {
        body,
        calloutType,
        from,
        kind: "callout",
        title: titleAttribute || calloutType,
        to,
      };
    }

    if (component.name === "Accordion") {
      const titleAttribute = component.attributes.get("title");
      return {
        body,
        from,
        kind: "accordion",
        title: titleAttribute || "Details",
        to,
      };
    }

    if (component.name === "Tabs") {
      const tabs = component.children
        .filter((tab) => tab.name === "Tab")
        .map((tab, index) => {
          const titleAttribute = tab.attributes.get("title");
          return {
            body: source.slice(tab.openTo, tab.closeFrom).trim(),
            title: titleAttribute || `Tab ${index + 1}`,
          };
        });
      if (tabs.length > 0) return { from, kind: "tabs", tabs, to };
    }

    return null;
  };

  const replacements: EditorVisualReplacement[] = [];
  const visit = (element: DocsComponentNode) => {
    const replacement = parseComponent(element);
    if (replacement) {
      replacements.push(replacement);
      return;
    }
    for (const child of element.children) visit(child);
  };
  for (const element of parseDocsComponentNodes(source)) visit(element);
  return replacements;
};

const docsComponentsByDocument = new WeakMap<object, EditorVisualReplacement[]>();
const footnotesByDocument = new WeakMap<object, EditorVisualReplacement[]>();
const inlineMathByDocument = new WeakMap<object, EditorVisualReplacement[]>();
const frontmatterByDocument = new WeakMap<object, EditorVisualReplacement | null>();

const getDocsComponents = (state: EditorState) => {
  const documentKey = state.doc as object;
  const cached = docsComponentsByDocument.get(documentKey);
  if (cached) return cached;
  const replacements = parseDocsComponents(state.doc.toString());
  docsComponentsByDocument.set(documentKey, replacements);
  return replacements;
};

const getFrontmatter = (state: EditorState) => {
  const documentKey = state.doc as object;
  const cached = frontmatterByDocument.get(documentKey);
  if (typeof cached !== "undefined") return cached;

  const source = state.doc.toString();
  const inspection = inspectFrontmatterData(source);
  const replacement = inspection.status === "valid" && inspection.bodyOffset > 0
    ? {
        attributes: parseFrontmatter(source).attributes,
        from: 0,
        kind: "frontmatter" as const,
        to: inspection.bodyOffset,
      }
    : null;
  frontmatterByDocument.set(documentKey, replacement);
  return replacement;
};

type PositionedMarkdownNode = {
  children?: PositionedMarkdownNode[];
  identifier?: string;
  label?: string;
  position?: {
    end?: { offset?: number };
    start?: { offset?: number };
  };
  type?: string;
  value?: string;
};

const readFootnoteDefinitionBody = (source: string) => {
  const lines = source.split("\n");
  const first = (lines.shift() ?? "").replace(
    /^ {0,3}\[\^[^\]\n]+\]:[ \t]*/,
    "",
  );
  return [
    first,
    ...lines.map((line) => line.replace(/^(?: {4}|\t)/, "")),
  ].join("\n").trimEnd();
};

const getFootnotes = (state: EditorState) => {
  const documentKey = state.doc as object;
  const cached = footnotesByDocument.get(documentKey);
  if (cached) return cached;

  const replacements: EditorVisualReplacement[] = [];
  try {
    const source = state.doc.toString();
    const tree = fromMarkdown(source, {
      extensions: [gfmFootnote()],
      mdastExtensions: [gfmFootnoteFromMarkdown()],
    }) as PositionedMarkdownNode;
    const references: PositionedMarkdownNode[] = [];
    const definitions: PositionedMarkdownNode[] = [];
    const visit = (node: PositionedMarkdownNode) => {
      if (node.type === "footnoteReference") references.push(node);
      if (node.type === "footnoteDefinition") definitions.push(node);
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);

    const indices = new Map<string, number>();
    for (const reference of references) {
      const label = reference.identifier ?? reference.label ?? "";
      if (!indices.has(label)) indices.set(label, indices.size + 1);
      const from = reference.position?.start?.offset;
      const to = reference.position?.end?.offset;
      if (typeof from !== "number" || typeof to !== "number") continue;
      replacements.push({
        from,
        index: indices.get(label) ?? 1,
        kind: "footnote-reference",
        label,
        to,
      });
    }
    for (const definition of definitions) {
      const label = definition.identifier ?? definition.label ?? "";
      if (!indices.has(label)) indices.set(label, indices.size + 1);
      const from = definition.position?.start?.offset;
      const to = definition.position?.end?.offset;
      if (typeof from !== "number" || typeof to !== "number") continue;
      replacements.push({
        body: readFootnoteDefinitionBody(source.slice(from, to)),
        from,
        index: indices.get(label) ?? 1,
        kind: "footnote-definition",
        label,
        to,
      });
    }
  } catch {
    // Keep the canonical Markdown source visible when footnote parsing fails.
  }
  footnotesByDocument.set(documentKey, replacements);
  return replacements;
};

const getInlineMath = (state: EditorState) => {
  const documentKey = state.doc as object;
  const cached = inlineMathByDocument.get(documentKey);
  if (cached) return cached;

  const replacements: EditorVisualReplacement[] = [];
  try {
    const tree = fromMarkdown(state.doc.toString(), {
      extensions: [mathSyntax()],
      mdastExtensions: [mathFromMarkdown()],
    }) as PositionedMarkdownNode;
    const visit = (node: PositionedMarkdownNode) => {
      if (node.type === "inlineMath") {
        const from = node.position?.start?.offset;
        const to = node.position?.end?.offset;
        if (
          typeof from === "number" &&
          typeof to === "number" &&
          typeof node.value === "string"
        ) {
          replacements.push({
            expression: node.value,
            from,
            kind: "inline-math",
            to,
          });
        }
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  } catch {
    // Keep the Markdown source visible when math parsing fails.
  }
  inlineMathByDocument.set(documentKey, replacements);
  return replacements;
};

const isInsideReplacement = (
  node: SyntaxNode,
  replacements: readonly EditorVisualReplacement[],
) => replacements.some((replacement) =>
  node.from >= replacement.from && node.to <= replacement.to);

const addComponentReplacements = (
  model: EditorVisualModel,
  state: EditorState,
  visibleRanges: readonly VisibleRange[],
  editingBlock: EditorVisualBlockRange | null,
  revealActiveSource: boolean,
) => {
  const replacements = getDocsComponents(state);
  for (const replacement of replacements) {
    if (!isVisible(replacement.from, replacement.to, visibleRanges)) continue;
    if (
      !isEditingBlock(editingBlock, replacement.from, replacement.to) &&
      !(revealActiveSource && hasSelectedSource(state, replacement.from, replacement.to))
    ) {
      model.replacements.push(replacement);
    }
  }
  return replacements;
};

const addLineClass = (
  model: EditorVisualModel,
  state: EditorState,
  from: number,
  to: number,
  className: string,
) => {
  let position = state.doc.lineAt(from).from;
  while (position <= to) {
    const line = state.doc.lineAt(position);
    model.lines.push({ className, from: line.from });
    if (line.to >= state.doc.length || line.to >= to) break;
    position = line.to + 1;
  }
};

const addCodeSourceBlockClasses = (
  model: EditorVisualModel,
  state: EditorState,
  from: number,
  to: number,
  surface: "editing" | "selection" = "editing",
) => {
  const first = state.doc.lineAt(from);
  const last = state.doc.lineAt(to);
  const surfaceClass = surface === "editing"
    ? "cm-visual-source-block"
    : "cm-visual-selected-code";
  let position = first.from;
  while (position <= last.from) {
    const line = state.doc.lineAt(position);
    const classes = [
      "cm-visual-source-code",
      surfaceClass,
      line.from === first.from ? `${surfaceClass}-first` : "",
      line.from === last.from ? `${surfaceClass}-last` : "",
    ].filter(Boolean).join(" ");
    model.lines.push({ className: classes, from: line.from });
    if (line.from === last.from) break;
    position = line.to + 1;
  }
};

const walkVisualTree = (
  model: EditorVisualModel,
  state: EditorState,
  node: SyntaxNode,
  visibleRanges: readonly VisibleRange[],
  editingBlock: EditorVisualBlockRange | null,
  parsedReplacements: readonly EditorVisualReplacement[],
  revealActiveSource: boolean,
): void => {
  if (!isVisible(node.from, node.to, visibleRanges)) return;
  if (isInsideReplacement(node, parsedReplacements)) return;

  const source = state.doc.sliceString(node.from, node.to);
  const lineClass = getLineClass(node.name);
  if (lineClass) {
    addLineClass(model, state, node.from, node.to, lineClass);
  }

  if (
    node.name !== "Document" &&
    isEditingBlock(editingBlock, node.from, node.to)
  ) {
    if (node.name === "FencedCode") {
      addCodeSourceBlockClasses(
        model,
        state,
        node.from,
        node.to,
        revealActiveSource && hasSelectedSource(state, node.from, node.to)
          ? "selection"
          : "editing",
      );
    }
    return;
  }

  if (node.name === "Table" && !isEditingBlock(editingBlock, node.from, node.to)) {
    if (revealActiveSource && hasSelectedSource(state, node.from, node.to)) return;
    model.replacements.push({
      from: node.from,
      to: node.to,
      kind: "table",
      ...parseTableNode(state, node),
    });
    return;
  }

  if (node.name === "FencedCode" && !isEditingBlock(editingBlock, node.from, node.to)) {
    if (revealActiveSource && hasSelectedSource(state, node.from, node.to)) {
      addCodeSourceBlockClasses(model, state, node.from, node.to, "selection");
      return;
    }
    const codeBlock = parseCodeBlock(source);
    model.replacements.push(
      codeBlock.language === "mermaid"
        ? { from: node.from, to: node.to, kind: "diagram", source: codeBlock.code }
        : { from: node.from, to: node.to, kind: "code", ...codeBlock },
    );
    return;
  }

  if (node.name === "HorizontalRule" && !isEditingBlock(editingBlock, node.from, node.to)) {
    if (revealActiveSource && hasSelectedSource(state, node.from, node.to)) return;
    model.replacements.push({ from: node.from, to: node.to, kind: "horizontal-rule" });
    return;
  }

  if (node.name === "Blockquote") {
    const callout = parseCallout(source);
    if (callout && !isEditingBlock(editingBlock, node.from, node.to)) {
      if (revealActiveSource && hasSelectedSource(state, node.from, node.to)) return;
      model.replacements.push({ from: node.from, to: node.to, kind: "callout", ...callout });
      return;
    }
    addLineClass(model, state, node.from, node.to, "cm-visual-quote");
  }

  if (node.name === "ListItem") {
    addLineClass(model, state, node.from, node.to, "cm-visual-list-item");
  }

  if (node.name === "Paragraph" && !isEditingBlock(editingBlock, node.from, node.to)) {
    const expression = parseMathBlock(source);
    if (expression) {
      if (revealActiveSource && hasSelectedSource(state, node.from, node.to)) return;
      model.replacements.push({ from: node.from, to: node.to, kind: "math", expression });
      return;
    }

    const firstChild = node.firstChild;
    if (firstChild?.name === "Image" && firstChild.from === node.from && firstChild.to === node.to) {
      const image = parseImageNode(state, firstChild);
      if (image) {
        if (revealActiveSource && hasSelectedSource(state, node.from, node.to)) return;
        model.replacements.push({ from: node.from, to: node.to, kind: "image", block: true, ...image });
        return;
      }
    }
  }

  if (node.name === "Image" && !isEditingBlock(editingBlock, node.from, node.to)) {
    const image = parseImageNode(state, node);
    if (image) {
      if (revealActiveSource && hasSelectedSource(state, node.from, node.to)) return;
      model.replacements.push({ from: node.from, to: node.to, kind: "image", block: false, ...image });
      return;
    }
  }

  if (
    node.name === "ListMark" &&
    !(revealActiveSource && isLineActive(state, node.from, node.to))
  ) {
    model.replacements.push({
      from: node.from,
      to: node.to,
      kind: "bullet",
      label: /^\d/.test(source) ? source : "•",
    });
    return;
  }

  if (
    node.name === "TaskMarker" &&
    !(revealActiveSource && isLineActive(state, node.from, node.to))
  ) {
    model.replacements.push({
      from: node.from,
      to: node.to,
      kind: "task",
      checked: /\[[xX]\]/.test(source),
    });
    return;
  }

  if (
    node.name === "HeaderMark" ||
    node.name === "EmphasisMark" ||
    node.name === "StrikethroughMark" ||
    node.name === "CodeMark" ||
    node.name === "QuoteMark"
  ) {
    if (!revealActiveSource || !isLineActive(state, node.from, node.to)) {
      model.hiddenRanges.push({ from: node.from, to: node.to });
    }
    return;
  }

  if (
    node.name === "Link" &&
    !(revealActiveSource && isLineActive(state, node.from, node.to))
  ) {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.name === "LinkMark" || child.name === "URL") {
        model.hiddenRanges.push({ from: child.from, to: child.to });
      }
    }
    return;
  }

  for (let child = node.firstChild; child; child = child.nextSibling) {
    walkVisualTree(
      model,
      state,
      child,
      visibleRanges,
      editingBlock,
      parsedReplacements,
      revealActiveSource,
    );
  }
};

export const buildEditorVisualModel = (
  state: EditorState,
  visibleRanges: readonly VisibleRange[] = [{ from: 0, to: state.doc.length }],
  editingBlock: EditorVisualBlockRange | null = null,
  revealActiveSource = true,
): EditorVisualModel => {
  const model: EditorVisualModel = { hiddenRanges: [], lines: [], replacements: [] };
  const parsedReplacements = [
    ...addComponentReplacements(
      model,
      state,
      visibleRanges,
      editingBlock,
      revealActiveSource,
    ),
  ];
  const frontmatter = getFrontmatter(state);
  if (frontmatter) {
    parsedReplacements.push(frontmatter);
    if (
      isVisible(frontmatter.from, frontmatter.to, visibleRanges) &&
      !isEditingBlock(editingBlock, frontmatter.from, frontmatter.to) &&
      !(revealActiveSource && hasSelectedSource(state, frontmatter.from, frontmatter.to))
    ) {
      model.replacements.push(frontmatter);
    }
  }
  for (const replacement of getFootnotes(state)) {
    parsedReplacements.push(replacement);
    if (!isVisible(replacement.from, replacement.to, visibleRanges)) continue;
    const revealReferenceLine =
      replacement.kind === "footnote-reference" &&
      revealActiveSource &&
      isLineActive(state, replacement.from, replacement.to);
    if (
      !isEditingBlock(editingBlock, replacement.from, replacement.to) &&
      !(revealActiveSource && hasSelectedSource(state, replacement.from, replacement.to)) &&
      !revealReferenceLine
    ) {
      model.replacements.push(replacement);
    }
  }
  walkVisualTree(
    model,
    state,
    syntaxTree(state).topNode,
    visibleRanges,
    editingBlock,
    parsedReplacements,
    revealActiveSource,
  );
  for (const replacement of getInlineMath(state)) {
    if (!isVisible(replacement.from, replacement.to, visibleRanges)) continue;
    if (isEditingBlock(editingBlock, replacement.from, replacement.to)) continue;
    if (
      revealActiveSource &&
      isLineActive(state, replacement.from, replacement.to)
    ) continue;
    const overlapsBlock = model.replacements.some((candidate) =>
      isEditorVisualNavigableReplacement(candidate) &&
      replacement.from >= candidate.from &&
      replacement.to <= candidate.to);
    if (!overlapsBlock) model.replacements.push(replacement);
  }
  return model;
};

export const isEditorVisualNavigableReplacement = (
  replacement: EditorVisualReplacement,
) =>
  replacement.kind !== "bullet" &&
  replacement.kind !== "task" &&
  replacement.kind !== "footnote-reference" &&
  replacement.kind !== "inline-math";

const isEditorVisualEditableReplacement = (
  replacement: EditorVisualReplacement,
) =>
  replacement.kind !== "bullet" &&
  replacement.kind !== "task" &&
  replacement.kind !== "footnote-reference";

export const findEditorVisualReplacementInRange = (
  state: EditorState,
  from: number,
  to = from,
  editingBlock: EditorVisualBlockRange | null = null,
) => buildEditorVisualModel(
  state,
  [{ from: Math.min(from, to), to: Math.max(from, to) }],
  editingBlock,
  false,
).replacements.find((replacement) => {
  if (!isEditorVisualEditableReplacement(replacement)) return false;
  return from === to
    ? from >= replacement.from && from <= replacement.to
    : Math.min(from, to) < replacement.to && Math.max(from, to) > replacement.from;
});

export const findEditorVisualReplacementOnLine = (
  state: EditorState,
  lineNumber: number,
  editingBlock: EditorVisualBlockRange | null = null,
) => {
  if (lineNumber < 1 || lineNumber > state.doc.lines) return undefined;
  const line = state.doc.line(lineNumber);
  return buildEditorVisualModel(
    state,
    [{ from: line.from, to: line.to }],
    editingBlock,
    false,
  ).replacements.find((replacement) => {
    if (!isEditorVisualNavigableReplacement(replacement)) return false;
    const firstLine = state.doc.lineAt(replacement.from).number;
    const lastLine = state.doc.lineAt(replacement.to).number;
    return lineNumber >= firstLine && lineNumber <= lastLine;
  });
};
