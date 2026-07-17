import { describe, expect, it } from "vitest";
import {
  getPreviewBlockGlobalDefinitions,
  getPreviewFootnoteDefinitions,
  getPreviewGlobalMarkdownContext,
} from "./previewGlobalMarkdownContext";

describe("preview global markdown context", () => {
  it("injects only reference definitions used by the current block", () => {
    const largePayload = "A".repeat(480_000);
    const firstDefinition = `[image1]: <data:image/png;base64,${largePayload}>`;
    const secondDefinition = "[guide]: https://tabula.md/guide";
    const context = getPreviewGlobalMarkdownContext(
      ["![Diagram][image1]", "", "[Guide][guide]", "", firstDefinition, secondDefinition].join("\n"),
    );
    const embeddedImageToken = "/__tabula_embedded_image__/image1";

    expect(getPreviewBlockGlobalDefinitions("Unrelated paragraph.", context)).toBe("");
    expect(getPreviewBlockGlobalDefinitions("![Diagram][image1]", context)).toBe(
      `[image1]: <${embeddedImageToken}>`,
    );
    expect(context.embeddedImageSources[embeddedImageToken]).toBe(
      `data:image/png;base64,${largePayload}`,
    );
    expect(getPreviewBlockGlobalDefinitions("[Guide][guide]", context)).toBe(secondDefinition);
  });

  it("matches normalized collapsed and shortcut reference labels", () => {
    const context = getPreviewGlobalMarkdownContext(
      ["[Product Guide]: https://tabula.md/guide", "[Shortcut]: https://tabula.md"].join("\n"),
    );

    expect(getPreviewBlockGlobalDefinitions("[Product   Guide][] and [SHORTCUT]", context)).toBe(
      "[Product Guide]: https://tabula.md/guide\n\n[Shortcut]: https://tabula.md",
    );
  });

  it("keeps footnote definitions global while injecting only referenced notes into a block", () => {
    const context = getPreviewGlobalMarkdownContext(
      [
        "Paragraph[^first].",
        "",
        "[^first]: First note with [guide][guide].",
        "    Continued note.",
        "",
        "[^second]: Second note.",
        "",
        "[guide]: https://tabula.md/guide",
      ].join("\n"),
    );

    expect(getPreviewBlockGlobalDefinitions("Paragraph[^first].", context)).toBe(
      "[guide]: https://tabula.md/guide\n\n[^first]: First note with [guide][guide].\n    Continued note.",
    );
    expect(getPreviewBlockGlobalDefinitions("No footnote here.", context)).toBe("");
    expect(getPreviewFootnoteDefinitions(context)).toContain("[^second]: Second note.");
    expect(context.footnoteReferences).toBe("[^first] [^second]");
  });

  it("ignores definitions inside fenced code", () => {
    const context = getPreviewGlobalMarkdownContext(
      ["```md", "[hidden]: https://example.com", "```", "[visible]: https://tabula.md"].join("\n"),
    );

    expect(context.referenceDefinitions.map(({ label }) => label)).toEqual(["visible"]);
  });
});
