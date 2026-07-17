import { describe, expect, it } from "vitest";
import { normalizePreviewDocsComponents } from "./previewDocsCompatibility";

describe("preview docs compatibility", () => {
  it("normalizes supported docs components", () => {
    expect(normalizePreviewDocsComponents([
      "<CardGroup cols={2}>",
      "<Card title=\"One\">Body</Card>",
      "</CardGroup>",
      "<Tabs>",
      "<Tab title=\"TypeScript\">Code</Tab>",
      "</Tabs>",
      "<Accordion title=\"Details\">More</Accordion>",
      "<Steps><Step title=\"Install\">Run it</Step></Steps>",
    ].join("\n"))).toBe([
      "<tabula-card-group cols={2}>",
      "<tabula-card title=\"One\">Body</tabula-card>",
      "</tabula-card-group>",
      "<tabula-tabs>",
      "<tabula-tab title=\"TypeScript\">Code</tabula-tab>",
      "</tabula-tabs>",
      "<tabula-accordion title=\"Details\">More</tabula-accordion>",
      "<tabula-steps><tabula-step title=\"Install\">Run it</tabula-step></tabula-steps>",
    ].join("\n"));
  });

  it("turns unknown components into visible inert fallback elements", () => {
    expect(normalizePreviewDocsComponents([
      "<ChartPanel data={report}>",
      "Keep this explanation.",
      "</ChartPanel>",
      "<StatusDot value={ready} />",
      "<custom-widget>Static HTML content.</custom-widget>",
    ].join("\n"))).toBe([
      "<tabula-unsupported-component data-component-name=\"ChartPanel\">",
      "Keep this explanation.",
      "</tabula-unsupported-component>",
      "<tabula-unsupported-component data-component-name=\"StatusDot\"></tabula-unsupported-component>",
      "<tabula-unsupported-component data-component-name=\"custom-widget\">Static HTML content.</tabula-unsupported-component>",
    ].join("\n"));
  });

  it("leaves allowed and explicitly stripped HTML for the sanitizer", () => {
    const markdown = [
      "<details><summary>More</summary>Body</details>",
      "<script>window.unsafe = true</script>",
    ].join("\n");

    expect(normalizePreviewDocsComponents(markdown)).toBe(markdown);
  });

  it("does not rewrite component examples in inline or fenced code", () => {
    const markdown = [
      "`<Card title=\"Example\" />`",
      "",
      "```mdx",
      "<Unknown />",
      "```",
    ].join("\n");

    expect(normalizePreviewDocsComponents(markdown)).toBe(markdown);
  });
});
