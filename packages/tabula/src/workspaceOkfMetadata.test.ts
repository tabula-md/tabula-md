import { describe, expect, it } from "vitest";
import {
  getOkfFreshness,
  normalizeWorkspaceKnowledgeMetadata,
} from "./workspaceOkfMetadata";

describe("OKF metadata semantics", () => {
  it("normalizes a verified list and derives the highest trust tier", () => {
    const metadata = normalizeWorkspaceKnowledgeMetadata({
      verified: [
        { by: "process:nightly", at: "2026-07-23T00:00:00Z" },
        { by: "human:taeha", at: "2026-07-24T00:00:00Z" },
      ],
    });

    expect(metadata.verified).toHaveLength(2);
    expect(metadata.trustTier).toBe("human-reviewed");
  });

  it("keeps malformed optional families consumable without inventing values", () => {
    const metadata = normalizeWorkspaceKnowledgeMetadata({
      sources: [{ id: "missing-resource" }],
      generated: { by: "agent" },
      verified: "not-an-event",
      status: "unknown",
    });

    expect(metadata).toMatchObject({
      sources: [],
      verified: [],
      status: "stable",
      trustTier: "unverified",
    });
    expect(metadata.generated).toBeUndefined();
  });

  it("derives freshness from an absolute date", () => {
    expect(getOkfFreshness({ staleAfter: "2026-07-25" }, "2026-07-24")).toBe("current");
    expect(getOkfFreshness({ staleAfter: "2026-07-25" }, "2026-07-25")).toBe("stale");
    expect(getOkfFreshness({}, "2026-07-25")).toBe("current");
  });
});
