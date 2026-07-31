import { describe, expect, it } from "vitest";
import { createWorkspaceArtifact } from "./workspaceArtifact";
import {
  createFullTextKnowledgeIndexAdapter,
  type KnowledgeIndexAdapter,
} from "./derivedKnowledgeIndex";

const createSnapshot = async () => ({
  capturedAt: "2026-07-30T00:00:00.000Z",
  artifacts: [
    await createWorkspaceArtifact({
      id: "guide",
      path: "docs/guide.md",
      kind: "document",
      content: {
        kind: "text",
        text: "# Guide\n\nTabula keeps Markdown as the source of truth.",
        encoding: "utf-8",
      },
    }),
    await createWorkspaceArtifact({
      id: "asset",
      path: "assets/logo.png",
      kind: "asset",
      content: { kind: "binary", bytes: new Uint8Array([1, 2, 3]) },
    }),
  ],
});

describe("derived knowledge index adapters", () => {
  it("builds a disposable index without mutating source artifacts", async () => {
    const snapshot = await createSnapshot();
    const sourceBefore = snapshot.artifacts[0]?.content;
    const adapter = createFullTextKnowledgeIndexAdapter();

    const index = await adapter.build(snapshot);
    const results = await adapter.query({ text: "source of truth" });

    expect(index).toMatchObject({
      providerId: "tabula-full-text",
      artifactCount: 2,
      entryCount: 2,
      disposable: true,
      sourceOfTruth: false,
      collaborationSource: false,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      providerId: "tabula-full-text",
      source: {
        artifactId: "guide",
        path: "docs/guide.md",
        sourceHash: snapshot.artifacts[0]?.sourceHash,
      },
    });
    expect(results[0]!.source.range.from).toBeGreaterThanOrEqual(0);
    expect(results[0]!.source.range.to).toBeGreaterThan(
      results[0]!.source.range.from,
    );
    expect(snapshot.artifacts[0]?.content).toEqual(sourceBefore);
  });

  it("updates derived entries while preserving the adapter boundary", async () => {
    const snapshot = await createSnapshot();
    const adapter: KnowledgeIndexAdapter =
      createFullTextKnowledgeIndexAdapter("replaceable-provider");
    await adapter.build(snapshot);
    const updated = await createWorkspaceArtifact({
      id: "guide",
      path: "docs/guide.md",
      kind: "document",
      content: {
        kind: "text",
        text: "# Guide\n\nGraph retrieval is derived and rebuildable.",
        encoding: "utf-8",
      },
    });

    const delta = await adapter.update?.([{
      type: "update",
      artifact: updated,
      expectedSourceHash: snapshot.artifacts[0]?.sourceHash,
    }]);

    expect(delta).toMatchObject({
      changedArtifactIds: ["guide"],
      removedArtifactIds: [],
      index: {
        providerId: "replaceable-provider",
        sourceOfTruth: false,
      },
    });
    expect(await adapter.query({ text: "source of truth" })).toEqual([]);
    expect(await adapter.query({ text: "rebuildable" })).toHaveLength(1);
  });

  it("can be discarded and rebuilt deterministically", async () => {
    const snapshot = await createSnapshot();
    const adapter = createFullTextKnowledgeIndexAdapter();
    const first = await adapter.build(snapshot);
    await adapter.dispose?.();
    expect(await adapter.query({ text: "Tabula" })).toEqual([]);
    const second = await adapter.build(snapshot);

    expect(second).toEqual(first);
    expect(await adapter.query({ text: "Tabula" })).toHaveLength(1);
  });

  it("maps the earliest matched term back to its exact source range", async () => {
    const artifact = await createWorkspaceArtifact({
      id: "mapped",
      path: "mapped.md",
      kind: "document",
      content: {
        kind: "text",
        text: "ＡＢＣ first and considerably-longer-second",
        encoding: "utf-8",
      },
    });
    const adapter = createFullTextKnowledgeIndexAdapter();
    await adapter.build({ artifacts: [artifact], capturedAt: "mapped" });

    const [result] = await adapter.query({
      text: "considerably-longer-second abc",
    });

    expect(result?.source.range).toEqual({ from: 0, to: 3 });
    expect(
      artifact.content.kind === "text"
        ? artifact.content.text.slice(
            result!.source.range.from,
            result!.source.range.to,
          )
        : "",
    ).toBe("ＡＢＣ");
  });
});
