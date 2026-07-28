import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfmFootnoteFromMarkdown } from "mdast-util-gfm-footnote";
import { mathFromMarkdown } from "mdast-util-math";
import { gfm } from "micromark-extension-gfm";
import { gfmFootnote } from "micromark-extension-gfm-footnote";
import { math } from "micromark-extension-math";
import {
  inspectFrontmatterData,
  parseFrontmatter,
} from "./parse";
import type {
  BlockInteractionPolicy,
  MarkdownPresentationDocument,
  PresentationBlock,
  PresentationBlockType,
  PresentationFootnote,
  PresentationInlineType,
  PresentationLinkKind,
  PresentationLinkReference,
  PresentationNode,
  PresentationNodeData,
  PresentationReferenceDefinition,
  ReferenceIndex,
  SourceRange,
} from "./presentationModel";

type MarkdownAstNode = {
  align?: Array<"center" | "left" | "right" | null>;
  alt?: string;
  checked?: boolean | null;
  children?: MarkdownAstNode[];
  depth?: number;
  identifier?: string;
  label?: string;
  lang?: string | null;
  ordered?: boolean;
  position?: {
    end?: { offset?: number };
    start?: { offset?: number };
  };
  start?: number | null;
  title?: string | null;
  type: string;
  url?: string;
  value?: string;
};

const parserOptions = {
  extensions: [gfm(), gfmFootnote(), math()],
  mdastExtensions: [
    gfmFromMarkdown(),
    gfmFootnoteFromMarkdown(),
    mathFromMarkdown(),
  ],
};

const externalLinkPattern = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

const atomicBlockTypes = new Set<PresentationBlockType>([
  "accordion",
  "callout",
  "code-block",
  "diagram",
  "display-math",
  "frontmatter",
  "image",
  "table",
  "tabs",
  "thematic-break",
]);

const contentNavigationTypes = new Set<PresentationBlockType>([
  "accordion",
  "blockquote",
  "callout",
  "code-block",
  "diagram",
  "display-math",
  "footnote-definition",
  "ordered-list",
  "table",
  "tabs",
  "unordered-list",
]);

const getBlockInteraction = (
  type: PresentationBlockType,
): BlockInteractionPolicy => ({
  arrowNavigation: atomicBlockTypes.has(type)
    ? contentNavigationTypes.has(type)
      ? "content"
      : "block"
    : "line",
  atomicWhenInactive: atomicBlockTypes.has(type),
  revealSourceWhenActive: type !== "blank-line",
});

const normalizeIdentifier = (identifier: string) =>
  identifier.trim().replace(/\s+/g, " ").toLowerCase();

const getNodeId = (type: string, range: SourceRange) =>
  `${type}:${range.from}:${range.to}`;

const getNodeRange = (
  node: MarkdownAstNode,
  baseOffset: number,
): SourceRange | null => {
  const from = node.position?.start?.offset;
  const to = node.position?.end?.offset;
  return typeof from === "number" && typeof to === "number"
    ? { from: baseOffset + from, to: baseOffset + to }
    : null;
};

const getChildrenRange = (
  children: readonly PresentationNode[],
): SourceRange | undefined => {
  const first = children[0];
  const last = children.at(-1);
  return first && last
    ? { from: first.range.from, to: last.range.to }
    : undefined;
};

const getNodeText = (node: MarkdownAstNode): string =>
  typeof node.value === "string"
    ? node.value
    : typeof node.alt === "string"
      ? node.alt
      : (node.children ?? []).map(getNodeText).join("");

const sliceRange = (
  source: string,
  range: SourceRange,
  baseOffset: number,
) => source.slice(range.from - baseOffset, range.to - baseOffset);

export const classifyPresentationLink = (
  target: string,
): PresentationLinkKind =>
  target.startsWith("#")
    ? "internal-heading"
    : externalLinkPattern.test(target)
      ? "external"
      : "internal-document";

const getMarkerRanges = (
  range: SourceRange,
  contentRange?: SourceRange,
): SourceRange[] => {
  if (!contentRange) return [];
  return [
    { from: range.from, to: contentRange.from },
    { from: contentRange.to, to: range.to },
  ].filter(({ from, to }) => to > from);
};

