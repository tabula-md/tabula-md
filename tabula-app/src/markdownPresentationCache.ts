import {
  createMarkdownPresentationDocument,
  type MarkdownPresentationDocument,
  type PresentationBlock,
  type PresentationLinkReference,
  type PresentationNode,
  type SourceRange,
} from "@tabula-md/tabula";

let cachedSource: string | null = null;
let cachedPresentation: MarkdownPresentationDocument | null = null;

export type MarkdownPresentationChange = {
  fromA: number;
  fromB: number;
  toA: number;
  toB: number;
};

const shiftRange = (
  range: SourceRange,
  offset: number,
): SourceRange => offset === 0
  ? range
  : {
      from: range.from + offset,
      to: range.to + offset,
    };

const shiftPresentationNode = <TNode extends PresentationNode>(
  node: TNode,
  offset: number,
): TNode => {
  if (offset === 0) return node;
  const range = shiftRange(node.range, offset);
  return {
    ...node,
    children: node.children.map((child) =>
      shiftPresentationNode(child, offset)),
    contentRange: node.contentRange
      ? shiftRange(node.contentRange, offset)
      : undefined,
    id: `${node.type}:${range.from}:${range.to}`,
    markerRanges: node.markerRanges.map((markerRange) =>
      shiftRange(markerRange, offset)),
    range,
  } as TNode;
};

const shiftPresentationLink = (
  link: PresentationLinkReference,
  offset: number,
): PresentationLinkReference => offset === 0
  ? link
  : {
      ...link,
      range: shiftRange(link.range, offset),
    };

const cachePresentation = (
  source: string,
  presentation: MarkdownPresentationDocument,
) => {
  cachedSource = source;
  cachedPresentation = presentation;
  return presentation;
};

// Visual and Preview usually request the same current document in sequence.
// One entry removes that duplicate parse without retaining a workspace-sized cache.
export const getMarkdownPresentationDocument = (
  source: string,
): MarkdownPresentationDocument => {
  if (cachedPresentation && cachedSource === source) {
    return cachedPresentation;
  }

  return cachePresentation(
    source,
    createMarkdownPresentationDocument(source),
  );
};

const getLocallyEditableBlock = (
  presentation: MarkdownPresentationDocument,
  change: MarkdownPresentationChange,
) => presentation.blocks.find((block) =>
  block.type === "paragraph" &&
  change.fromA >= block.range.from &&
  change.toA <= block.range.to);

const getIncrementalPresentation = (
  previous: MarkdownPresentationDocument,
  source: string,
  change: MarkdownPresentationChange,
): MarkdownPresentationDocument | null => {
  const removedSource = previous.source.slice(change.fromA, change.toA);
  const insertedSource = source.slice(change.fromB, change.toB);
  if (
    removedSource.includes("\n") ||
    removedSource.includes("\r") ||
    insertedSource.includes("\n") ||
    insertedSource.includes("\r") ||
    previous.references.definitions.length > 0 ||
    previous.references.footnotes.length > 0
  ) {
    return null;
  }

  const changedBlock = getLocallyEditableBlock(previous, change);
  if (!changedBlock) return null;

  const delta = source.length - previous.source.length;
  const nextBlockTo = changedBlock.range.to + delta;
  if (
    nextBlockTo < changedBlock.range.from ||
    change.fromB < changedBlock.range.from ||
    change.toB > nextBlockTo
  ) {
    return null;
  }

  const fragmentSource = source.slice(changedBlock.range.from, nextBlockTo);
  const fragment = createMarkdownPresentationDocument(fragmentSource);
  if (
    fragment.blocks.length !== 1 ||
    fragment.blocks[0]?.type === "blank-line" ||
    fragment.references.definitions.length > 0 ||
    fragment.references.footnotes.length > 0
  ) {
    return null;
  }

  const changedBlocks = fragment.blocks.map((block) =>
    shiftPresentationNode(block, changedBlock.range.from));
  const blocks: PresentationBlock[] = [
    ...previous.blocks.filter((block) =>
      block.range.to <= changedBlock.range.from),
    ...changedBlocks,
    ...previous.blocks
      .filter((block) => block.range.from >= changedBlock.range.to)
      .map((block) => shiftPresentationNode(block, delta)),
  ];
  const links = [
    ...previous.references.links.filter((link) =>
      link.range.to <= changedBlock.range.from),
    ...fragment.references.links.map((link) =>
      shiftPresentationLink(link, changedBlock.range.from)),
    ...previous.references.links
      .filter((link) => link.range.from >= changedBlock.range.to)
      .map((link) => shiftPresentationLink(link, delta)),
  ];

  return {
    blocks,
    references: {
      definitions: [],
      footnotes: [],
      links,
    },
    source,
  };
};

export const updateMarkdownPresentationDocument = (
  previous: MarkdownPresentationDocument,
  source: string,
  change: MarkdownPresentationChange | null,
): MarkdownPresentationDocument => {
  if (previous.source === source) {
    return cachePresentation(source, previous);
  }
  const incremental = change
    ? getIncrementalPresentation(previous, source, change)
    : null;
  return cachePresentation(
    source,
    incremental ?? createMarkdownPresentationDocument(source),
  );
};
