import { describe, expect, it } from "vitest";
import { getMarkdownPresentationDocument } from "./markdownPresentationCache";

describe("Markdown presentation cache", () => {
  it("reuses the latest exact Markdown presentation", () => {
    const source = "# Cached\n\nThe same source should only be parsed once.";
    const first = getMarkdownPresentationDocument(source);
    const second = getMarkdownPresentationDocument(source);

    expect(second).toBe(first);
  });

  it("does not reuse a presentation for changed Markdown", () => {
    const first = getMarkdownPresentationDocument("# First");
    const second = getMarkdownPresentationDocument("# Second");

    expect(second).not.toBe(first);
    expect(second.source).toBe("# Second");
  });
});
