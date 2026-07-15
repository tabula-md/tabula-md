import { describe, expect, it } from "vitest";
import { transformMarkdownPreviewUrl } from "./markdownPreviewUrl";

const imageNode = { tagName: "img" } as Parameters<typeof transformMarkdownPreviewUrl>[2];
const linkNode = { tagName: "a" } as Parameters<typeof transformMarkdownPreviewUrl>[2];

describe("transformMarkdownPreviewUrl", () => {
  it("allows validated embedded raster images", () => {
    const src = "data:image/png;base64,iVBORw0KGgo=";
    expect(transformMarkdownPreviewUrl(src, "src", imageNode)).toBe(src);
  });

  it("does not allow data URLs for links", () => {
    expect(transformMarkdownPreviewUrl("data:text/html;base64,PHNjcmlwdD4=", "href", linkNode)).toBe("");
  });

  it("does not allow script image sources", () => {
    expect(transformMarkdownPreviewUrl("javascript:alert(1)", "src", imageNode)).toBe("");
  });
});
