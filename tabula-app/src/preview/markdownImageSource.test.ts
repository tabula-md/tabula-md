import { describe, expect, it } from "vitest";
import { classifyMarkdownImageSource } from "./markdownImageSource";

describe("classifyMarkdownImageSource", () => {
  it("accepts remote HTTP images", () => {
    expect(classifyMarkdownImageSource("https://example.com/image.png")).toEqual({
      kind: "remote",
      src: "https://example.com/image.png",
    });
  });

  it("accepts common embedded raster images", () => {
    expect(classifyMarkdownImageSource("data:image/png;base64,iVBORw0KGgo=").kind).toBe(
      "embedded",
    );
  });

  it("recognizes the toolbar URL placeholder", () => {
    expect(classifyMarkdownImageSource("image-url")).toEqual({
      kind: "placeholder",
    });
  });

  it.each(["image.png", "./image.png", "/image.png"])(
    "keeps local source %j distinct from remote failures",
    (src) => {
      expect(classifyMarkdownImageSource(src)).toEqual({ kind: "local" });
    },
  );

  it.each(["", "javascript:alert(1)"])("rejects unsupported source %j", (src) => {
    expect(classifyMarkdownImageSource(src)).toEqual({ kind: "unsupported" });
  });
});
