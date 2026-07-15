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

  it.each(["", "image.png", "./image.png", "/image.png", "javascript:alert(1)"])(
    "does not resolve unsupported source %j against the app origin",
    (src) => {
      expect(classifyMarkdownImageSource(src)).toEqual({ kind: "unsupported" });
    },
  );
});
