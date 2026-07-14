import { describe, expect, it } from "vitest";
import { classifyMarkdownHref } from "./markdownHref";

describe("classifyMarkdownHref", () => {
  it("allows explicit HTTP and HTTPS URLs", () => {
    expect(classifyMarkdownHref("https://google.com/docs")).toEqual({
      href: "https://google.com/docs",
      kind: "external",
      openInNewTab: true,
    });
    expect(classifyMarkdownHref("http://localhost:3000/guide")).toEqual({
      href: "http://localhost:3000/guide",
      kind: "external",
      openInNewTab: true,
    });
  });

  it.each([
    "www.google.com",
    "docs.example.com/guide#start",
    "//example.com",
    "#start-here",
    "../docs/guide.md",
    "mailto:hello@example.com",
    "javascript:alert(1)",
  ])("keeps non-HTTP hrefs inert: %s", (href) => {
    expect(classifyMarkdownHref(href)).toEqual({
      kind: "inert",
      openInNewTab: false,
    });
  });
});
