import { describe, expect, it } from "vitest";
import { WORKSPACE_LANGUAGE_OPTIONS } from "../workspaceLocale";
import { getWorkspaceImportResultCopy } from "./workspaceImportResultLocale";

describe("workspace import result copy", () => {
  it("keeps the result and its next actions localized", () => {
    for (const { value } of WORKSPACE_LANGUAGE_OPTIONS) {
      const copy = getWorkspaceImportResultCopy(value);
      expect(copy.title.trim()).not.toBe("");
      expect(copy.description("0.1")).toContain("0.1");
      expect(copy.openRootIndex.trim()).not.toBe("");
      expect(copy.reviewWorkspace.trim()).not.toBe("");
      expect(copy.showDetails.trim()).not.toBe("");
      expect(copy.dismiss.trim()).not.toBe("");
    }
  });

  it("explains the 0.1 to 0.2 transition without claiming migration", () => {
    const copy = getWorkspaceImportResultCopy("en");

    expect(copy.v02Guidance).toContain("OKF 0.1");
    expect(copy.v02Guidance).toContain("OKF 0.2");
    expect(copy.v02Guidance).toContain("Review");
  });
});
