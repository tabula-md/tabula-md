import { describe, expect, it } from "vitest";
import {
  createWorkspaceArtifact,
  planExternalChangeResolution,
  type WorkspaceSnapshot,
} from "@tabula-md/tabula";
import {
  applySafeExternalChanges,
  getConflictReview,
  resolveConflictSnapshots,
} from "./workspaceLiveFolderConflict";

const artifact = (id: string, path: string, text: string) =>
  createWorkspaceArtifact({
    id,
    path,
    content: { kind: "text", encoding: "utf-8", text },
  });

const snapshot = (
  artifacts: WorkspaceSnapshot["artifacts"],
): WorkspaceSnapshot => ({ artifacts, capturedAt: "2026-08-25T00:00:00Z" });

describe("live folder conflict recovery", () => {
  it("applies external-only changes without discarding unrelated local edits", async () => {
    const baselineReadme = await artifact("readme", "README.md", "Base");
    const baselineNotes = await artifact("notes", "notes.md", "Base notes");
    const localNotes = await artifact("notes", "notes.md", "Local notes");
    const externalReadme = await artifact("disk-readme", "README.md", "Folder");
    const resolutions = planExternalChangeResolution(
      snapshot([baselineReadme, baselineNotes]),
      snapshot([baselineReadme, localNotes]),
      snapshot([externalReadme, baselineNotes]),
    );

    const recovered = applySafeExternalChanges(
      snapshot([baselineReadme, localNotes]),
      resolutions,
    );

    expect(recovered.artifacts).toEqual([
      expect.objectContaining({ id: "readme", path: "README.md", sourceHash: externalReadme.sourceHash }),
      expect.objectContaining({ id: "notes", sourceHash: localNotes.sourceHash }),
    ]);
    expect(getConflictReview(resolutions)).toBeUndefined();
  });

  it("keeps simultaneous edits pending for explicit review", async () => {
    const baseline = await artifact("readme", "README.md", "Base");
    const local = await artifact("readme", "README.md", "Local");
    const external = await artifact("disk-readme", "README.md", "Folder");
    const resolutions = planExternalChangeResolution(
      snapshot([baseline]),
      snapshot([local]),
      snapshot([external]),
    );

    expect(getConflictReview(resolutions)).toMatchObject({
      type: "conflict-review",
      local,
      external,
    });
    expect(applySafeExternalChanges(snapshot([local]), resolutions).artifacts).toEqual([local]);
  });

  it("resolves one conflict while also accepting safe folder changes", async () => {
    const baselineReadme = await artifact("readme", "README.md", "Base");
    const baselineNotes = await artifact("notes", "notes.md", "Base notes");
    const localReadme = await artifact("readme", "README.md", "Local");
    const externalReadme = await artifact("disk-readme", "README.md", "Folder");
    const externalNotes = await artifact("disk-notes", "notes.md", "Folder notes");
    const baseline = snapshot([baselineReadme, baselineNotes]);
    const local = snapshot([localReadme, baselineNotes]);
    const external = snapshot([externalReadme, externalNotes]);
    const resolution = getConflictReview(
      planExternalChangeResolution(baseline, local, external),
    )!;

    const resolved = resolveConflictSnapshots({
      baseline,
      local,
      external,
      resolution,
      workspaceReplacement: externalReadme,
    });

    expect(resolved.local.artifacts).toEqual([
      expect.objectContaining({ id: "readme", sourceHash: externalReadme.sourceHash }),
      expect.objectContaining({ id: "notes", sourceHash: externalNotes.sourceHash }),
    ]);
    expect(resolved.baseline.artifacts).toEqual(resolved.local.artifacts);
  });
});
