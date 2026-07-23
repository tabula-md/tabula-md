import { describe, expect, it } from "vitest";
import { PREVIEW_SANITIZE_SCHEMA } from "./previewSanitizeSchema";

describe("preview sanitize schema", () => {
  it("allows static document HTML without enabling executable elements", () => {
    expect(PREVIEW_SANITIZE_SCHEMA.tagNames).toEqual(expect.arrayContaining([
      "abbr",
      "details",
      "figcaption",
      "figure",
      "kbd",
      "summary",
      "tabula-workspace-embed",
    ]));
    expect(PREVIEW_SANITIZE_SCHEMA.attributes?.["tabula-workspace-embed"])
      .toContain("dataWorkspaceEmbedTarget");
    expect(PREVIEW_SANITIZE_SCHEMA.attributes?.details).toContain("open");
    expect(PREVIEW_SANITIZE_SCHEMA.tagNames).not.toEqual(expect.arrayContaining([
      "iframe",
      "script",
      "style",
    ]));
  });
});