const getLinkMarkerRanges = (
  source: string,
  range: SourceRange,
  contentRange: SourceRange | undefined,
  baseOffset: number,
  target: string,
): SourceRange[] => {
  if (!contentRange || !target) return getMarkerRanges(range, contentRange);
  const sourceTargetFrom = source.indexOf(
    target,
    contentRange.to - baseOffset,
  );
  if (
    sourceTargetFrom < 0 ||
    sourceTargetFrom >= range.to - baseOffset
  ) {
    return getMarkerRanges(range, contentRange);
  }
  const targetRange = {
    from: sourceTargetFrom + baseOffset,
    to: sourceTargetFrom + baseOffset + target.length,
  };
  return [
    { from: range.from, to: contentRange.from },
    { from: contentRange.to, to: targetRange.from },
    targetRange,
    { from: targetRange.to, to: range.to },
  ].filter(({ from, to }) => to > from);
};

const getDelimitedContentRange = (
  source: string,
  range: SourceRange,
  baseOffset: number,
  marker: "`" | "$",
): SourceRange | undefined => {
  const value = sliceRange(source, range, baseOffset);
  const opening = value.match(
    marker === "`" ? /^`+/ : /^\$+/,
  )?.[0];
  if (!opening || !value.endsWith(opening) || value.length < opening.length * 2) {
    return undefined;
  }
  return {
    from: range.from + opening.length,
    to: range.to - opening.length,
  };
};

const createNode = ({
  children = [],
  contentRange,
  data,
  markerRanges,
  range,
  type,
}: {
  children?: readonly PresentationNode[];
  contentRange?: SourceRange;
  data?: PresentationNodeData;
  markerRanges?: readonly SourceRange[];
  range: SourceRange;
  type: PresentationInlineType;
}): PresentationNode => ({
  children,
  ...(contentRange ? { contentRange } : {}),
  ...(data ? { data } : {}),
  id: getNodeId(type, range),
  markerRanges: markerRanges ?? getMarkerRanges(range, contentRange),
  range,
  type,
});

const createBlock = ({
  children = [],
  contentRange,
  data,
  range,
  type,
}: {
  children?: readonly PresentationNode[];
  contentRange?: SourceRange;
  data?: PresentationNodeData;
  range: SourceRange;
  type: PresentationBlockType;
}): PresentationBlock => ({
  children,
  ...(contentRange ? { contentRange } : {}),
  ...(data ? { data } : {}),
  id: getNodeId(type, range),
  interaction: getBlockInteraction(type),
  markerRanges: [],
  placement: type === "footnote-definition"
    ? "document-end"
    : "source-position",
  range,
  type,
});

const mapInlineNode = (
  node: MarkdownAstNode,
  source: string,
  baseOffset: number,
  definitions: ReadonlyMap<string, PresentationReferenceDefinition>,
): PresentationNode | null => {
  const range = getNodeRange(node, baseOffset);
  if (!range) return null;
  const children = (node.children ?? [])
    .map((child) => mapInlineNode(child, source, baseOffset, definitions))
    .filter((child): child is PresentationNode => child !== null);
  const contentRange = getChildrenRange(children);
  const simpleTypeByAstType: Partial<Record<string, PresentationInlineType>> = {
    break: "line-break",
    delete: "strikethrough",
    emphasis: "emphasis",
    inlineCode: "inline-code",
    inlineMath: "inline-math",
    strong: "strong",
    text: "text",
  };
  const simpleType = simpleTypeByAstType[node.type];
  if (simpleType) {
    const delimitedContentRange = node.type === "inlineCode"
      ? getDelimitedContentRange(source, range, baseOffset, "`")
      : node.type === "inlineMath"
        ? getDelimitedContentRange(source, range, baseOffset, "$")
        : undefined;
    return createNode({
      children,
      contentRange: delimitedContentRange ?? contentRange,
      data: node.value === undefined ? undefined : { text: node.value },
      range,
      type: simpleType,
    });
  }

  if (node.type === "footnoteReference") {
    const value = sliceRange(source, range, baseOffset);
    const labelFrom = value.indexOf("^") + 1;
    const labelTo = value.lastIndexOf("]");
    return createNode({
      contentRange: labelFrom > 0 && labelTo >= labelFrom
        ? { from: range.from + labelFrom, to: range.from + labelTo }
        : undefined,
      data: {
        identifier: normalizeIdentifier(node.identifier ?? node.label ?? ""),
      },
      range,
      type: "footnote-reference",
    });
  }

  if (node.type === "link" || node.type === "linkReference") {
    const identifier = node.type === "linkReference"
      ? normalizeIdentifier(node.identifier ?? "")
      : undefined;
    const definition = identifier ? definitions.get(identifier) : undefined;
    const target = node.url ?? definition?.url ?? "";
    return createNode({
      children,
      contentRange,
      data: {
        ...(identifier ? { identifier } : {}),
        linkKind: classifyPresentationLink(target),
        text: getNodeText(node),
        title: node.title ?? definition?.title,
        url: target,
      },
      markerRanges: getLinkMarkerRanges(
        source,
        range,
        contentRange,
        baseOffset,
        node.type === "link" ? target : "",
      ),
      range,
      type: "link",
    });
  }

  if (node.type === "image" || node.type === "imageReference") {
    const identifier = node.type === "imageReference"
      ? normalizeIdentifier(node.identifier ?? "")
      : undefined;
    const definition = identifier ? definitions.get(identifier) : undefined;
    return createNode({
      data: {
        alt: node.alt ?? "",
        ...(identifier ? { identifier } : {}),
        title: node.title ?? definition?.title,
        url: node.url ?? definition?.url ?? "",
      },
      range,
      type: "image",
    });
  }

  return createNode({
    children,
    contentRange,
    data: { text: node.value ?? sliceRange(source, range, baseOffset) },
    range,
    type: node.type === "html" ? "html-inline" : "raw",
  });
};

