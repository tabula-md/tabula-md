import { describe, expect, it } from "vitest";
import {
  MARKDOWN_CAPABILITY_REGISTRY,
  analyzeMarkdownCapabilities,
} from "./markdownCapabilityRegistry";

describe("Markdown capability registry", () => {
  it("separates GFM features from Tabula and ecosystem extensions", () => {
    expect(
      MARKDOWN_CAPABILITY_REGISTRY.find(
        (definition) => definition.id === "gfm-table",
      ),
    ).toMatchObject({ family: "gfm", portable: true });
    expect(
      MARKDOWN_CAPABILITY_REGISTRY.find(
        (definition) => definition.id === "tabs",
      ),
    ).toMatchObject({
      family: "extension",
      label: "Tabula tabs",
      portable: false,
    });
  });

  it("reports file capabilities with source ranges and portability diagnostics", () => {
    const source = [
      "---",
      "title: Guide",
      "---",
      "",
      "| Name | State |",
      "| --- | --- |",
      "| API | Ready |",
      "",
      "- [x] Ship",
      "",
      "See [[API]] and ![[Diagram]].",
      "",
      "<Tabs>",
      '<Tab title="One">Body</Tab>',
      "</Tabs>",
    ].join("\n");
    const analysis = analyzeMarkdownCapabilities(source);

    expect(analysis.capabilities).toEqual(expect.arrayContaining([
      "commonmark",
      "frontmatter",
      "gfm-table",
      "gfm-task-list",
      "wikilink",
      "embed",
      "tabs",
    ]));
    for (const occurrence of analysis.occurrences) {
      expect(source.slice(occurrence.from, occurrence.to).length)
        .toBe(occurrence.to - occurrence.from);
    }
    expect(analysis.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        capability: "wikilink",
        code: "extension-portability",
      }),
      expect.objectContaining({
        capability: "tabs",
        code: "extension-portability",
      }),
    ]));
    expect(analysis.diagnostics.some(
      (diagnostic) => diagnostic.capability === "gfm-table",
    )).toBe(false);
  });

  it("does not classify extension-looking source inside fenced code", () => {
    const analysis = analyzeMarkdownCapabilities([
      "```md",
      "[[Not a link]]",
      "<Tabs>not a component</Tabs>",
      "- [x] not a task",
      "```",
    ].join("\n"));

    expect(analysis.capabilities).toEqual(["commonmark"]);
  });
});
