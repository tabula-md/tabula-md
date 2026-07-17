import { memo, useLayoutEffect, useMemo, useRef } from "react";
import ReactMarkdown, { type Components, type Options as ReactMarkdownOptions } from "react-markdown";
import {
  getPreviewWindow,
  type PreviewBlock,
  type PreviewBlockIndex,
} from "@tabula-md/tabula";
import type { PreviewViewport } from "./usePreviewFollowController";
import {
  getPreviewBlockGlobalDefinitions,
  getPreviewFootnoteDefinitions,
  type PreviewGlobalMarkdownContext,
} from "./previewGlobalMarkdownContext";

type MarkdownRehypePlugins = ReactMarkdownOptions["rehypePlugins"];
type MarkdownRemarkPlugins = ReactMarkdownOptions["remarkPlugins"];
type MarkdownUrlTransform = ReactMarkdownOptions["urlTransform"];

export type VirtualPreviewCommentAnchor = {
  id: string;
  start: number;
  end: number;
};

export type GetVirtualPreviewBlockRehypePlugins = (
  block: PreviewBlock,
  blockCommentAnchors: VirtualPreviewCommentAnchor[],
) => MarkdownRehypePlugins;

const EMPTY_VIRTUAL_PREVIEW_COMMENT_ANCHORS: VirtualPreviewCommentAnchor[] = [];
const PREVIEW_BLOCK_FLOW_MARGIN = {
  blockquote: { bottom: 18, top: 18 },
  fence: { bottom: 18, top: 18 },
  heading: {
    1: { bottom: 16, top: 0 },
    2: { bottom: 12, top: 24 },
    3: { bottom: 10, top: 20 },
    4: { bottom: 8, top: 18 },
    5: { bottom: 7, top: 16 },
    6: { bottom: 7, top: 14 },
  },
  html: { bottom: 18, top: 18 },
  list: { bottom: 18, top: 0 },
  paragraph: { bottom: 17, top: 0 },
  table: { bottom: 18, top: 18 },
  thematic: { bottom: 28, top: 28 },
} as const;

const getPreviewBlockFlowMargin = (block: PreviewBlock) => {
  if (block.kind === "heading") {
    return PREVIEW_BLOCK_FLOW_MARGIN.heading[block.headingLevel ?? 3];
  }

  if (block.kind === "blank") {
    return { bottom: 0, top: 0 };
  }

  return PREVIEW_BLOCK_FLOW_MARGIN[block.kind];
};

const getNextVisiblePreviewBlock = (blocks: readonly PreviewBlock[], blockIndex: number) => {
  for (let index = blockIndex + 1; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.kind !== "blank") {
      return block;
    }
  }

  return null;
};

const getPreviewBlockAfterGap = (
  block: PreviewBlock,
  blocks: readonly PreviewBlock[],
  blockIndex: number,
) => {
  if (block.kind === "blank") {
    return 0;
  }

  const currentMargin = getPreviewBlockFlowMargin(block);
  const nextVisibleBlock = getNextVisiblePreviewBlock(blocks, blockIndex);
  if (!nextVisibleBlock) {
    return currentMargin.bottom;
  }

  const nextMargin = getPreviewBlockFlowMargin(nextVisibleBlock);
  return Math.max(currentMargin.bottom, nextMargin.top);
};

const getBlockCommentAnchors = (
  block: PreviewBlock,
  commentAnchors: VirtualPreviewCommentAnchor[],
) =>
  commentAnchors
    .filter((anchor) => anchor.start < block.endOffset && anchor.end > block.startOffset)
    .map((anchor) => ({
      id: anchor.id,
      start: Math.max(0, anchor.start - block.startOffset),
      end: Math.min(block.endOffset - block.startOffset, anchor.end - block.startOffset),
    }))
    .filter((anchor) => anchor.end > anchor.start);

const VirtualPreviewBlock = memo(function VirtualPreviewBlock({
  block,
  commentsEnabled,
  components,
  commentAnchors,
  globalMarkdownContext,
  getBlockRehypePlugins,
  sourceLineOffset,
  afterGap,
  onBlockHeightChange,
  remarkPlugins,
  urlTransform,
}: {
  block: PreviewBlock;
  commentsEnabled: boolean;
  components: Components;
  commentAnchors: VirtualPreviewCommentAnchor[];
  globalMarkdownContext: PreviewGlobalMarkdownContext;
  getBlockRehypePlugins: GetVirtualPreviewBlockRehypePlugins;
  sourceLineOffset: number;
  afterGap: number;
  onBlockHeightChange: (block: PreviewBlock, height: number) => void;
  remarkPlugins: MarkdownRemarkPlugins;
  urlTransform: MarkdownUrlTransform;
}) {
  const blockRef = useRef<HTMLDivElement | null>(null);
  const blockCommentAnchors = useMemo(
    () => (commentsEnabled ? getBlockCommentAnchors(block, commentAnchors) : EMPTY_VIRTUAL_PREVIEW_COMMENT_ANCHORS),
    [block, commentAnchors, commentsEnabled],
  );
  const blockRehypePlugins = useMemo(
    () => getBlockRehypePlugins(block, blockCommentAnchors),
    [block, blockCommentAnchors, getBlockRehypePlugins],
  );
  const blockMarkdown = useMemo(() => {
    const globalDefinitions = getPreviewBlockGlobalDefinitions(block.text, globalMarkdownContext);
    return globalDefinitions ? `${block.text}\n\n${globalDefinitions}` : block.text;
  }, [block.text, globalMarkdownContext]);

  useLayoutEffect(() => {
    const element = blockRef.current;
    if (!element) {
      return undefined;
    }

    let frameId: number | null = null;
    const reportHeight = () => {
      frameId = null;
      const height = Math.ceil(element.getBoundingClientRect().height);
      onBlockHeightChange(block, Math.max(0, height));
    };
    const scheduleReport = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(reportHeight);
    };

    scheduleReport();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleReport);
    resizeObserver?.observe(element);

    return () => {
      resizeObserver?.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [block, onBlockHeightChange]);

  return (
    <div
      ref={blockRef}
      className="preview-virtual-block"
      data-preview-virtual-block="true"
      data-preview-block-kind={block.kind}
      data-preview-block-id={block.id}
      data-preview-block-start-line={block.startLine + sourceLineOffset}
      data-preview-block-end-line={block.endLine + sourceLineOffset}
      data-preview-block-after-gap={afterGap}
      style={{ paddingBottom: afterGap }}
    >
      <ReactMarkdown
        components={components}
        rehypePlugins={blockRehypePlugins}
        remarkPlugins={remarkPlugins}
        urlTransform={urlTransform}
      >
        {blockMarkdown}
      </ReactMarkdown>
    </div>
  );
});