const getFencedContentRange = (
  source: string,
  range: SourceRange,
  baseOffset: number,
) => {
  const blockSource = sliceRange(source, range, baseOffset);
  const firstBreak = blockSource.indexOf("\n");
  const lastBreak = blockSource.lastIndexOf("\n");
  return firstBreak === -1
    ? undefined
    : {
        from: range.from + firstBreak + 1,
        to: range.from + Math.max(firstBreak + 1, lastBreak),
      };
};

const parseCalloutBlock = (
  source: string,
  range: SourceRange,
  baseOffset: number,
) => {
  const lines = sliceRange(source, range, baseOffset)
    .split("\n")
    .map((line) => line.replace(/^ {0,3}>[ \t]?/, ""));
  const marker = /^\[!([A-Za-z-]+)\][ \t]*(.*)$/.exec(lines[0] ?? "");
  if (!marker) return null;
  const type = marker[1].toLowerCase();
  return {
    body: lines.slice(1).join("\n").trim(),
    title: marker[2].trim() || type,
    type,
  };
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

const mapBlockNode = (
  node: MarkdownAstNode,
  source: string,
  baseOffset: number,
  definitions: ReadonlyMap<string, PresentationReferenceDefinition>,
): PresentationBlock | null => {
  const range = getNodeRange(node, baseOffset);
  if (!range) return null;
  const inlineChildren = () => (node.children ?? [])
    .map((child) => mapInlineNode(child, source, baseOffset, definitions))
    .filter((child): child is PresentationNode => child !== null);
  const blockChildren = () => (node.children ?? [])
    .map((child) => mapBlockNode(child, source, baseOffset, definitions))
    .filter((child): child is PresentationBlock => child !== null);

  if (node.type === "paragraph" || node.type === "heading") {
    const children = inlineChildren();
    const image = node.type === "paragraph"
      && children.length === 1
      && children[0].type === "image"
      ? children[0]
      : null;
    if (image) {
      return createBlock({ data: image.data, range, type: "image" });
    }
    const depth = node.depth;
    return createBlock({
      children,
      contentRange: getChildrenRange(children),
      data: node.type === "heading"
        ? {
            ...(depth && depth >= 1 && depth <= 6
              ? { depth: depth as 1 | 2 | 3 | 4 | 5 | 6 }
              : {}),
            text: getNodeText(node),
          }
        : undefined,
      range,
      type: node.type,
    });
  }

  if (node.type === "list") {
    return createBlock({
      children: blockChildren(),
      data: { ordered: node.ordered ?? false, start: node.start },
      range,
      type: node.ordered ? "ordered-list" : "unordered-list",
    });
  }

  if (node.type === "code" || node.type === "math") {
    const language = node.lang?.trim().toLowerCase() ?? "";
    return createBlock({
      contentRange: getFencedContentRange(source, range, baseOffset),
      data: {
        ...(node.type === "code" ? { language } : {}),
        text: node.value ?? "",
      },
      range,
      type: node.type === "math"
        ? "display-math"
        : language === "mermaid"
          ? "diagram"
          : "code-block",
    });
  }

  if (node.type === "blockquote") {
    const callout = parseCalloutBlock(source, range, baseOffset);
    if (callout) {
      return createBlock({
        children: blockChildren(),
        data: {
          attributes: {
            title: callout.title,
            type: callout.type,
          },
          text: callout.body,
        },
        range,
        type: "callout",
      });
    }
  }

  const blockTypeByAstType: Partial<Record<string, PresentationBlockType>> = {
    blockquote: "blockquote",
    definition: "reference-definition",
    footnoteDefinition: "footnote-definition",
    html: "html",
    listItem: "list-item",
    table: "table",
    tableCell: "table-cell",
    tableRow: "table-row",
    thematicBreak: "thematic-break",
  };
  const type = blockTypeByAstType[node.type] ?? "raw";
  const children = type === "table-cell" ? inlineChildren() : blockChildren();
  return createBlock({
    children,
    contentRange: type === "table-cell" ? getChildrenRange(children) : undefined,
    data: {
      ...(node.align ? { alignments: node.align } : {}),
      ...(node.checked !== undefined ? { checked: node.checked } : {}),
      ...(node.identifier
        ? { identifier: normalizeIdentifier(node.identifier) }
        : {}),
      ...(node.title !== undefined ? { title: node.title } : {}),
      ...(node.url !== undefined ? { url: node.url } : {}),
      ...(node.value !== undefined ? { text: node.value } : {}),
    },
    range,
    type,
  });
};

const parseAttributes = (source: string) => {
  const attributes: Record<string, string> = {};
  const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const match of source.matchAll(pattern)) {
    attributes[match[1]] = match[2] ?? match[3] ?? "";
  }
  return attributes;
};

