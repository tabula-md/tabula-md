import { describe, expect, it } from "vitest";
import {
  getVisualFrontmatterSelectionTransition,
  restoreFrontmatterSourceSelection,
} from "./editorVisualFrontmatter";

const markdown = [
  "---",
  "title: Incident response",
  "owner:",
  "  team: operations",
  "---",
  "",
  "# Body",
].join("\n");

describe("visual frontmatter selection", () => {
  it("moves a source cursor in frontmatter to the body before Write renders", () => {
    const transition = getVisualFrontmatterSelectionTransition(markdown, {
      anchor: markdown.indexOf("operations"),
      head: markdown.indexOf("operations"),
    });

    expect(transition).toEqual({
      bodyOffset: markdown.indexOf("\n\n# Body") + 1,
      sourceSelection: {
        anchor: markdown.indexOf("operations"),
        head: markdown.indexOf("operations"),
      },
      visualSelection: {
        anchor: markdown.indexOf("\n\n# Body") + 1,
        head: markdown.indexOf("\n\n# Body") + 1,
      },
    });
  });

  it("does not move a body selection or invalid frontmatter", () => {
    const bodyPosition = markdown.indexOf("Body");
    expect(getVisualFrontmatterSelectionTransition(markdown, {
      anchor: bodyPosition,
      head: bodyPosition,
    })).toBeNull();
    expect(getVisualFrontmatterSelectionTransition("---\ntitle: [\n---\nBody", {
      anchor: 2,
      head: 2,
    })).toBeNull();
  });

  it("restores a remembered Source cursor without crossing a changed delimiter", () => {
    const changed = markdown.replace("title: Incident response", "title: Incident response guide");
    const restored = restoreFrontmatterSourceSelection(changed, {
      anchor: markdown.length,
      head: markdown.length,
    });

    expect(restored).toEqual({
      anchor: changed.indexOf("\n\n# Body"),
      head: changed.indexOf("\n\n# Body"),
    });
  });
});
