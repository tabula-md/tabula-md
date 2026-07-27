import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import {
  createMarkdownPresentationDocument,
  inspectFrontmatterData,
  parseFrontmatter,
  type MarkdownPresentationDocument,
  type PresentationBlock,
  type PresentationNode,
} from "@tabula-md/tabula";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFootnoteFromMarkdown } from "mdast-util-gfm-footnote";
import { gfmFootnote } from "micromark-extension-gfm-footnote";

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

const footnotesByDocument = new WeakMap<object, EditorVisualReplacement[]>();
const frontmatterByDocument = new WeakMap<object, EditorVisualReplacement | null>();
const presentationByDocument =
  new WeakMap<object, MarkdownPresentationDocument>();
const presentationNodesByDocument =
  new WeakMap<object, readonly PresentationNode[]>();

const flattenPresentationNodes = (
  nodes: readonly PresentationNode[],
): PresentationNode[] => nodes.flatMap((node) => [
  node,
  ...flattenPresentationNodes(node.children),
]);

const getPresentationDocument = (state: EditorState) => {
  const documentKey = state.doc as object;
  const cached = presentationByDocument.get(documentKey);
  if (cached) return cached;
  const presentation = createMarkdownPresentationDocument(
    state.doc.toString(),
  );
  presentationByDocument.set(documentKey, presentation);
  return presentation;
};

const getPresentationNodes = (state: EditorState) => {
  const documentKey = state.doc as object;
  const cached = presentationNodesByDocument.get(documentKey);
  if (cached) return cached;
  const nodes = flattenPresentationNodes(
    getPresentationDocument(state).blocks,
  );
  presentationNodesByDocument.set(documentKey, nodes);
  return nodes;
};

const isPresentationBlock = (
  node: PresentationNode,
): node is PresentationBlock => "interaction" in node;

const getTableCellSource = (
  state: EditorState,
  cell: PresentationBlock,
) => state.doc.sliceString(
  cell.contentRange?.from ?? cell.range.from,
  cell.contentRange?.to ?? cell.range.to,
).trim();

const getTableReplacement = (
  state: EditorState,
  block: PresentationBlock,
): EditorVisualReplacement => {
  const rows = block.children
    .filter((child): child is PresentationBlock =>
      isPresentationBlock(child) && child.type === "table-row")
    .map((row) => row.children
      .filter((child): child is PresentationBlock =>
        isPresentationBlock(child) && child.type === "table-cell")
      .map((cell) => getTableCellSource(state, cell)));
  return {
    alignments: [...(block.data?.alignments ?? [])],
    from: block.range.from,
    header: rows[0] ?? [],
    kind: "table",
    rows: rows.slice(1),
    to: block.range.to,
  };
};

const getBlockBody = (
  state: EditorState,
  node: PresentationBlock,
) => node.data?.text ?? state.doc.sliceString(
  node.contentRange?.from ?? node.range.from,
  node.contentRange?.to ?? node.range.to,
).trim();

const getVisualBlockReplacement = (
  state: EditorState,
  node: PresentationNode,
): EditorVisualReplacement | null => {
  if (node.type === "image") {
    return node.data?.url
      ? {
          alt: node.data.alt ?? "",
          block: isPresentationBlock(node),
          from: node.range.from,
          kind: "image",
          source: node.data.url,
          to: node.range.to,
        }
      : null;
  }
  if (!isPresentationBlock(node)) return null;
  if (node.type === "thematic-break") {
    return {
      from: node.range.from,
      kind: "horizontal-rule",
      to: node.range.to,
    };
  }
  if (node.type === "code-block") {
    return {
      code: node.data?.text ?? "",
      from: node.range.from,
      kind: "code",
      language: node.data?.language ?? "",
      to: node.range.to,
    };
  }
  if (node.type === "diagram") {
    return {
      from: node.range.from,
      kind: "diagram",
      source: node.data?.text ?? "",
      to: node.range.to,
    };
  }
  if (node.type === "display-math") {
    return {
      expression: node.data?.text ?? "",
      from: node.range.from,
      kind: "math",
      to: node.range.to,
    };
  }
  if (node.type === "callout") {
    const type = node.data?.attributes?.type?.toLowerCase() || "note";
    return {
      body: getBlockBody(state, node),
      calloutType: type,
      from: node.range.from,
      kind: "callout",
      title: node.data?.attributes?.title || type,
      to: node.range.to,
    };
  }
  if (node.type === "accordion") {
    return {
      body: getBlockBody(state, node),
      from: node.range.from,
      kind: "accordion",
      title: node.data?.attributes?.title || "Details",
      to: node.range.to,
    };
  }
  if (node.type === "tabs") {
    const tabs = node.children
      .filter((child): child is PresentationBlock =>
        isPresentationBlock(child) && child.type === "tab")
      .map((tab, index) => ({
        body: getBlockBody(state, tab),
        title: tab.data?.attributes?.title || `Tab ${index + 1}`,
      }));
    return tabs.length > 0
      ? {
          from: node.range.from,
          kind: "tabs",
          tabs,
          to: node.range.to,
        }
      : null;
  }
  if (node.type === "table") return getTableReplacement(state, node);
  return null;
};