const parseAstBlocks = (
  source: string,
  baseOffset: number,
  definitions: ReadonlyMap<string, PresentationReferenceDefinition>,
) => {
  const tree = fromMarkdown(source, parserOptions) as MarkdownAstNode;
  return (tree.children ?? [])
    .map((node) => mapBlockNode(node, source, baseOffset, definitions))
    .filter((block): block is PresentationBlock => block !== null);
};

type PresentationComponentName = "Accordion" | "Callout" | "Tab" | "Tabs";

type PresentationComponentSource = {
  attributes: Readonly<Record<string, string>>;
  children: PresentationComponentSource[];
  closeFrom: number;
  from: number;
  name: PresentationComponentName;
  openTo: number;
  to: number;
};

type OpenPresentationComponent = Omit<
  PresentationComponentSource,
  "closeFrom" | "to"
>;

const presentationComponentNames = new Set<PresentationComponentName>([
  "Accordion",
  "Callout",
  "Tab",
  "Tabs",
]);

const findComponentTagEnd = (source: string, from: number) => {
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

const isComponentFlowTag = (source: string, position: number) => {
  const lineStart = source.lastIndexOf("\n", position - 1) + 1;
  return /^ {0,3}$/.test(source.slice(lineStart, position));
};

const getComponentSources = (
  source: string,
  baseOffset: number,
  astBlocks: readonly PresentationBlock[],
) => {
  const codeRanges = astBlocks
    .filter((block) =>
      block.type === "code-block" || block.type === "diagram")
    .map((block) => ({
      from: block.range.from - baseOffset,
      to: block.range.to - baseOffset,
    }));
  const isInCode = (position: number) => codeRanges.some((range) =>
    position >= range.from && position < range.to);
  const roots: PresentationComponentSource[] = [];
  const stack: OpenPresentationComponent[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const from = source.indexOf("<", cursor);
    if (from < 0) break;
    cursor = from + 1;
    if (isInCode(from)) continue;

    const to = findComponentTagEnd(source, cursor);
    if (to === null) break;
    const rawTag = source.slice(from + 1, to - 1);
    const match =
      /^\s*(\/?)\s*([A-Za-z][\w.-]*)([\s\S]*?)\s*(\/?)\s*$/.exec(rawTag);
    if (
      !match ||
      !presentationComponentNames.has(match[2] as PresentationComponentName)
    ) {
      cursor = to;
      continue;
    }

    const closing = match[1] === "/";
    const selfClosing = match[4] === "/";
    const name = match[2] as PresentationComponentName;
    if (!closing && !isComponentFlowTag(source, from)) {
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
      const component: PresentationComponentSource = {
        ...open,
        closeFrom: baseOffset + from,
        to: baseOffset + to,
      };
      const parent = stack.at(-1);
      if (parent) parent.children.push(component);
      else roots.push(component);
    } else if (!selfClosing) {
      stack.push({
        attributes: parseAttributes(match[3]),
        children: [],
        from: baseOffset + from,
        name,
        openTo: baseOffset + to,
      });
    }
    cursor = to;
  }

  return roots.filter((component) => component.name !== "Tab");
};

const createComponentBlock = (
  source: string,
  component: PresentationComponentSource,
  definitions: ReadonlyMap<string, PresentationReferenceDefinition>,
): PresentationBlock | null => {
  if (component.name === "Tab") return null;
  const type = component.name.toLowerCase() as
    | "accordion"
    | "callout"
    | "tabs";
  const innerFrom = component.openTo;
  const innerTo = component.closeFrom;
  let children: PresentationBlock[];

  if (type === "tabs") {
    children = component.children
      .filter((child) => child.name === "Tab")
      .map((tab) => {
      const contentFrom = tab.openTo;
      const contentTo = tab.closeFrom;
      return createBlock({
        children: parseAstBlocks(
          source.slice(contentFrom, contentTo),
          contentFrom,
          definitions,
        ),
        contentRange: { from: contentFrom, to: contentTo },
        data: { attributes: tab.attributes },
        range: { from: tab.from, to: tab.to },
        type: "tab",
      });
    });
  } else {
    children = parseAstBlocks(
      source.slice(innerFrom, innerTo),
      innerFrom,
      definitions,
    );
  }

  return createBlock({
    children,
    contentRange: { from: innerFrom, to: innerTo },
    data: { attributes: component.attributes },
    range: { from: component.from, to: component.to },
    type,
  });
};

const createBlankLineBlocks = (
  source: string,
  baseOffset: number,
  representedBlocks: readonly PresentationBlock[],
) => {
  const blanks: PresentationBlock[] = [];
  let lineStart = 0;
  while (lineStart < source.length) {
    const lineBreak = source.indexOf("\n", lineStart);
    const lineEnd = lineBreak === -1 ? source.length : lineBreak;
    const range = {
      from: baseOffset + lineStart,
      to: baseOffset + (lineBreak === -1 ? lineEnd : lineEnd + 1),
    };
    if (
      source.slice(lineStart, lineEnd).trim().length === 0
      && range.to > range.from
      && !representedBlocks.some((block) =>
        range.from >= block.range.from && range.to <= block.range.to)
    ) {
      blanks.push(createBlock({ range, type: "blank-line" }));
    }
    if (lineBreak === -1) break;
    lineStart = lineBreak + 1;
  }
  return blanks;
};

const visitAst = (
  node: MarkdownAstNode,
  visitor: (node: MarkdownAstNode) => void,
) => {
  visitor(node);
  for (const child of node.children ?? []) visitAst(child, visitor);
};

const collectReferenceIndex = (
  tree: MarkdownAstNode,
  source: string,
  baseOffset: number,
): ReferenceIndex => {
  const definitions: PresentationReferenceDefinition[] = [];
  const definitionsByIdentifier = new Map<string, PresentationReferenceDefinition>();
  visitAst(tree, (node) => {
    if (node.type !== "definition") return;
    const range = getNodeRange(node, baseOffset);
    if (!range) return;
    const definition = {
      identifier: normalizeIdentifier(node.identifier ?? ""),
      range,
      title: node.title,
      url: node.url ?? "",
    };
    definitions.push(definition);
    if (!definitionsByIdentifier.has(definition.identifier)) {
      definitionsByIdentifier.set(definition.identifier, definition);
    }
  });

  const links: PresentationLinkReference[] = [];
  const footnotesByIdentifier = new Map<string, PresentationFootnote>();
  const addFootnoteReference = (identifier: string, range: SourceRange) => {
    const existing = footnotesByIdentifier.get(identifier);
    footnotesByIdentifier.set(identifier, existing
      ? {
          ...existing,
          references: [
            ...existing.references,
            { occurrence: existing.references.length + 1, range },
          ],
        }
      : {
          identifier,
          index: footnotesByIdentifier.size + 1,
          references: [{ occurrence: 1, range }],
          status: "missing",
        });
  };

  visitAst(tree, (node) => {
    const range = getNodeRange(node, baseOffset);
    if (!range) return;
    if (node.type === "link" || node.type === "linkReference") {
      const definitionIdentifier = node.type === "linkReference"
        ? normalizeIdentifier(node.identifier ?? "")
        : undefined;
      const target = node.url
        ?? (definitionIdentifier
          ? definitionsByIdentifier.get(definitionIdentifier)?.url
          : undefined)
        ?? "";
      links.push({
        ...(definitionIdentifier ? { definitionIdentifier } : {}),
        kind: classifyPresentationLink(target),
        label: getNodeText(node),
        range,
        target,
      });
    } else if (node.type === "footnoteReference") {
      addFootnoteReference(
        normalizeIdentifier(node.identifier ?? node.label ?? ""),
        range,
      );
    } else if (node.type === "text") {
      const text = sliceRange(source, range, baseOffset);
      for (const match of text.matchAll(/(?<!\\)\[\^([^\]\n]+)](?!:)/g)) {
        const from = range.from + (match.index ?? 0);
        addFootnoteReference(normalizeIdentifier(match[1]), {
          from,
          to: from + match[0].length,
        });
      }
    }
  });

  visitAst(tree, (node) => {
    const range = getNodeRange(node, baseOffset);
    if (!range) return;
    if (node.type === "footnoteDefinition") {
      const identifier = normalizeIdentifier(node.identifier ?? node.label ?? "");
      const existing = footnotesByIdentifier.get(identifier);
      footnotesByIdentifier.set(identifier, existing
        ? {
            ...existing,
            definitionBody: readFootnoteDefinitionBody(
              sliceRange(source, range, baseOffset),
            ),
            definitionRange: range,
            status: "resolved",
          }
        : {
            definitionBody: readFootnoteDefinitionBody(
              sliceRange(source, range, baseOffset),
            ),
            definitionRange: range,
            identifier,
            index: footnotesByIdentifier.size + 1,
            references: [],
            status: "unused",
          });
    }
  });

  return {
    definitions,
    footnotes: [...footnotesByIdentifier.values()],
    links,
  };
};

