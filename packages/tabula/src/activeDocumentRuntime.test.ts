import { describe, expect, it } from "vitest";
import {
  createActiveDocumentRuntime,
  type ActiveDocumentFile,
} from "./activeDocumentRuntime";

const file = (overrides: Partial<ActiveDocumentFile> = {}): ActiveDocumentFile => ({
  title: "README.md",
  text: "hello world",
  viewMode: "edit",
  readingWidth: "standard",
  lineWrapping: true,
  lineNumbers: true,
  ...overrides,
});

describe("active document runtime", () => {
  it("provides stable defaults when no file is open", () => {
    expect(createActiveDocumentRuntime()).toMatchObject({
      bookmarks: [],
      canCopy: false,
      canFormat: false,
      hasFile: false,
      lineNumbers: true,
      lineWrapping: true,
      readingWidth: "wide",
      text: "",
      title: "No file open",
      viewMode: "edit",
      wordCount: 0,
    });
  });

  it("derives editing surface state from the active file", () => {
    const runtime = createActiveDocumentRuntime(
      file({
        bookmarks: [{ id: "bookmark-1", position: 0, createdAt: "2026-06-30T00:00:00.000Z" }],
        lineNumbers: false,
        lineWrapping: false,
        splitRatio: 0.9,
        text: "one two\nthree",
      }),
    );

    expect(runtime).toMatchObject({
      canCopy: true,
      canFormat: true,
      hasFile: true,
      lineNumbers: false,
      lineWrapping: false,
      readingWidth: "standard",
      splitRatio: 0.72,
      title: "README.md",
      viewMode: "edit",
      wordCount: 3,
    });
    expect(runtime.bookmarks).toHaveLength(1);
  });

  it("disables formatting in preview mode while keeping copy available", () => {
    expect(
      createActiveDocumentRuntime(file({ viewMode: "preview", text: "# Ready" })),
    ).toMatchObject({
      canCopy: true,
      canFormat: false,
      hasFile: true,
      viewMode: "preview",
    });
  });

  it("keeps frontmatter parsing and outline data inside the document runtime", () => {
    const text = `---\ntitle: Product Brief\n---\n\n# Intro\n\n## Scope`;
    const runtime = createActiveDocumentRuntime(file({ text }));

    expect(runtime.parsedMarkdown.attributes).toEqual([
      { key: "title", value: "Product Brief" },
    ]);
    expect(runtime.renderedPreview.body).toBe("\n# Intro\n\n## Scope");
    expect(runtime.previewBodyStartOffset).toBe(text.indexOf("\n# Intro"));
    expect(runtime.outlineHeadings).toEqual([
      { depth: 1, text: "Intro", lineIndex: 1, sourceLineIndex: 1 },
      { depth: 2, text: "Scope", lineIndex: 3, sourceLineIndex: 3 },
    ]);
  });
});
