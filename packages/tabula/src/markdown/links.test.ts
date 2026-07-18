import { describe, expect, it } from "vitest";
import {
  getMarkdownLinkAtOffset,
  getMarkdownLinks,
  isSafeMarkdownLinkUrl,
  updateMarkdownLinkUrl,
} from "./links";

describe("markdown links", () => {
  it("detects inline link source ranges", () => {
    expect(getMarkdownLinks("[Tabula](https://tabula.md)")).toEqual([
      {
        from: 0,
        to: 27,
        text: "Tabula",
        url: "https://tabula.md",
        urlFrom: 9,
        urlTo: 26,
        isImage: false,
        isSafe: true,
      },
    ]);
  });

  it("does not return image links for interactive link clicks", () => {
    expect(getMarkdownLinkAtOffset("![alt](https://tabula.md)", 3)).toBeNull();
  });

  it("rejects unsafe URLs for open actions", () => {
    expect(isSafeMarkdownLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeMarkdownLinkUrl("https://tabula.md")).toBe(true);
  });

  it("creates a URL-only edit for links", () => {
    expect(updateMarkdownLinkUrl("[Tabula](https://tabula.md)", 0, "https://example.com")).toEqual({
      patch: { from: 9, to: 26, insert: "https://example.com" },
      selection: { from: 9, to: 28 },
    });
  });
});
