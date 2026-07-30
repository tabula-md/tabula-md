import { describe, expect, it } from "vitest";
import { getWorkspaceFolderImportCopy } from "./workspaceFolderImportLocale";

describe("workspace folder import copy", () => {
  it("explains that opening a folder creates a browser copy", () => {
    const copy = getWorkspaceFolderImportCopy("en");

    expect(copy.title).toBe("Open folder");
    expect(copy.description).toContain("saves a copy in this browser");
    expect(copy.description).toContain("not changed or kept in sync");
    expect(copy.description).toContain("recognized workspace metadata");
    expect(copy.contains(2, 1)).toBe("2 files · 1 folder");
  });

  it("explains the detected standard separately from producer conventions", () => {
    const copy = getWorkspaceFolderImportCopy("en");
    const profile = {
      syntaxes: ["gfm"],
      conventions: ["openwiki"],
      schemas: [{ id: "okf", version: "0.1" }],
      workflows: [],
      agentInstructions: [],
      deliveries: [],
      linkSyntaxes: ["markdown-links"],
      evidence: [{ code: "okf-version", value: "0.1" }],
      preservedSupportFileCount: 1,
      ignoredFileCount: 2,
    } as const;

    expect(copy.format(profile)).toBe("OKF 0.1");
    expect(profile.conventions.map(copy.convention)).toEqual(["OpenWiki"]);
    expect(profile.linkSyntaxes.map(copy.linkSyntax)).toEqual(["Markdown links"]);
    expect(copy.fileHandling(1, 2)).toBe(
      "1 support file preserved. 2 unsupported files skipped",
    );
    expect(copy.evidence(profile.evidence[0])).toBe(
      "Root index declares OKF 0.1.",
    );
  });
});
