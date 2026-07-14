import { describe, expect, it } from "vitest";
import { resolveMarkdownHref } from "./markdownHref";

describe("resolveMarkdownHref", () => {
  it("opens absolute web URLs in a new tab", () => {
    expect(resolveMarkdownHref("https://google.com/docs")).toEqual({
      href: "https://google.com/docs",
      kind: "external",
      openInNewTab: true,
    });
  });

  it("normalizes domain-like links to HTTPS", () => {
    expect(resolveMarkdownHref("www.google.com")).toEqual({
      href: "https://www.google.com",
      kind: "external",
      openInNewTab: true,
    });
    expect(resolveMarkdownHref("docs.example.com/guide#start")).toEqual({
      href: "https://docs.example.com/guide#start",
      kind: "external",
      openInNewTab: true,
    });
  });

  it("keeps document fragments and relative paths distinct", () => {
    expect(resolveMarkdownHref("#start-here")).toMatchObject({ kind: "fragment" });
    expect(resolveMarkdownHref("../docs/guide.md")).toEqual({
      href: "../docs/guide.md",
      kind: "relative",
      openInNewTab: false,
    });
  });
});
