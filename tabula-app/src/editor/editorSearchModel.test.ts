import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";
import {
  getEditorSearchMatches,
  getEditorSearchResult,
  replaceAllEditorSearchMatches,
  replaceCurrentEditorSearchMatch,
} from "./editorSearchModel";

describe("editor search model", () => {
  it("finds non-overlapping matches case-insensitively with compact previews", () => {
    expect(getEditorSearchMatches("Alpha beta alpha", "ALPHA")).toEqual([
      { start: 0, end: 5, preview: "Alpha beta alpha" },
      { start: 11, end: 16, preview: "Alpha beta alpha" },
    ]);
    expect(getEditorSearchMatches("aaaa", "aa")).toEqual([
      { start: 0, end: 2, preview: "aaaa" },
      { start: 2, end: 4, preview: "aaaa" },
    ]);
  });

  it("does not search empty queries", () => {
    expect(getEditorSearchMatches("Alpha", " ")).toEqual([]);
  });

  it("can search CodeMirror Text directly", () => {
    expect(getEditorSearchMatches(Text.of(["Alpha", "beta Alpha"]), "alpha")).toEqual([
      { start: 0, end: 5, preview: "Alpha beta Alpha" },
      { start: 11, end: 16, preview: "Alpha beta Alpha" },
    ]);
  });

  it("supports case-sensitive, whole-word, and regexp options", () => {
    expect(getEditorSearchMatches("Alpha alpha alphabet", "alpha", { caseSensitive: true, wholeWord: false, regexp: false })).toEqual([
      { start: 6, end: 11, preview: "Alpha alpha alphabet" },
      { start: 12, end: 17, preview: "Alpha alpha alphabet" },
    ]);
    expect(getEditorSearchMatches("Alpha alpha alphabet", "alpha", { caseSensitive: false, wholeWord: true, regexp: false })).toEqual([
      { start: 0, end: 5, preview: "Alpha alpha alphabet" },
      { start: 6, end: 11, preview: "Alpha alpha alphabet" },
    ]);
    expect(getEditorSearchMatches("v1 v22 v333", "v\\d+", { caseSensitive: false, wholeWord: false, regexp: true })).toEqual([
      { start: 0, end: 2, preview: "v1 v22 v333" },
      { start: 3, end: 6, preview: "v1 v22 v333" },
      { start: 7, end: 11, preview: "v1 v22 v333" },
    ]);
  });

  it("reports invalid regular expressions", () => {
    expect(getEditorSearchResult("Alpha", "(", { caseSensitive: false, wholeWord: false, regexp: true })).toEqual({
      error: expect.any(String),
      matches: [],
    });
  });

  it("replaces the active match", () => {
    expect(replaceCurrentEditorSearchMatch("one two one", "one", "three", 1)).toEqual({
      text: "one two three",
      patches: [{ from: 8, to: 11, insert: "three" }],
      selection: { from: 8, to: 13 },
      replacedCount: 1,
    });
  });

  it("clamps the active match index when replacing current", () => {
    expect(replaceCurrentEditorSearchMatch("one two", "one", "three", 99)).toEqual({
      text: "three two",
      patches: [{ from: 0, to: 3, insert: "three" }],
      selection: { from: 0, to: 5 },
      replacedCount: 1,
    });
  });

  it("replaces all matches with original offsets", () => {
    expect(replaceAllEditorSearchMatches("one two one", "one", "three")).toEqual({
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
    expect(replaceAllEditorSearchMatches("one two", "one", "one")).toBeNull();
  });
});
