import { describe, expect, it } from "vitest";
import { normalizePastedMarkdown } from "./editorPaste";

describe("editor paste normalization", () => {
  it("normalizes source-sensitive pasted Markdown line endings and leading tabs", () => {
    expect(normalizePastedMarkdown("Title\r\n\titem\r\n\r\n\r\nnext")).toBe(
      "Title\n  item\n\n\nnext",
    );
  });

  it("lets unchanged plain paste use the native editor path", () => {
    expect(normalizePastedMarkdown("plain text")).toBeNull();
  });
});
