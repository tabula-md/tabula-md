import {
  cloneWorkspaceArtifact,
  type WorkspaceArtifact,
} from "./workspaceArtifact";

export type WorkspaceSourceKind =
  | "browser-copy"
  | "live-folder"
  | "imported-archive"
  | "collaboration-room";

export type WorkspaceSource = {
  id: string;
  kind: WorkspaceSourceKind;
  label?: string;
};

export type WorkspaceSourceCapabilities = {
  canRead: boolean;
  canWrite: boolean;
  canCreate: boolean;
  canMove: boolean;
  canDelete: boolean;
  canCheckExternalChanges: boolean;
};

export type WorkspaceSnapshot = {
  artifacts: readonly WorkspaceArtifact[];
  capturedAt: string;
};

export type ArtifactChange =
  | { type: "create"; artifact: WorkspaceArtifact }
  | { type: "update"; artifact: WorkspaceArtifact; expectedSourceHash?: string }
  | { type: "move"; artifactId: string; fromPath: string; toPath: string }
  | { type: "delete"; artifactId: string; path: string; expectedSourceHash?: string };

export type WriteResult =
  | { ok: true; snapshot: WorkspaceSnapshot }
  | { ok: false; reason: "permission" | "conflict" | "unsupported" | "unknown"; error?: unknown };

export type ExternalArtifactChange =
  | { type: "created"; external: WorkspaceArtifact }
  | { type: "updated"; baseline: WorkspaceArtifact; external: WorkspaceArtifact }
  | { type: "deleted"; baseline: WorkspaceArtifact }
  | {
      type: "moved";
      baseline: WorkspaceArtifact;
      external: WorkspaceArtifact;
    };

export type ExternalChangeResult = {
  snapshot: WorkspaceSnapshot;
  changes: readonly ExternalArtifactChange[];
};

export interface WorkspaceSourceAdapter {
  readonly source: WorkspaceSource;
  readSnapshot(): Promise<WorkspaceSnapshot>;
  getCapabilities(): WorkspaceSourceCapabilities;
  writeChanges?(changes: readonly ArtifactChange[]): Promise<WriteResult>;
  checkExternalChanges?(
    baseline: WorkspaceSnapshot,
  ): Promise<ExternalChangeResult>;
}

const nowIso = () => new Date().toISOString();

const cloneSnapshot = (snapshot: WorkspaceSnapshot): WorkspaceSnapshot => ({
  capturedAt: snapshot.capturedAt,
  artifacts: snapshot.artifacts.map(cloneWorkspaceArtifact),
});

const readOnlyCapabilities: WorkspaceSourceCapabilities = {
  canRead: true,
  canWrite: false,
  canCreate: false,
  canMove: false,
  canDelete: false,
  canCheckExternalChanges: false,
};

export const createImportedArchiveSourceAdapter = (
  source: WorkspaceSource,
  snapshot: WorkspaceSnapshot,
): WorkspaceSourceAdapter => ({
  source: { ...source, kind: "imported-archive" },
  getCapabilities: () => ({ ...readOnlyCapabilities }),
  readSnapshot: async () => cloneSnapshot(snapshot),
});

export const createBrowserCopySourceAdapter = (
  initialSnapshot: WorkspaceSnapshot,
): WorkspaceSourceAdapter => {
  let snapshot = cloneSnapshot(initialSnapshot);
  return {
    source: { id: "browser-copy", kind: "browser-copy" },
    getCapabilities: () => ({
      canRead: true,
      canWrite: true,
      canCreate: true,
      canMove: true,
      canDelete: true,
      canCheckExternalChanges: false,
    }),
    readSnapshot: async () => cloneSnapshot(snapshot),
    writeChanges: async (changes) => {
      const artifacts = new Map(
        snapshot.artifacts.map((artifact) => [
          artifact.id,
          cloneWorkspaceArtifact(artifact),
        ]),
      );
      for (const change of changes) {
        if (change.type === "create" || change.type === "update") {
          const existing = artifacts.get(change.artifact.id);
          if (
            change.type === "update" &&
            change.expectedSourceHash &&
            existing?.sourceHash !== change.expectedSourceHash
          ) {
            return { ok: false, reason: "conflict" };
          }
          artifacts.set(
            change.artifact.id,
            cloneWorkspaceArtifact(change.artifact),
          );
        } else if (change.type === "move") {
          const existing = artifacts.get(change.artifactId);
          if (!existing || existing.path !== change.fromPath) {
            return { ok: false, reason: "conflict" };
          }
          artifacts.set(change.artifactId, {
            ...existing,
            path: change.toPath,
          });
        } else {
          const existing = artifacts.get(change.artifactId);
          if (
            !existing ||
            existing.path !== change.path ||
            (
              change.expectedSourceHash &&
              existing.sourceHash !== change.expectedSourceHash
            )
          ) {
            return { ok: false, reason: "conflict" };
          }
          artifacts.delete(change.artifactId);
        }
      }
      snapshot = {
        artifacts: [...artifacts.values()],
        capturedAt: nowIso(),
      };
      return { ok: true, snapshot: cloneSnapshot(snapshot) };
    },
  };
};

