import { describe, expect, it } from "vitest";
import { Utf8TextSizeTracker } from "./utf8TextSizeTracker";

const byteLength = (text: string) => new TextEncoder().encode(text).byteLength;

describe("Utf8TextSizeTracker", () => {
  it("tracks small inserts and deletes without re-encoding retained text", () => {
    const original = `${"a".repeat(10_000)}끝`;
    const tracker = new Utf8TextSizeTracker(original);
    tracker.applyDelta([{ retain: 5_000 }, { delete: 2 }, { insert: "한글" }]);
    const next = `${original.slice(0, 5_000)}한글${original.slice(5_002)}`;
    expect(tracker.byteLength).toBe(byteLength(next));
  });

  it("tracks repeated non-ASCII typing", () => {
    const tracker = new Utf8TextSizeTracker("");
    let text = "";
    for (const character of ["가", "나", "다", " ", "A"]) {
      tracker.applyDelta([{ retain: text.length }, { insert: character }]);
      text += character;
      expect(tracker.byteLength).toBe(byteLength(text));
    }
  });
});