const addPresentationBlockReplacements = (
  model: EditorVisualModel,
  state: EditorState,
  visibleRanges: readonly VisibleRange[],
  editingBlock: EditorVisualBlockRange | null,
  revealActiveSource: boolean,
) => {
  const replacements = getPresentationNodes(state)
    .map((node) => getVisualBlockReplacement(state, node))
    .filter((replacement): replacement is EditorVisualReplacement =>
      replacement !== null);
  for (const replacement of replacements) {
    if (!isVisible(replacement.from, replacement.to, visibleRanges)) continue;
    const selectedSource = revealActiveSource &&
      hasSelectedSource(state, replacement.from, replacement.to);
    if (
      replacement.kind === "code" &&
      (
        isEditingBlock(editingBlock, replacement.from, replacement.to) ||
        selectedSource
      )
    ) {
      addCodeSourceBlockClasses(
        model,
        state,
        replacement.from,
        replacement.to,
        selectedSource ? "selection" : "editing",
      );
    }
    if (
      !isEditingBlock(editingBlock, replacement.from, replacement.to) &&
      !selectedSource
    ) {
      model.replacements.push(replacement);
    }
  }
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
  return getPresentationNodes(state)
    .filter((node) => node.type === "inline-math")
    .map((node): EditorVisualReplacement => ({
      expression: node.data?.text ?? "",
      from: node.range.from,
      kind: "inline-math",
      to: node.range.to,
    }));
};

const isInsideReplacement = (
  node: SyntaxNode,
  replacements: readonly EditorVisualReplacement[],
) => replacements.some((replacement) =>
  node.from >= replacement.from && node.to <= replacement.to);

const presentationInlineMarkerTypes = new Set([
  "emphasis",
  "inline-code",
  "link",
  "strikethrough",
  "strong",
]);

const addPresentationInlineRanges = (
  model: EditorVisualModel,
  state: EditorState,
  visibleRanges: readonly VisibleRange[],
  revealActiveSource: boolean,
) => {
  for (const node of getPresentationNodes(state)) {
    if (!presentationInlineMarkerTypes.has(node.type)) continue;
    if (!isVisible(node.range.from, node.range.to, visibleRanges)) continue;
    if (
      revealActiveSource &&
      isLineActive(state, node.range.from, node.range.to)
    ) {
      continue;
    }
    const overlapsBlock = model.replacements.some((replacement) =>
      isEditorVisualNavigableReplacement(replacement) &&
      node.range.from >= replacement.from &&
      node.range.to <= replacement.to);
    if (!overlapsBlock) model.hiddenRanges.push(...node.markerRanges);
  }
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

  if (node.name === "Blockquote") {
    addLineClass(model, state, node.from, node.to, "cm-visual-quote");
  }

  if (node.name === "ListItem") {
    addLineClass(model, state, node.from, node.to, "cm-visual-list-item");
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
    const presentationLink = getPresentationNodes(state).some(
      (candidate) =>
        candidate.type === "link" &&
        candidate.range.from === node.from &&
        candidate.range.to === node.to,
    );
    if (presentationLink) return;
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
  const parsedReplacements = addPresentationBlockReplacements(
    model,
    state,
    visibleRanges,
    editingBlock,
    revealActiveSource,
  );
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
  addPresentationInlineRanges(
    model,
    state,
    visibleRanges,
    revealActiveSource,
  );
  model.hiddenRanges = model.hiddenRanges.filter(
    (range, index, ranges) =>
      ranges.findIndex((candidate) =>
        candidate.from === range.from && candidate.to === range.to) === index,
  );
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
