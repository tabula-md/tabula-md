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
const componentOpeningPattern = /^ {0,3}<(Accordion|Callout|Tabs)\b([^>]*)>/;
const componentBlockPattern =
  /^ {0,3}<(Accordion|Callout|Tabs)\b[^>]*>[\s\S]*?^ {0,3}<\/\1>[ \t]*$/gm;
const tabPattern = /<Tab\b([^>]*)>([\s\S]*?)<\/Tab>/g;

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

const createComponentBlock = (
  source: string,
  range: SourceRange,
  definitions: ReadonlyMap<string, PresentationReferenceDefinition>,
): PresentationBlock | null => {
  const componentSource = source.slice(range.from, range.to);
  const opening = componentOpeningPattern.exec(componentSource);
  if (!opening) return null;
  const type = opening[1].toLowerCase() as "accordion" | "callout" | "tabs";
  const attributes = parseAttributes(opening[2]);
  const closeFrom = componentSource.lastIndexOf(`</${opening[1]}>`);
  const innerFrom = range.from + opening[0].length;
  const innerTo = closeFrom === -1 ? range.to : range.from + closeFrom;
  let children: PresentationBlock[];

  if (type === "tabs") {
    children = [...componentSource.matchAll(tabPattern)].map((match) => {
      const matchFrom = range.from + (match.index ?? 0);
      const openLength = match[0].indexOf(">") + 1;
      const contentFrom = matchFrom + openLength;
      const contentTo = contentFrom + match[2].length;
      return createBlock({
        children: parseAstBlocks(match[2], contentFrom, definitions),
        contentRange: { from: contentFrom, to: contentTo },
        data: { attributes: parseAttributes(match[1]) },
        range: { from: matchFrom, to: matchFrom + match[0].length },
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
    data: { attributes },
    range,
    type,
  });
};

const getComponentRanges = (
  source: string,
  baseOffset: number,
  astBlocks: readonly PresentationBlock[],
) => [...source.matchAll(componentBlockPattern)]
  .map((match) => ({
    from: baseOffset + (match.index ?? 0),
    to: baseOffset + (match.index ?? 0) + match[0].length,
  }))
  .filter((range) =>
    !astBlocks.some((block) =>
      (block.type === "code-block" || block.type === "diagram")
      && range.from >= block.range.from
      && range.to <= block.range.to));

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
      ? { ...existing, references: [...existing.references, { range }] }
      : {
          identifier,
          index: footnotesByIdentifier.size + 1,
          references: [{ range }],
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
    } else if (node.type === "footnoteDefinition") {
      const identifier = normalizeIdentifier(node.identifier ?? node.label ?? "");
      const existing = footnotesByIdentifier.get(identifier);
      footnotesByIdentifier.set(identifier, existing
        ? { ...existing, definitionRange: range }
        : {
            definitionRange: range,
            identifier,
            index: footnotesByIdentifier.size + 1,
            references: [],
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
  const componentBlocks = getComponentRanges(body, bodyOffset, astBlocks)
    .map((range) => createComponentBlock(
      source,
      range,
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
