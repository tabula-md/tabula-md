import { describe, expect, it } from "vitest";
import { BoundedStringCache } from "./previewRenderCache";

describe("BoundedStringCache", () => {
  it("evicts least-recently-used entries by count", () => {
    const cache = new BoundedStringCache({ maxBytes: 1024, maxEntries: 2, maxEntryBytes: 512 });
    cache.write("first", "1");
    cache.write("second", "2");
    cache.read("first");
    cache.write("third", "3");
    expect(cache.read("second")).toBeUndefined();
    expect(cache.read("first")).toBe("1");
  });

  it("stays within its byte budget and skips oversized entries", () => {
    const cache = new BoundedStringCache({ maxBytes: 24, maxEntries: 10, maxEntryBytes: 16 });
    cache.write("a", "1234567890");
    cache.write("b", "1234567890");
    cache.write("oversized", "12345678901234567890");
    expect(cache.byteLength).toBeLessThanOrEqual(24);
    expect(cache.read("oversized")).toBeUndefined();
  });
});
