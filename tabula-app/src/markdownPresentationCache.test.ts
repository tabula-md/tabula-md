import { describe, expect, it } from "vitest";
import { createMarkdownPresentationDocument } from "@tabula-md/tabula";
import {
  getMarkdownPresentationDocument,
  updateMarkdownPresentationDocument,
} from "./markdownPresentationCache";

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

  it("reparses only the edited paragraph for a local text change", () => {
    const source = [
      "# Stable heading",
      "",
      "First paragraph stays unchanged.",
      "",
      "Second paragraph has **formatted** text and a [link](https://example.com).",
      "",
      "Third paragraph also stays unchanged.",
    ].join("\n");
    const previous = getMarkdownPresentationDocument(source);
    const inserted = " locally";
    const insertion = source.indexOf(" has") + " has".length;
    const nextSource =
      source.slice(0, insertion) + inserted + source.slice(insertion);
    const next = updateMarkdownPresentationDocument(previous, nextSource, {
      fromA: insertion,
      fromB: insertion,
      toA: insertion,
      toB: insertion + inserted.length,
    });

    expect(next).toEqual(createMarkdownPresentationDocument(nextSource));
    expect(next.blocks[0]).toBe(previous.blocks[0]);
    expect(next.blocks[2]).toBe(previous.blocks[2]);
    expect(next.blocks[4]).not.toBe(previous.blocks[4]);
  });

  it("falls back to a full parse when block boundaries or global references can change", () => {
    const source = [
      "First paragraph.",
      "",
      "Second paragraph.",
      "",
      "[^note]: Global footnote.",
    ].join("\n");
    const previous = getMarkdownPresentationDocument(source);
    const insertion = source.indexOf(" paragraph.");
    const inserted = "\n";
    const nextSource =
      source.slice(0, insertion) + inserted + source.slice(insertion);
    const next = updateMarkdownPresentationDocument(previous, nextSource, {
      fromA: insertion,
      fromB: insertion,
      toA: insertion,
      toB: insertion + inserted.length,
    });

    expect(next).toEqual(createMarkdownPresentationDocument(nextSource));
    expect(next.blocks[0]).not.toBe(previous.blocks[0]);
  });
});
