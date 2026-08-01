import { describe, expect, it } from "vitest";
import { getWorkspaceFolderImportCopy } from "./workspaceFolderImportLocale";

describe("workspace folder import copy", () => {
  it("limits replacement confirmation to synchronization and data-loss risks", () => {
    const copy = getWorkspaceFolderImportCopy("en");

    expect(copy.title).toBe("Replace workspace?");
    expect(copy.replacementWarning).toContain("current documents and comments");
    expect(copy.replacementWarning).toContain("won’t stay in sync");
    expect(copy.importAndReplace).toBe("Import folder");
  });
});
