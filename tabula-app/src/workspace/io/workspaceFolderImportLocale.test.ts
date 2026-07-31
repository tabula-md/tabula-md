import { describe, expect, it } from "vitest";
import { getWorkspaceFolderImportCopy } from "./workspaceFolderImportLocale";

describe("workspace folder import copy", () => {
  it("explains that importing a folder creates an unsynchronized browser copy", () => {
    const copy = getWorkspaceFolderImportCopy("en");

    expect(copy.title).toBe("Import folder");
    expect(copy.description).toContain("imports a copy into this browser");
    expect(copy.description).toContain("not synchronized");
    expect(copy.replacementWarning).toContain(
      "replaces the current browser workspace",
    );
    expect(copy.exportCurrentWorkspace).toBe("Export current workspace");
    expect(copy.summary(2, 3)).toBe("2 Markdown · 3 assets");
    expect(copy.supportNote).toContain("All non-Markdown files");
    expect(copy.supportNote).toContain("does not");
  });

  it("explains the detected standard separately from producer conventions", () => {
    const copy = getWorkspaceFolderImportCopy("en");
    const profile = {
      format: "okf",
      okfVersion: "0.1",
      conventions: ["openwiki"],
      linkSyntaxes: ["markdown-links"],
      evidence: [{ code: "okf-version", value: "0.1" }],
      markdownFileCount: 3,
      preservedSupportPaths: ["references/query.sql"],
      preservedSupportFileCount: 1,
    } as const;

    expect(copy.format(profile)).toBe("OKF 0.1");
    expect(profile.conventions.map(copy.convention)).toEqual(["OpenWiki"]);
    expect(profile.linkSyntaxes.map(copy.linkSyntax)).toEqual(["Markdown links"]);
    expect(copy.evidence(profile.evidence[0])).toBe(
      "Root index declares OKF 0.1.",
    );
  });
});
