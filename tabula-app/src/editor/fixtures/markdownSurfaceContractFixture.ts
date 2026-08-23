import type { PreviewBlockKind } from "@tabula-md/tabula";
import type { EditorVisualReplacement } from "../editorVisualModeModel";

export const markdownSurfaceContractMarkdown = [
  "---",
  "title: Surface Contract",
  "status: Draft",
  "---",
  "",
  "# Surface Contract",
  "",
  [
    "Inline **strong text**, *emphasis text*, ~~struck text~~, `inline code`,",
    "$E = mc^2$, [external link](https://example.com),",
    "[workspace link](./notes.md), [heading link](#surface-contract),",
    "[missing link](./missing.md), and a footnote reference[^source].",
  ].join(" "),
  "",
  "> Quoted source",
  "> continues here.",
  "",
  "- Unordered item",
  "  - Nested item",
  "",
  "1. Ordered item",
  "2. Second item",
  "",
  "- [x] Completed task",
  "- [ ] Pending task",
  "",
  "| Feature | Status |",
  "| :--- | ---: |",
  "| Visual editing | Ready |",
  "",
  "***",
  "",
  "![Surface image](https://example.com/surface.png)",
  "",
  "```javascript",
  "const ready = true;",
  "```",
  "",
  "```",
  "plain text",
  "```",
  "",
  "$$",
  "\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}",
  "$$",
  "",
  "```mermaid",
  "flowchart LR",
  "  Source --> Visual",
  "  Source --> Preview",
  "```",
  "",
  '<Callout type="warning" title="Canonical source">',
  "",
  "Markdown remains canonical.",
  "",
  "</Callout>",
  "",
  '<Accordion title="Implementation details">',
  "",
  "The source range remains editable.",
  "",
  "</Accordion>",
  "",
  "<Tabs>",
  "",
  '<Tab title="Visual">',
  "",
  "Rendered editing surface.",
  "",
  "</Tab>",
  "",
  '<Tab title="Preview">',
  "",
  "Rendered reading surface.",
  "",
  "</Tab>",
  "",
  "</Tabs>",
  "",
  "[reference-link]: https://example.com/reference",
  "",
  "[^source]: Visual keeps this definition at its source position.",
].join("\n");

export const markdownSurfaceFeatureAnchors = {
  frontmatter: ["---", "title: Surface Contract", "status: Draft", "---"].join("\n"),
  heading: "# Surface Contract",
  strong: "**strong text**",
  emphasis: "*emphasis text*",
  strikethrough: "~~struck text~~",
  "inline-code": "`inline code`",
  "inline-math": "$E = mc^2$",
  "external-link": "[external link](https://example.com)",
  "internal-document-link": "[workspace link](./notes.md)",
  "internal-heading-link": "[heading link](#surface-contract)",
  "broken-internal-link": "[missing link](./missing.md)",
  blockquote: ["> Quoted source", "> continues here."].join("\n"),
  "unordered-list": ["- Unordered item", "  - Nested item"].join("\n"),
  "ordered-list": ["1. Ordered item", "2. Second item"].join("\n"),
  "task-list": ["- [x] Completed task", "- [ ] Pending task"].join("\n"),
  table: [
    "| Feature | Status |",
    "| :--- | ---: |",
    "| Visual editing | Ready |",
  ].join("\n"),
  "thematic-break": "***",
  image: "![Surface image](https://example.com/surface.png)",
  "fenced-code": ["```javascript", "const ready = true;", "```"].join("\n"),
  "plain-code": ["```", "plain text", "```"].join("\n"),
  "display-math": [
    "$$",
    "\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}",
    "$$",
  ].join("\n"),
  diagram: [
    "```mermaid",
    "flowchart LR",
    "  Source --> Visual",
    "  Source --> Preview",
    "```",
  ].join("\n"),
  callout: [
    '<Callout type="warning" title="Canonical source">',
    "",
    "Markdown remains canonical.",
    "",
    "</Callout>",
  ].join("\n"),
  accordion: [
    '<Accordion title="Implementation details">',
    "",
    "The source range remains editable.",
    "",
    "</Accordion>",
  ].join("\n"),
  tabs: [
    "<Tabs>",
    "",
    '<Tab title="Visual">',
    "",
    "Rendered editing surface.",
    "",
    "</Tab>",
    "",
    '<Tab title="Preview">',
    "",
    "Rendered reading surface.",
    "",
    "</Tab>",
    "",
    "</Tabs>",
  ].join("\n"),
  "reference-definition": "[reference-link]: https://example.com/reference",
  "footnote-reference": "a footnote reference[^source]",
  "footnote-definition":
    "[^source]: Visual keeps this definition at its source position.",
  "blank-line": "\n\n# Surface Contract",
} as const;

