import { describe, expect, it } from "vitest";
import { inspectFrontmatterData } from "./markdown/parse";
import { setOkfConceptType } from "./workspaceOkfConceptType";

describe("setOkfConceptType", () => {
  it("adds frontmatter with the user-selected type to a plain Markdown concept", () => {
    const result = setOkfConceptType("# Refund policy\n", "policy");

    expect(result).toMatchObject({ ok: true, changed: true });
    if (!result.ok) return;
    expect(result.markdown).toBe("---\ntype: policy\n---\n\n# Refund policy\n");
    expect(result.patches).toEqual([{
      from: 0,
      to: 0,
      insert: "---\ntype: policy\n---\n\n",
    }]);
  });

  it("preserves existing metadata and comments when setting a missing type", () => {
    const result = setOkfConceptType([
      "---",
      "# Keep this context",
      "owner: support",
      "tags: [billing, refund]",
      "---",
      "# Refund policy",
    ].join("\n"), "policy");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const inspection = inspectFrontmatterData(result.markdown);
    expect(inspection).toMatchObject({
      status: "valid",
      metadata: {
        owner: "support",
        tags: ["billing", "refund"],
        type: "policy",
      },
      body: "# Refund policy",
    });
    expect(result.markdown).toContain("# Keep this context");
  });

  it("replaces a non-string type and retains CRLF line endings", () => {
    const result = setOkfConceptType(
      "---\r\ntitle: Runbook\r\ntype: 42\r\n---\r\n# Runbook\r\n",
      "runbook",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.markdown).toContain("type: runbook\r\n---\r\n");
    expect(result.markdown.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("returns no patch when the normalized type is already present", () => {
    const markdown = "---\ntype: policy\n---\n# Policy";
    expect(setOkfConceptType(markdown, " policy ")).toEqual({
      ok: true,
      changed: false,
      markdown,
      patches: [],
    });
  });

  it("refuses empty types and invalid frontmatter without changing content", () => {
    expect(setOkfConceptType("# Policy", "  ")).toEqual({
      ok: false,
      reason: "empty_type",
    });
    expect(setOkfConceptType("---\ntype: [\n---\n# Policy", "policy")).toEqual({
      ok: false,
      reason: "invalid_frontmatter",
    });
  });
});
