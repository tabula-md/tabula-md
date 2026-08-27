import { describe, expect, it } from "vitest";
import {
  frontmatterPropertySuggestions,
  getFrontmatterPropertySuggestion,
  getSuggestedFrontmatterPropertyState,
  getWorkspaceFrontmatterPropertySuggestions,
} from "./frontmatterPropertySuggestions";

describe("frontmatter property suggestions", () => {
  it("suggests OKF value shapes without restricting arbitrary keys", () => {
    expect(getFrontmatterPropertySuggestion(" tags ")).toMatchObject({
      key: "tags",
      type: "list",
      draft: "[]",
    });
    expect(getFrontmatterPropertySuggestion("stale_after")).toMatchObject({
      type: "datetime",
    });
    expect(getFrontmatterPropertySuggestion("team_specific_signal")).toBeUndefined();
  });

  it("prioritizes fields that are already used in workspace documents", () => {
    const suggestions = getWorkspaceFrontmatterPropertySuggestions([
      "---\nowner: team:platform\npriority: 2\n---\n# One",
      "---\nowner: team:operations\npriority: 3\n---\n# Two",
      "---\nowner: [\n---\nInvalid",
    ]);

    expect(suggestions[0]).toMatchObject({
      key: "owner",
      type: "text",
      draft: "",
      usageCount: 2,
    });
    expect(suggestions[1]).toMatchObject({
      key: "priority",
      type: "number",
      draft: "0",
      usageCount: 2,
    });
  });

  it("covers core, trust, lifecycle, provenance, and computation hints", () => {
    expect(frontmatterPropertySuggestions.map(({ key }) => key)).toEqual(expect.arrayContaining([
      "type",
      "generated",
      "verified",
      "stale_after",
      "sources",
      "runtime",
      "parameters",
      "executor",
      "attester",
    ]));
  });

  it("marks workspace fields whose documents disagree about value type", () => {
    expect(getWorkspaceFrontmatterPropertySuggestions([
      "---\nowner: platform\n---",
      "---\nowner: [platform]\n---",
    ])[0]).toMatchObject({
      key: "owner",
      usageCount: 2,
      hasMixedTypes: true,
    });
  });

  it("resets arbitrary keys to text and offers optional OKF structure templates", () => {
    expect(getSuggestedFrontmatterPropertyState("team_specific_signal")).toEqual({
      type: "text",
      draft: "",
    });
    expect(getSuggestedFrontmatterPropertyState("sources")).toEqual({
      type: "list",
      draft: '- resource: ""',
    });
    expect(getSuggestedFrontmatterPropertyState("parameters")).toEqual({
      type: "list",
      draft: '- name: ""\n  type: string\n  required: true',
    });
    expect(getSuggestedFrontmatterPropertyState("executor")).toEqual({
      type: "object",
      draft: 'resource: ""\nreceipt: []',
    });
    expect(getFrontmatterPropertySuggestion("generated")?.typeHints).toEqual([
      { path: ["at"], type: "datetime" },
    ]);
    expect(getFrontmatterPropertySuggestion("verified")?.typeHints).toEqual([
      { path: [0, "at"], type: "datetime" },
    ]);
  });
});
