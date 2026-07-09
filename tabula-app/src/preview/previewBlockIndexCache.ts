import type { PreviewBlock, PreviewBlockIndex } from "@tabula-md/tabula";

export type PreviewBlockCache = Map<string, PreviewBlock>;

const hashString = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
};

export const createPreviewBlockCacheKey = (block: PreviewBlock) =>
  [
    block.id,
    block.kind,
    block.startLine,
    block.endLine,
    block.startOffset,
    block.endOffset,
    block.estimatedHeight,
    block.text.length,
    hashString(block.text),
  ].join(":");

export const reusePreviewBlockIndex = (
  blockIndex: PreviewBlockIndex,
  cache: PreviewBlockCache,
): PreviewBlockIndex => {
  const nextKeys = new Set<string>();
  const blocks = blockIndex.blocks.map((block) => {
    const cacheKey = createPreviewBlockCacheKey(block);
    nextKeys.add(cacheKey);
    const cachedBlock = cache.get(cacheKey);
    if (cachedBlock) {
      return cachedBlock;
    }

    cache.set(cacheKey, block);
    return block;
  });

  for (const cacheKey of cache.keys()) {
    if (!nextKeys.has(cacheKey)) {
      cache.delete(cacheKey);
    }
  }

  return {
    ...blockIndex,
    blocks,
  };
};