export const createMarkdownPresentationDocument = (
  source: string,
): MarkdownPresentationDocument => {
  const frontmatter = inspectFrontmatterData(source);
  const bodyOffset = frontmatter.status === "valid" ? frontmatter.bodyOffset : 0;
  const body = bodyOffset > 0 ? frontmatter.body : source;
  const tree = fromMarkdown(body, parserOptions) as MarkdownAstNode;
  const references = collectReferenceIndex(tree, body, bodyOffset);
  const definitions = new Map(
    references.definitions.map((definition) => [
      definition.identifier,
      definition,
    ]),
  );
  const astBlocks = (tree.children ?? [])
    .map((node) => mapBlockNode(node, body, bodyOffset, definitions))
    .filter((block): block is PresentationBlock => block !== null);
  const componentBlocks = getComponentSources(body, bodyOffset, astBlocks)
    .map((component) => createComponentBlock(
      source,
      component,
      definitions,
    ))
    .filter((block): block is PresentationBlock => block !== null);
  const componentRanges = componentBlocks.map((block) => block.range);
  const regularBlocks = astBlocks.filter((block) =>
    !componentRanges.some((range) =>
      block.range.from < range.to && block.range.to > range.from));
  const blankBlocks = createBlankLineBlocks(
    body,
    bodyOffset,
    [...regularBlocks, ...componentBlocks],
  );
  const bodyBlocks = [...regularBlocks, ...componentBlocks, ...blankBlocks]
    .sort((left, right) =>
      left.range.from - right.range.from || left.range.to - right.range.to);
  const blocks = bodyOffset === 0
    ? bodyBlocks
    : [
        createBlock({
          data: {
            attributes: Object.fromEntries(
              parseFrontmatter(source).attributes.map(({ key, value }) => [
                key,
                value,
              ]),
            ),
          },
          range: { from: 0, to: bodyOffset },
          type: "frontmatter",
        }),
        ...bodyBlocks,
      ];

  return { blocks, references, source };
};

export type {
  BlockInteractionPolicy,
  MarkdownPresentationDocument,
  PresentationBlock,
  PresentationBlockType,
  PresentationFootnote,
  PresentationFootnoteStatus,
  PresentationInlineType,
  PresentationLinkKind,
  PresentationLinkReference,
  PresentationNode,
  PresentationNodeData,
  PresentationNodeType,
  PresentationPlacement,
  PresentationReferenceDefinition,
  ReferenceIndex,
  SourceRange,
} from "./presentationModel";
