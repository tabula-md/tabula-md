import { describe, expect, it } from "vitest";
import {
  getSearchMatches,
  replaceAllSearchMatches,
  replaceCurrentSearchMatch,
} from "./markdown";

describe("markdown search and replace", () => {
  it("finds matches case-insensitively", () => {
    expect(getSearchMatches("Alpha beta alpha", "alpha")).toEqual([
      { start: 0, end: 5, preview: "Alpha beta alpha" },
      { start: 11, end: 16, preview: "Alpha beta alpha" },
    ]);
  });

  it("does not search empty queries", () => {
    expect(getSearchMatches("Alpha", " ")).toEqual([]);
  });

  it("replaces the active match", () => {
    expect(replaceCurrentSearchMatch("one two one", "one", "three", 1)).toEqual({
      text: "one two three",
      patches: [{ from: 8, to: 11, insert: "three" }],
      selection: { from: 8, to: 13 },
      replacedCount: 1,
    });
  });

  it("clamps the active match index when replacing current", () => {
    expect(replaceCurrentSearchMatch("one two", "one", "three", 99)).toEqual({
      text: "three two",
      patches: [{ from: 0, to: 3, insert: "three" }],
      selection: { from: 0, to: 5 },
      replacedCount: 1,
    });
  });

  it("replaces all matches with original offsets", () => {
    expect(replaceAllSearchMatches("one two one", "one", "three")).toEqual({
      text: "three two three",
      patches: [
        { from: 0, to: 3, insert: "three" },
        { from: 8, to: 11, insert: "three" },
      ],
      selection: { from: 0, to: 5 },
      replacedCount: 2,
    });
  });

  it("returns null when replace would not change the text", () => {
    expect(replaceAllSearchMatches("one two", "one", "one")).toBeNull();
  });
});