const artifactsByPath = (snapshot: WorkspaceSnapshot) =>
  new Map(snapshot.artifacts.map((artifact) => [artifact.path, artifact]));

export const getExternalArtifactChanges = (
  baseline: WorkspaceSnapshot,
  external: WorkspaceSnapshot,
): ExternalArtifactChange[] => {
  const baselineByPath = artifactsByPath(baseline);
  const externalByPath = artifactsByPath(external);
  const changes: ExternalArtifactChange[] = [];
  const deleted: WorkspaceArtifact[] = [];
  const created: WorkspaceArtifact[] = [];

  for (const artifact of baseline.artifacts) {
    const next = externalByPath.get(artifact.path);
    if (!next) {
      deleted.push(artifact);
    } else if (next.sourceHash !== artifact.sourceHash) {
      changes.push({ type: "updated", baseline: artifact, external: next });
    }
  }
  for (const artifact of external.artifacts) {
    if (!baselineByPath.has(artifact.path)) created.push(artifact);
  }

  const remainingCreated = new Set(created);
  for (const artifact of deleted) {
    const moved = created.find(
      (candidate) =>
        remainingCreated.has(candidate) &&
        candidate.sourceHash === artifact.sourceHash,
    );
    if (moved) {
      remainingCreated.delete(moved);
      changes.push({ type: "moved", baseline: artifact, external: moved });
    } else {
      changes.push({ type: "deleted", baseline: artifact });
    }
  }
  for (const artifact of remainingCreated) {
    changes.push({ type: "created", external: artifact });
  }
  return changes;
};

export type ExternalChangeResolution =
  | {
      type: "safe-refresh";
      change: ExternalArtifactChange;
      external: WorkspaceArtifact | null;
    }
  | {
      type: "conflict-review";
      reason: "both-edited" | "external-delete" | "external-move";
      change: ExternalArtifactChange;
      baseline: WorkspaceArtifact;
      local: WorkspaceArtifact;
      external: WorkspaceArtifact | null;
    };

export const planExternalChangeResolution = (
  baseline: WorkspaceSnapshot,
  local: WorkspaceSnapshot,
  external: WorkspaceSnapshot,
): ExternalChangeResolution[] => {
  const localById = new Map(local.artifacts.map((artifact) => [artifact.id, artifact]));
  return getExternalArtifactChanges(baseline, external).map((change) => {
    const baselineArtifact =
      change.type === "created" ? undefined : change.baseline;
    const localArtifact = baselineArtifact
      ? localById.get(baselineArtifact.id)
      : undefined;
    const localChanged = Boolean(
      baselineArtifact &&
      localArtifact &&
      (
        localArtifact.sourceHash !== baselineArtifact.sourceHash ||
        localArtifact.path !== baselineArtifact.path
      ),
    );
    const externalArtifact =
      change.type === "created" || change.type === "updated" || change.type === "moved"
        ? change.external
        : null;
    if (!baselineArtifact || !localChanged || !localArtifact) {
      return {
        type: "safe-refresh",
        change,
        external: externalArtifact,
      };
    }
    return {
      type: "conflict-review",
      reason:
        change.type === "deleted"
          ? "external-delete"
          : change.type === "moved"
            ? "external-move"
            : "both-edited",
      change,
      baseline: baselineArtifact,
      local: localArtifact,
      external: externalArtifact,
    };
  });
};