function VirtualPreviewFootnotes({
  components,
  footnoteDefinitions,
  footnoteReferences,
  rehypePlugins,
  remarkPlugins,
  urlTransform,
}: {
  components: Components;
  footnoteDefinitions: string;
  footnoteReferences: string;
  rehypePlugins: MarkdownRehypePlugins;
  remarkPlugins: MarkdownRemarkPlugins;
  urlTransform: MarkdownUrlTransform;
}) {
  if (!footnoteDefinitions || !footnoteReferences) {
    return null;
  }

  return (
    <div className="preview-footnote-collector">
      <ReactMarkdown
        components={components}
        rehypePlugins={rehypePlugins}
        remarkPlugins={remarkPlugins}
        urlTransform={urlTransform}
      >
        {`${footnoteReferences}\n\n${footnoteDefinitions}`}
      </ReactMarkdown>
    </div>
  );
}

export function VirtualMarkdownPreview({
  blockIndex,
  commentsEnabled,
  components,
  commentAnchors,
  globalMarkdownContext,
  getBlockRehypePlugins,
  getFootnoteRehypePlugins,
  onBlockHeightChange,
  overscan,
  remarkPlugins,
  sourceLineOffset = 0,
  viewport,
  urlTransform,
}: {
  blockIndex: PreviewBlockIndex;
  commentsEnabled: boolean;
  components: Components;
  commentAnchors: VirtualPreviewCommentAnchor[];
  globalMarkdownContext: PreviewGlobalMarkdownContext;
  getBlockRehypePlugins: GetVirtualPreviewBlockRehypePlugins;
  getFootnoteRehypePlugins: () => MarkdownRehypePlugins;
  onBlockHeightChange: (block: PreviewBlock, height: number) => void;
  overscan: number;
  remarkPlugins: MarkdownRemarkPlugins;
  sourceLineOffset?: number;
  viewport: PreviewViewport;
  urlTransform: MarkdownUrlTransform;
}) {
  const previewWindow = useMemo(
    () => getPreviewWindow(blockIndex, viewport.scrollTop, viewport.viewportHeight, overscan),
    [blockIndex, overscan, viewport.scrollTop, viewport.viewportHeight],
  );
  const firstBlock = previewWindow.blocks[0] ?? null;
  const lastBlock = previewWindow.blocks[previewWindow.blocks.length - 1] ?? null;
  const topSpacerHeight = firstBlock?.estimatedTop ?? 0;
  const bottomSpacerHeight = lastBlock
    ? Math.max(0, blockIndex.totalEstimatedHeight - (lastBlock.estimatedTop + lastBlock.estimatedHeight))
    : 0;
  const footnoteDefinitions = useMemo(
    () => getPreviewFootnoteDefinitions(globalMarkdownContext),
    [globalMarkdownContext],
  );

  return (
    <div
      className="preview-virtual-content"
      data-preview-virtual-content="true"
      style={{ minHeight: blockIndex.totalEstimatedHeight }}
    >
      {topSpacerHeight > 0 && <div aria-hidden="true" className="preview-virtual-spacer" style={{ height: topSpacerHeight }} />}
      {previewWindow.blocks.map((block, visibleBlockIndex) =>
        block.kind === "blank" ? null : (
          <VirtualPreviewBlock
            key={block.id}
            block={block}
            commentsEnabled={commentsEnabled}
            components={components}
            commentAnchors={commentAnchors}
            globalMarkdownContext={globalMarkdownContext}
            getBlockRehypePlugins={getBlockRehypePlugins}
            sourceLineOffset={sourceLineOffset}
            afterGap={getPreviewBlockAfterGap(block, blockIndex.blocks, previewWindow.startIndex + visibleBlockIndex)}
            onBlockHeightChange={onBlockHeightChange}
            remarkPlugins={remarkPlugins}
            urlTransform={urlTransform}
          />
        ),
      )}
      {bottomSpacerHeight > 0 && <div aria-hidden="true" className="preview-virtual-spacer" style={{ height: bottomSpacerHeight }} />}
      <VirtualPreviewFootnotes
        components={components}
        footnoteDefinitions={footnoteDefinitions}
        footnoteReferences={globalMarkdownContext.footnoteReferences}
        rehypePlugins={getFootnoteRehypePlugins()}
        remarkPlugins={remarkPlugins}
        urlTransform={urlTransform}
      />
    </div>
  );
}
