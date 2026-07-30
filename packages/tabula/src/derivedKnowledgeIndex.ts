import type {
  WorkspaceArtifact,
  WorkspaceArtifactKind,
} from "./workspaceArtifact";
import type {
  ArtifactChange,
  WorkspaceSnapshot,
} from "./workspaceSource";

export type KnowledgeSourceRange = {
  from: number;
  to: number;
};

export type KnowledgeSourceReference = {
  artifactId: string;
  path: string;
  sourceHash: string;
  range: KnowledgeSourceRange;
};

export type KnowledgeQuery = {
  text: string;
  limit?: number;
  artifactKinds?: readonly WorkspaceArtifactKind[];
  pathPrefix?: string;
};

export type KnowledgeResult = {
  id: string;
  providerId: string;
  score: number;
  excerpt: string;
  source: KnowledgeSourceReference;
};

export type DerivedKnowledgeIndex = {
  providerId: string;
  builtFromCapturedAt: string;
  artifactCount: number;
  entryCount: number;
  disposable: true;
  sourceOfTruth: false;
  collaborationSource: false;
};

export type DerivedKnowledgeIndexDelta = {
  index: DerivedKnowledgeIndex;
  changedArtifactIds: readonly string[];
  removedArtifactIds: readonly string[];
};

export interface KnowledgeIndexAdapter {
  readonly providerId: string;
  build(snapshot: WorkspaceSnapshot): Promise<DerivedKnowledgeIndex>;
  update?(
    changes: readonly ArtifactChange[],
  ): Promise<DerivedKnowledgeIndexDelta>;
  query(query: KnowledgeQuery): Promise<readonly KnowledgeResult[]>;
  dispose?(): Promise<void> | void;
}

type FullTextEntry = {
  artifactId: string;
  artifactKind: WorkspaceArtifactKind;
  path: string;
  sourceHash: string;
  text: string;
  normalizedText: string;
  from: number;
  to: number;
};

const cloneTextArtifact = (artifact: WorkspaceArtifact): WorkspaceArtifact => ({
  ...artifact,
  content: artifact.content.kind === "text"
    ? { ...artifact.content }
    : { kind: "binary", bytes: Uint8Array.from(artifact.content.bytes) },
});

const normalizeSearchText = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase();

const getSearchTerms = (query: string) =>
  [...new Set(
    normalizeSearchText(query)
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean),
  )];

const countOccurrences = (text: string, term: string) => {
  let count = 0;
  let from = 0;
  while (from < text.length) {
    const found = text.indexOf(term, from);
    if (found === -1) break;
    count += 1;
    from = found + Math.max(term.length, 1);
  }
  return count;
};

const createEntries = (artifact: WorkspaceArtifact): FullTextEntry[] => {
  if (artifact.content.kind !== "text") return [];
  const entries: FullTextEntry[] = [];
  const text = artifact.content.text;
  let lineFrom = 0;
  for (const line of text.split(/\r?\n/)) {
    const lineTo = lineFrom + line.length;
    if (line.trim()) {
      entries.push({
        artifactId: artifact.id,
        artifactKind: artifact.kind,
        path: artifact.path,
        sourceHash: artifact.sourceHash,
        text: line,
        normalizedText: normalizeSearchText(line),
        from: lineFrom,
        to: lineTo,
      });
    }
    const newlineLength = text.slice(lineTo, lineTo + 2) === "\r\n" ? 2 : 1;
    lineFrom = lineTo + newlineLength;
  }
  return entries;
};

export const createFullTextKnowledgeIndexAdapter = (
  providerId = "tabula-full-text",
): KnowledgeIndexAdapter => {
  let capturedAt = "";
  const artifacts = new Map<string, WorkspaceArtifact>();
  const entriesByArtifactId = new Map<string, readonly FullTextEntry[]>();

  const summary = (): DerivedKnowledgeIndex => ({
    providerId,
    builtFromCapturedAt: capturedAt,
    artifactCount: artifacts.size,
    entryCount: [...entriesByArtifactId.values()]
      .reduce((count, entries) => count + entries.length, 0),
    disposable: true,
    sourceOfTruth: false,
    collaborationSource: false,
  });

  const replaceArtifact = (artifact: WorkspaceArtifact) => {
    const clone = cloneTextArtifact(artifact);
    artifacts.set(clone.id, clone);
    entriesByArtifactId.set(clone.id, createEntries(clone));
  };

  return {
    providerId,
    build: async (snapshot) => {
      artifacts.clear();
      entriesByArtifactId.clear();
      capturedAt = snapshot.capturedAt;
      snapshot.artifacts.forEach(replaceArtifact);
      return summary();
    },
    update: async (changes) => {
      const changedArtifactIds = new Set<string>();
      const removedArtifactIds = new Set<string>();
      for (const change of changes) {
        if (change.type === "create" || change.type === "update") {
          replaceArtifact(change.artifact);
          changedArtifactIds.add(change.artifact.id);
          removedArtifactIds.delete(change.artifact.id);
          continue;
        }
        if (change.type === "move") {
          const artifact = artifacts.get(change.artifactId);
          if (!artifact || artifact.path !== change.fromPath) continue;
          replaceArtifact({ ...artifact, path: change.toPath });
          changedArtifactIds.add(change.artifactId);
          continue;
        }
        artifacts.delete(change.artifactId);
        entriesByArtifactId.delete(change.artifactId);
        changedArtifactIds.delete(change.artifactId);
        removedArtifactIds.add(change.artifactId);
      }
      return {
        index: summary(),
        changedArtifactIds: [...changedArtifactIds],
        removedArtifactIds: [...removedArtifactIds],
      };
    },
    query: async (query) => {
      const terms = getSearchTerms(query.text);
      if (terms.length === 0) return [];
      const allowedKinds = query.artifactKinds
        ? new Set(query.artifactKinds)
        : null;
      const limit = Math.max(0, query.limit ?? 20);
      return [...entriesByArtifactId.values()]
        .flat()
        .flatMap((entry): KnowledgeResult[] => {
          if (
            allowedKinds && !allowedKinds.has(entry.artifactKind)
            || query.pathPrefix && !entry.path.startsWith(query.pathPrefix)
          ) {
            return [];
          }
          const counts = terms.map((term) =>
            countOccurrences(entry.normalizedText, term)
          );
          if (counts.some((count) => count === 0)) return [];
          const firstMatch = Math.min(...terms.map((term) =>
            entry.normalizedText.indexOf(term)
          ));
          return [{
            id: `${providerId}:${entry.artifactId}:${entry.from}:${entry.to}`,
            providerId,
            score: counts.reduce((total, count) => total + count, 0),
            excerpt: entry.text.trim(),
            source: {
              artifactId: entry.artifactId,
              path: entry.path,
              sourceHash: entry.sourceHash,
              range: {
                from: entry.from + Math.max(firstMatch, 0),
                to: entry.from + Math.max(firstMatch, 0)
                  + terms[0]!.length,
              },
            },
          }];
        })
        .sort((first, second) =>
          second.score - first.score
          || first.source.path.localeCompare(second.source.path)
          || first.source.range.from - second.source.range.from
        )
        .slice(0, limit);
    },
    dispose: () => {
      artifacts.clear();
      entriesByArtifactId.clear();
      capturedAt = "";
    },
  };
};
