import { describe, expect, it } from "vitest";
import {
  classifyEditorVisualScroll,
  getEditorVisualScrollCorrection,
  getEditorVisualVisibilityCorrection,
} from "./editorVisualViewport";

describe("editor visual viewport anchoring", () => {
  it("preserves a source-position anchor when rendered geometry changes", () => {
    expect(getEditorVisualScrollCorrection(
      { position: 42, top: 120 },
      { position: 42, top: 168 },
    )).toBe(48);
    expect(getEditorVisualScrollCorrection(
      { position: 42, top: 168 },
      { position: 42, top: 120 },
    )).toBe(-48);
  });

  it("does not invent a correction before both measurements exist", () => {
    expect(getEditorVisualScrollCorrection(
      null,
      { position: 42, top: 120 },
    )).toBeNull();
    expect(getEditorVisualScrollCorrection(
      { position: 42, top: 120 },
      null,
    )).toBeNull();
  });

  it("discards a stale geometry measurement from another source position", () => {
    expect(getEditorVisualScrollCorrection(
      { position: 41, top: 120 },
      { position: 42, top: 168 },
    )).toBeNull();
  });

  it("does not restore a cursor anchor after the user takes ownership of scrolling", () => {
    expect(getEditorVisualScrollCorrection(
      { position: 42, top: 120 },
      { position: 42, top: 420 },
      false,
    )).toBeNull();
  });

  it("moves only cursors outside the safe viewport margin", () => {
    expect(getEditorVisualVisibilityCorrection(90, 110, 0, 800)).toBe(0);
    expect(getEditorVisualVisibilityCorrection(20, 40, 0, 800)).toBe(-28);
    expect(getEditorVisualVisibilityCorrection(780, 800, 0, 800)).toBe(48);
  });

  it("separates coordinator scrolls from user-owned scroll changes", () => {
    expect(classifyEditorVisualScroll(240, 240)).toBe("programmatic");
    expect(classifyEditorVisualScroll(240.4, 240)).toBe("programmatic");
    expect(classifyEditorVisualScroll(248, 240)).toBe("user");
    expect(classifyEditorVisualScroll(240, null)).toBe("user");
  });
});
