import {
  createWorkspaceArtifact,
  type ArtifactChange,
  type ExternalChangeResolution,
  type WorkspaceSnapshot,
} from "@tabula-md/tabula";

type Conflict = Extract<ExternalChangeResolution, { type: "conflict-review" }>;

export const replaceSnapshotArtifact = (
  snapshot: WorkspaceSnapshot,
  artifactId: string,
  replacement: WorkspaceSnapshot["artifacts"][number] | null,
): WorkspaceSnapshot => ({
  capturedAt: new Date().toISOString(),
  artifacts: replacement
    ? snapshot.artifacts.map((artifact) => artifact.id === artifactId
        ? { ...replacement, id: artifactId }
        : artifact)
    : snapshot.artifacts.filter((artifact) => artifact.id !== artifactId),
});

export const getKeepTabulaChanges = (
  resolution: Conflict,
): ArtifactChange[] => {
  const { change, local, external } = resolution;
  if (change.type === "deleted") return [{ type: "create", artifact: local }];
  if (change.type === "moved" && external) return [
    { type: "move", artifactId: local.id, fromPath: external.path, toPath: local.path },
    { type: "update", artifact: local },
  ];
  return [{
    type: "update",
    artifact: local,
    expectedSourceHash: external?.sourceHash,
  }];
};

export const createManualMergeArtifact = async (resolution: Conflict) => {
  const { local, external } = resolution;
  if (local.content.kind !== "text" || (external && external.content.kind !== "text")) {
    return null;
  }
  const externalText = external?.content.kind === "text" ? external.content.text : "";
  return createWorkspaceArtifact({
    ...local,
    content: {
      kind: "text",
      encoding: "utf-8",
      text: [
        "<<<<<<< Tabula",
        local.content.text,
        "=======",
        externalText,
        ">>>>>>> External",
      ].join("\n"),
    },
  });
};