export type MarkdownSurfaceFeature =
  keyof typeof markdownSurfaceFeatureAnchors;

export const markdownSurfaceFeatures = Object.keys(
  markdownSurfaceFeatureAnchors,
) as MarkdownSurfaceFeature[];

export type PreviewSurfaceExpectation = {
  feature: MarkdownSurfaceFeature;
  kind: PreviewBlockKind;
  source: string;
};

export const previewSurfaceExpectations: PreviewSurfaceExpectation[] = [
  { feature: "heading", kind: "heading", source: markdownSurfaceFeatureAnchors.heading },
  {
    feature: "blockquote",
    kind: "blockquote",
    source: markdownSurfaceFeatureAnchors.blockquote,
  },
  {
    feature: "unordered-list",
    kind: "list",
    source: markdownSurfaceFeatureAnchors["unordered-list"],
  },
  {
    feature: "ordered-list",
    kind: "list",
    source: markdownSurfaceFeatureAnchors["ordered-list"],
  },
  {
    feature: "task-list",
    kind: "list",
    source: markdownSurfaceFeatureAnchors["task-list"],
  },
  { feature: "table", kind: "table", source: markdownSurfaceFeatureAnchors.table },
  {
    feature: "thematic-break",
    kind: "thematic",
    source: markdownSurfaceFeatureAnchors["thematic-break"],
  },
  { feature: "image", kind: "paragraph", source: markdownSurfaceFeatureAnchors.image },
  {
    feature: "fenced-code",
    kind: "fence",
    source: markdownSurfaceFeatureAnchors["fenced-code"],
  },
  {
    feature: "plain-code",
    kind: "fence",
    source: markdownSurfaceFeatureAnchors["plain-code"],
  },
  { feature: "diagram", kind: "fence", source: markdownSurfaceFeatureAnchors.diagram },
  { feature: "callout", kind: "html", source: markdownSurfaceFeatureAnchors.callout },
  {
    feature: "accordion",
    kind: "html",
    source: markdownSurfaceFeatureAnchors.accordion,
  },
  { feature: "tabs", kind: "html", source: markdownSurfaceFeatureAnchors.tabs },
  {
    feature: "reference-definition",
    kind: "blank",
    source: markdownSurfaceFeatureAnchors["reference-definition"],
  },
  {
    feature: "footnote-definition",
    kind: "blank",
    source: markdownSurfaceFeatureAnchors["footnote-definition"],
  },
];

export type VisualSurfaceExpectation = {
  feature: MarkdownSurfaceFeature;
  kind: EditorVisualReplacement["kind"];
  source: string;
};

export const visualSurfaceExpectations: VisualSurfaceExpectation[] = [
  { feature: "inline-math", kind: "inline-math", source: markdownSurfaceFeatureAnchors["inline-math"] },
  { feature: "table", kind: "table", source: markdownSurfaceFeatureAnchors.table },
  {
    feature: "thematic-break",
    kind: "horizontal-rule",
    source: markdownSurfaceFeatureAnchors["thematic-break"],
  },
  { feature: "image", kind: "image", source: markdownSurfaceFeatureAnchors.image },
  {
    feature: "fenced-code",
    kind: "code",
    source: markdownSurfaceFeatureAnchors["fenced-code"],
  },
  {
    feature: "plain-code",
    kind: "code",
    source: markdownSurfaceFeatureAnchors["plain-code"],
  },
  {
    feature: "display-math",
    kind: "math",
    source: markdownSurfaceFeatureAnchors["display-math"],
  },
  { feature: "diagram", kind: "diagram", source: markdownSurfaceFeatureAnchors.diagram },
  { feature: "callout", kind: "callout", source: markdownSurfaceFeatureAnchors.callout },
  {
    feature: "accordion",
    kind: "accordion",
    source: markdownSurfaceFeatureAnchors.accordion,
  },
  { feature: "tabs", kind: "tabs", source: markdownSurfaceFeatureAnchors.tabs },
  {
    feature: "footnote-reference",
    kind: "footnote-reference",
    source: "[^source]",
  },
  {
    feature: "footnote-definition",
    kind: "footnote-definition",
    source: markdownSurfaceFeatureAnchors["footnote-definition"],
  },
];

export const markdownSurfaceNavigationFixture = {
  markdown: [
    "before",
    "",
    "```js",
    "const x = 1;",
    "```",
    "",
    "![Navigation sample](https://example.com/navigation.png)",
    "",
    "after",
  ].join("\n"),
  lines: {
    before: 1,
    blankBeforeCode: 2,
    codeStart: 3,
    codeBody: 4,
    codeEnd: 5,
    blankAfterCode: 6,
    image: 7,
    blankAfterImage: 8,
    after: 9,
  },
} as const;
