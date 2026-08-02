import { describe, expect, it } from "vitest";
import {
  connectLibraryBundle,
  parseLibraryBundle,
  TABULA_LIBRARY_FORMAT_VERSION,
  TABULA_LIBRARY_SCHEMA,
} from "./libraryBundleModel";

const bundle = {
  schema: TABULA_LIBRARY_SCHEMA,
  formatVersion: TABULA_LIBRARY_FORMAT_VERSION,
  id: "example.design-system",
  name: "Design system",
  version: "1.2.0",
  publisher: "Example",
  sourceUrl: "https://libraries.example.com/design-system",
  files: [
    { path: "tokens/colors.md", content: "# Colors" },
    { path: "README.md", content: "# Design system", encoding: "utf-8" },
  ],
};

describe("library bundle model", () => {
  it("parses and normalizes a valid bundle", () => {
    const parsed = parseLibraryBundle(bundle);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.bundle.files.map((file) => file.path)).toEqual([
      "README.md",
      "tokens/colors.md",
    ]);
    expect(parsed.bundle.files[1]?.encoding).toBe("utf-8");
  });

  it("rejects unsafe paths and duplicate files", () => {
    const parsed = parseLibraryBundle({
      ...bundle,
      files: [
        { path: "../secret.md", content: "secret" },
        { path: "README.md", content: "one" },
        { path: "README.md", content: "two" },
      ],
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toContain("files[0].path must be a safe relative path.");
    expect(parsed.errors.some((error) => error.includes("duplicate paths"))).toBe(true);
  });

  it("rejects insecure source URLs", () => {
    const parsed = parseLibraryBundle({ ...bundle, sourceUrl: "http://example.com/library" });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toContain("sourceUrl must use https.");
  });

  it("preserves the original connection time when updating a library", () => {
    const parsed = parseLibraryBundle(bundle);
    if (!parsed.ok) throw new Error("fixture should parse");
    const connected = connectLibraryBundle(parsed.bundle, "2026-08-01T00:00:00.000Z");
    const updated = connectLibraryBundle(
      { ...parsed.bundle, version: "1.3.0" },
      "2026-08-02T00:00:00.000Z",
      connected,
    );
    expect(updated.connectedAt).toBe("2026-08-01T00:00:00.000Z");
    expect(updated.updatedAt).toBe("2026-08-02T00:00:00.000Z");
    expect(updated.version).toBe("1.3.0");
  });
});
