import { describe, expect, it } from "vitest";
import { parseFrontmatterData } from "./markdown/parse";
import { appendOkfVerification } from "./workspaceOkfVerification";

describe("appendOkfVerification", () => {
  it("records a human verification while preserving extension metadata", () => {
    const markdown = [
      "---",
      "type: Policy",
      "owner: platform",
      "generated: { by: agent:research, at: 2026-07-20T00:00:00Z }",
      "---",
      "",
      "# Policy",
    ].join("\n");

    const result = appendOkfVerification(
      markdown,
      "taeha",
      "2026-07-27T08:30:00+09:00",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.verification).toEqual({
      by: "human:taeha",
      at: "2026-07-26T23:30:00.000Z",
    });
    expect(parseFrontmatterData(result.markdown).metadata).toMatchObject({
      type: "Policy",
      owner: "platform",
      generated: {
        by: "agent:research",
        at: "2026-07-20T00:00:00Z",
      },
      verified: [{
        by: "human:taeha",
        at: "2026-07-26T23:30:00.000Z",
      }],
    });
    expect(result.markdown).toContain("# Policy");
  });

  it("normalizes a prior scalar verification into an append-only history", () => {
    const markdown = [
      "---",
      "type: Guide",
      "verified: { by: agent:check, at: 2026-07-20T00:00:00Z }",
      "---",
      "",
      "# Guide",
    ].join("\n");

    const result = appendOkfVerification(
      markdown,
      "human:reviewer",
      "2026-07-27T00:00:00Z",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(parseFrontmatterData(result.markdown).metadata.verified).toEqual([
      { by: "agent:check", at: "2026-07-20T00:00:00Z" },
      { by: "human:reviewer", at: "2026-07-27T00:00:00.000Z" },
    ]);
  });

  it("refuses malformed frontmatter and malformed verification history", () => {
    expect(appendOkfVerification("# No frontmatter", "taeha")).toEqual({
      ok: false,
      reason: "invalid_frontmatter",
    });
    expect(appendOkfVerification(
      "---\ntype: Guide\nverified: wrong\n---\n",
      "taeha",
    )).toEqual({
      ok: false,
      reason: "invalid_verified",
    });
  });
});
