import type { MarkdownSurfaceFeature } from "./fixtures/markdownSurfaceContractFixture";

export type MarkdownSurfacePresentation =
  | "not-rendered"
  | "rendered"
  | "source";

export type MarkdownSurfacePlacement =
  | "document-end"
  | "source-position";

export type MarkdownSurfaceSourceGeometry =
  | "occupies-layout"
  | "zero-height";

export type MarkdownSurfaceDifference =
  | "preview-collapses-blank-lines"
  | "preview-collects-footnote-definitions"
  | "preview-hides-reference-definitions";

export type MarkdownSurfaceBehavior = {
  placement: MarkdownSurfacePlacement;
  presentation: MarkdownSurfacePresentation;
  sourceGeometry: MarkdownSurfaceSourceGeometry;
};

export type MarkdownSurfaceFeaturePolicy = {
  allowedDifferences: readonly MarkdownSurfaceDifference[];
  feature: MarkdownSurfaceFeature;
  preview: MarkdownSurfaceBehavior;
  visualInactive: MarkdownSurfaceBehavior;
};

export const markdownSurfaceGlobalPolicy = {
  canonicalSource: "markdown",
  previewInteraction: "read-only",
  semanticMeaning: "shared",
  visualActiveRange: "canonical-source",
} as const;

const renderedAtSource: MarkdownSurfaceBehavior = {
  placement: "source-position",
  presentation: "rendered",
  sourceGeometry: "occupies-layout",
};

const equivalent = (
  feature: MarkdownSurfaceFeature,
): MarkdownSurfaceFeaturePolicy => ({
  allowedDifferences: [],
  feature,
  preview: renderedAtSource,
  visualInactive: renderedAtSource,
});

export const markdownSurfaceParityPolicies: Record<
  MarkdownSurfaceFeature,
  MarkdownSurfaceFeaturePolicy
> = {
  frontmatter: equivalent("frontmatter"),
  heading: equivalent("heading"),
  strong: equivalent("strong"),
  emphasis: equivalent("emphasis"),
  strikethrough: equivalent("strikethrough"),
  "inline-code": equivalent("inline-code"),
  "inline-math": equivalent("inline-math"),
  "external-link": equivalent("external-link"),
  "internal-document-link": equivalent("internal-document-link"),
  "internal-heading-link": equivalent("internal-heading-link"),
  "broken-internal-link": equivalent("broken-internal-link"),
  blockquote: equivalent("blockquote"),
  "unordered-list": equivalent("unordered-list"),
  "ordered-list": equivalent("ordered-list"),
  "task-list": equivalent("task-list"),
  table: equivalent("table"),
  "thematic-break": equivalent("thematic-break"),
  image: equivalent("image"),
  "fenced-code": equivalent("fenced-code"),
  "plain-code": equivalent("plain-code"),
  "display-math": equivalent("display-math"),
  diagram: equivalent("diagram"),
  callout: equivalent("callout"),
  accordion: equivalent("accordion"),
  tabs: equivalent("tabs"),
  "footnote-reference": equivalent("footnote-reference"),
  "reference-definition": {
    allowedDifferences: ["preview-hides-reference-definitions"],
    feature: "reference-definition",
    preview: {
      placement: "source-position",
      presentation: "not-rendered",
      sourceGeometry: "zero-height",
    },
    visualInactive: {
      placement: "source-position",
      presentation: "source",
      sourceGeometry: "occupies-layout",
    },
  },
  "footnote-definition": {
    allowedDifferences: ["preview-collects-footnote-definitions"],
    feature: "footnote-definition",
    preview: {
      placement: "document-end",
      presentation: "rendered",
      sourceGeometry: "zero-height",
    },
    visualInactive: renderedAtSource,
  },
  "blank-line": {
    allowedDifferences: ["preview-collapses-blank-lines"],
    feature: "blank-line",
    preview: {
      placement: "source-position",
      presentation: "not-rendered",
      sourceGeometry: "zero-height",
    },
    visualInactive: {
      placement: "source-position",
      presentation: "source",
      sourceGeometry: "occupies-layout",
    },
  },
};
