import { describe, expect, it } from "vitest";
import {
  markdownSurfaceFeatures,
  type MarkdownSurfaceFeature,
} from "./fixtures/markdownSurfaceContractFixture";
import {
  markdownSurfaceGlobalPolicy,
  markdownSurfaceParityPolicies,
  type MarkdownSurfaceDifference,
  type MarkdownSurfaceFeaturePolicy,
} from "./markdownSurfaceParityPolicy";

const sorted = <T extends string>(values: readonly T[]) =>
  [...values].sort((left, right) => left.localeCompare(right));

const policiesWithDifference = (difference: MarkdownSurfaceDifference) =>
  Object.values(markdownSurfaceParityPolicies)
    .filter((policy) => policy.allowedDifferences.includes(difference))
    .map(({ feature }) => feature)
    .sort();

const expectEquivalentInactiveBehavior = (
  policy: MarkdownSurfaceFeaturePolicy,
) => {
  expect(policy.preview).toEqual(policy.visualInactive);
  expect(policy.allowedDifferences).toEqual([]);
};

describe("Markdown surface parity policy", () => {
  it("covers every contract fixture feature exactly once", () => {
    const policyFeatures = Object.keys(
      markdownSurfaceParityPolicies,
    ) as MarkdownSurfaceFeature[];

    expect(sorted(policyFeatures)).toEqual(sorted(markdownSurfaceFeatures));
    expect(new Set(policyFeatures).size).toBe(policyFeatures.length);
    for (const feature of policyFeatures) {
      expect(markdownSurfaceParityPolicies[feature].feature).toBe(feature);
    }
  });

  it("keeps Markdown canonical and active Visual ranges source-editable", () => {
    expect(markdownSurfaceGlobalPolicy).toEqual({
      canonicalSource: "markdown",
      previewInteraction: "read-only",
      semanticMeaning: "shared",
      visualActiveRange: "canonical-source",
    });
  });

  it("requires equivalent inactive behavior unless a difference is allowlisted", () => {
    for (const policy of Object.values(markdownSurfaceParityPolicies)) {
      if (policy.allowedDifferences.length === 0) {
        expectEquivalentInactiveBehavior(policy);
      } else {
        expect(policy.preview).not.toEqual(policy.visualInactive);
      }
    }
  });

  it("limits each intentional difference to its documented feature", () => {
    expect(
      policiesWithDifference("preview-collapses-blank-lines"),
    ).toEqual(["blank-line"]);
    expect(
      policiesWithDifference("preview-collects-footnote-definitions"),
    ).toEqual(["footnote-definition"]);
    expect(
      policiesWithDifference("preview-hides-reference-definitions"),
    ).toEqual(["reference-definition"]);
  });

  it("keeps collected footnotes rendered while relocating only their definitions", () => {
    const reference = markdownSurfaceParityPolicies["footnote-reference"];
    const definition = markdownSurfaceParityPolicies["footnote-definition"];

    expectEquivalentInactiveBehavior(reference);
    expect(definition.preview).toEqual({
      placement: "document-end",
      presentation: "rendered",
      sourceGeometry: "zero-height",
    });
    expect(definition.visualInactive).toEqual({
      placement: "source-position",
      presentation: "rendered",
      sourceGeometry: "occupies-layout",
    });
  });

  it("keeps hidden Preview source structures editable in Visual mode", () => {
    expect(markdownSurfaceParityPolicies["reference-definition"]).toMatchObject({
      preview: {
        presentation: "not-rendered",
        sourceGeometry: "zero-height",
      },
      visualInactive: {
        presentation: "source",
        sourceGeometry: "occupies-layout",
      },
    });
    expect(markdownSurfaceParityPolicies["blank-line"]).toMatchObject({
      preview: {
        presentation: "not-rendered",
        sourceGeometry: "zero-height",
      },
      visualInactive: {
        presentation: "source",
        sourceGeometry: "occupies-layout",
      },
    });
  });
});
