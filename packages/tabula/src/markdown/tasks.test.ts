import { describe, expect, it } from "vitest";
import {
  getMarkdownTaskAtOffset,
  getMarkdownTaskMarkers,
  toggleMarkdownTaskAtOffset,
  toggleMarkdownTaskOnLine,
} from "./tasks";

describe("markdown task markers", () => {
  it("detects checklist marker ranges", () => {
    expect(getMarkdownTaskMarkers("- [ ] todo\n- [x] done")).toEqual([
      {
        lineStart: 0,
        lineEnd: 10,
        markerStart: 2,
        markerEnd: 6,
        stateStart: 3,
        stateEnd: 4,
        checked: false,
      },
      {
        lineStart: 11,
        lineEnd: 21,
        markerStart: 13,
        markerEnd: 17,
        stateStart: 14,
        stateEnd: 15,
        checked: true,
      },
    ]);
  });

  it("finds a task marker at an offset", () => {
    expect(getMarkdownTaskAtOffset("- [ ] todo", 3)?.checked).toBe(false);
  });

  it("creates a one-character toggle patch", () => {
    expect(toggleMarkdownTaskAtOffset("- [ ] todo", 3)).toEqual({
      patch: { from: 3, to: 4, insert: "x" },
      selection: { from: 3, to: 4 },
    });
  });

  it("creates a toggle patch for a source line", () => {
    expect(toggleMarkdownTaskOnLine("intro\n- [x] done", 6)).toEqual({
      patch: { from: 9, to: 10, insert: " " },
      selection: { from: 9, to: 10 },
    });
  });
});
