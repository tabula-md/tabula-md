import { describe, expect, it } from "vitest";
import { createWorkspaceArtifact } from "./workspaceArtifact";
import {
  createBrowserCopySourceAdapter,
  createImportedArchiveSourceAdapter,
  getExternalArtifactChanges,
  planExternalChangeResolution,
  type WorkspaceSnapshot,
} from "./workspaceSource";

const artifact = (id: string, path: string, text: string) =>
  createWorkspaceArtifact({
    id,
    path,
    content: { kind: "text", text, encoding: "utf-8" },
  });

const snapshot = (
  artifacts: WorkspaceSnapshot["artifacts"],
): WorkspaceSnapshot => ({
  artifacts,
  capturedAt: "2026-07-30T00:00:00.000Z",
});

describe("workspace source adapters", () => {
  it("keeps imported archives read-only and browser copies writable", async () => {
    const readme = await artifact("readme", "README.md", "# One");
    const archive = createImportedArchiveSourceAdapter(
      { id: "zip", kind: "imported-archive", label: "docs.zip" },
      snapshot([readme]),
    );
    const browser = createBrowserCopySourceAdapter(snapshot([readme]));

    expect(archive.getCapabilities().canWrite).toBe(false);
    expect(browser.getCapabilities().canWrite).toBe(true);
    const next = await artifact("readme", "README.md", "# Two");
    await expect(browser.writeChanges?.([
      {
        type: "update",
        artifact: next,
        expectedSourceHash: readme.sourceHash,
      },
    ])).resolves.toMatchObject({ ok: true });
    expect((await browser.readSnapshot()).artifacts[0]?.sourceHash)
      .toBe(next.sourceHash);
  });

  it("detects updates, deletes, creates, and hash-preserving moves", async () => {
    const first = await artifact("first", "first.md", "# First");
    const second = await artifact("second", "second.md", "# Second");
    const changed = await artifact("first-next", "first.md", "# Changed");
    const moved = { ...second, path: "archive/second.md" };
    const added = await artifact("added", "added.md", "# Added");

    expect(getExternalArtifactChanges(
      snapshot([first, second]),
      snapshot([changed, moved, added]),
    ).map((change) => change.type).sort()).toEqual([
      "created",
      "moved",
      "updated",
    ]);
  });

  it("requires review when local and external versions both changed", async () => {
    const baseline = await artifact("readme", "README.md", "# Base");
    const local = await artifact("readme", "README.md", "# Local");
    const external = await artifact("disk", "README.md", "# Disk");
    const result = planExternalChangeResolution(
      snapshot([baseline]),
      snapshot([local]),
      snapshot([external]),
    );

    expect(result).toEqual([
      expect.objectContaining({
        type: "conflict-review",
        reason: "both-edited",
        baseline,
        local,
        external,
      }),
    ]);
  });

  it("safe-refreshes external-only changes and reviews delete conflicts", async () => {
    const baseline = await artifact("readme", "README.md", "# Base");
    const external = await artifact("disk", "README.md", "# Disk");
    expect(planExternalChangeResolution(
      snapshot([baseline]),
      snapshot([baseline]),
      snapshot([external]),
    )[0]?.type).toBe("safe-refresh");

    const local = await artifact("readme", "README.md", "# Local");
    expect(planExternalChangeResolution(
      snapshot([baseline]),
      snapshot([local]),
      snapshot([]),
    )[0]).toMatchObject({
      type: "conflict-review",
      reason: "external-delete",
      local,
      external: null,
    });
  });
});
