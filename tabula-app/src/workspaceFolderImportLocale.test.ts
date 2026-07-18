import { describe, expect, it } from "vitest";
import { getWorkspaceFolderImportCopy } from "./workspaceFolderImportLocale";

describe("workspace folder import copy", () => {
  it("explains that opening a folder creates a browser copy", () => {
    const copy = getWorkspaceFolderImportCopy("en");

    expect(copy.title).toBe("Open folder");
    expect(copy.description).toContain("saves a copy in this browser");
    expect(copy.description).toContain("not changed or kept in sync");
  });
});
