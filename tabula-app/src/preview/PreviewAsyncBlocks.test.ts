import { describe, expect, it } from "vitest";
import { MATH_FENCE_LANGUAGES } from "./PreviewAsyncBlocks";

describe("preview async blocks", () => {
  it("recognizes common fenced math language names", () => {
    expect([...MATH_FENCE_LANGUAGES]).toEqual(["katex", "latex", "math", "tex"]);
  });
});
