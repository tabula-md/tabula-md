import { describe, expect, it } from "vitest";
import { getWorkspaceFolderImportCopy } from "./workspaceFolderImportLocale";

describe("workspace folder import copy", () => {
  it("limits the import prompt to replacement and copy semantics", () => {
    const copy = getWorkspaceFolderImportCopy("en");

    expect(copy.title).toBe("Replace workspace?");
    expect(copy.description).toContain("browser copy");
    expect(copy.description).toContain("not kept in sync");
    expect(copy.warning).toBe("This replaces the current documents and comments.");
    expect(copy.open).toBe("Import folder");
  });
});
