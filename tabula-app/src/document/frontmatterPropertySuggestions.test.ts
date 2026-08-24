import { describe, expect, it } from "vitest";
import {
  frontmatterPropertySuggestions,
  getFrontmatterPropertySuggestion,
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
});
