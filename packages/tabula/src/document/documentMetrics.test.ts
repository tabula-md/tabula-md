import { describe, expect, it } from "vitest";
import { getApproximateTokenCount, getMarkdownWordCount } from "./documentMetrics";

describe("document metrics", () => {
  it("counts whitespace-separated Markdown words", () => {
    expect(getMarkdownWordCount("  one\n two  three ")).toBe(3);
    expect(getMarkdownWordCount("   ")).toBe(0);
  });

  it("estimates one token for every four UTF-8 bytes", () => {
    expect(getApproximateTokenCount("")).toBe(0);
    expect(getApproximateTokenCount("abcd")).toBe(1);
    expect(getApproximateTokenCount("abcde")).toBe(2);
    expect(getApproximateTokenCount("한글")).toBe(2);
  });
});
