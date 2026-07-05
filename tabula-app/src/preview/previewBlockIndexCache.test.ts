import { describe, expect, it } from "vitest";
import { createPreviewBlockIndex } from "@tabula-md/tabula";
import { reusePreviewBlockIndex, type PreviewBlockCache } from "./previewBlockIndexCache";

describe("preview block index cache", () => {
  it("reuses unchanged preview block objects across worker responses", () => {
    const cache: PreviewBlockCache = new Map();
    const firstIndex = createPreviewBlockIndex(["# Title", "", "Paragraph"].join("\n"));
    const firstCachedIndex = reusePreviewBlockIndex(firstIndex, cache);
    const secondCachedIndex = reusePreviewBlockIndex(createPreviewBlockIndex(["# Title", "", "Paragraph"].join("\n")), cache);

    expect(secondCachedIndex.blocks[0]).toBe(firstCachedIndex.blocks[0]);
    expect(secondCachedIndex.blocks[1]).toBe(firstCachedIndex.blocks[1]);
    expect(secondCachedIndex.blocks[2]).toBe(firstCachedIndex.blocks[2]);
  });

  it("does not reuse changed preview block objects", () => {
    const cache: PreviewBlockCache = new Map();
    const firstCachedIndex = reusePreviewBlockIndex(createPreviewBlockIndex("Paragraph"), cache);
    const secondCachedIndex = reusePreviewBlockIndex(createPreviewBlockIndex("Paragraph changed"), cache);

    expect(secondCachedIndex.blocks[0]).not.toBe(firstCachedIndex.blocks[0]);
  });

  it("prunes cache entries that are no longer in the block index", () => {
    const cache: PreviewBlockCache = new Map();
    reusePreviewBlockIndex(createPreviewBlockIndex(["# Title", "", "Paragraph"].join("\n")), cache);
    expect(cache.size).toBeGreaterThan(1);

    reusePreviewBlockIndex(createPreviewBlockIndex("# Title"), cache);

    expect(cache.size).toBe(1);
  });
});
