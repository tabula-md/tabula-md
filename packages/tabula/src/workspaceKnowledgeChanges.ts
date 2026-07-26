import { parseFrontmatterData } from "./markdown/parse";
import {
  createWorkspaceKnowledgeIndex,
  type WorkspaceKnowledgeIndex,
  type WorkspaceSourceDocument,
} from "./workspaceKnowledgeIndex";

export type WorkspaceKnowledgeBaseline = {
  capturedAt: string;
  documents: readonly WorkspaceSourceDocument[];
};

export type WorkspaceKnowledgeMetadataChange = {
  field:
    | "type"
    | "description"
    | "tags"
    | "resource"
    | "sources"
    | "generated"
    | "verified"
    | "status"
    | "stale_after";
  before?: string;
  after?: string;
};

export type WorkspaceKnowledgeChange = {
  documentId: string;
  kind: "added" | "modified" | "deleted";
  path: string;
  previousPath?: string;
  title: string;
  bodyChanged: boolean;
  metadataChanges: readonly WorkspaceKnowledgeMetadataChange[];
  relationshipDelta: number;
};

export type WorkspaceKnowledgeChangeSet = {
  baselineCapturedAt: string;
  changes: readonly WorkspaceKnowledgeChange[];
  addedCount: number;
  modifiedCount: number;
  deletedCount: number;
};

export type WorkspaceOkfLogCandidate = {
  path: "log.md";
  state: "missing" | "appendable" | "blocked";
  date: string;
  currentDocumentId?: string;
  currentMarkdown?: string;
  markdown?: string;
  changeSet: WorkspaceKnowledgeChangeSet;
};

const metadataFields = [
  "type",
  "description",
  "tags",
  "resource",
  "sources",
  "generated",
  "verified",
  "status",
  "stale_after",
] as const;

const compareText = (first: string, second: string) =>
  first < second ? -1 : first > second ? 1 : 0;

const isReservedDocument = (path: string) => {
  const basename = path.split("/").at(-1)?.toLocaleLowerCase();
  return basename === "index.md" || basename === "log.md";
};

const normalizeMarkdown = (markdown: string) =>
  markdown.replace(/\r\n/g, "\n").trimEnd();

const displayMetadataValue = (value: unknown) => {
  if (typeof value === "undefined") return undefined;
  if (typeof value === "string") return value.trim() || undefined;
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return value.map((entry) =>
      typeof entry === "string" ? entry : JSON.stringify(entry)
    ).join(", ");
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
};

const getMetadataChanges = (
  previousMarkdown: string,
  currentMarkdown: string,
): WorkspaceKnowledgeMetadataChange[] => {
  const previous = parseFrontmatterData(previousMarkdown).metadata;
  const current = parseFrontmatterData(currentMarkdown).metadata;
  return metadataFields.flatMap((field) => {
    const before = displayMetadataValue(previous[field]);
    const after = displayMetadataValue(current[field]);
    return before === after ? [] : [{
      field,
      ...(typeof before === "string" ? { before } : {}),
      ...(typeof after === "string" ? { after } : {}),
    }];
  });
};

const getRelationshipCount = (
  index: WorkspaceKnowledgeIndex,
  documentId: string,
) => (index.outgoingLinksByDocumentId.get(documentId) ?? []).filter((link) =>
  link.relation === "link" &&
  link.status === "resolved" &&
  link.targetDocumentId !== documentId
).length;

const getDocumentTitle = (
  index: WorkspaceKnowledgeIndex,
  documentId: string,
  fallbackPath: string,
) => index.analysesByDocumentId.get(documentId)?.title ||
  fallbackPath.split("/").at(-1)?.replace(/\.(?:md|markdown)$/i, "") ||
  fallbackPath;

export const captureWorkspaceKnowledgeBaseline = (
  documents: readonly WorkspaceSourceDocument[],
  capturedAt = new Date().toISOString(),
): WorkspaceKnowledgeBaseline => ({
  capturedAt,
  documents: documents.map((document) => ({ ...document })),
});

export const getWorkspaceKnowledgeChangeSet = (
  baseline: WorkspaceKnowledgeBaseline,
  currentDocuments: readonly WorkspaceSourceDocument[],
): WorkspaceKnowledgeChangeSet => {
  const previousDocuments = baseline.documents.filter(
    (document) => !isReservedDocument(document.path),
  );
  const nextDocuments = currentDocuments.filter(
    (document) => !isReservedDocument(document.path),
  );
  const previousById = new Map(previousDocuments.map((document) => [document.id, document]));
  const nextById = new Map(nextDocuments.map((document) => [document.id, document]));
  const previousIndex = createWorkspaceKnowledgeIndex(baseline.documents);
  const nextIndex = createWorkspaceKnowledgeIndex(currentDocuments);
  const changes: WorkspaceKnowledgeChange[] = [];

  for (const previous of previousDocuments) {
    const current = nextById.get(previous.id);
    if (!current) {
      changes.push({
        documentId: previous.id,
        kind: "deleted",
        path: previous.path,
        title: getDocumentTitle(previousIndex, previous.id, previous.path),
        bodyChanged: true,
        metadataChanges: [],
        relationshipDelta: -getRelationshipCount(previousIndex, previous.id),
      });
      continue;
    }
    const pathChanged = previous.path !== current.path;
    const markdownChanged =
      normalizeMarkdown(previous.markdown) !== normalizeMarkdown(current.markdown);
    if (!pathChanged && !markdownChanged) continue;
    const previousBody = normalizeMarkdown(parseFrontmatterData(previous.markdown).body);
    const currentBody = normalizeMarkdown(parseFrontmatterData(current.markdown).body);
    changes.push({
      documentId: current.id,
      kind: "modified",
      path: current.path,
      ...(pathChanged ? { previousPath: previous.path } : {}),
      title: getDocumentTitle(nextIndex, current.id, current.path),
      bodyChanged: previousBody !== currentBody,
      metadataChanges: getMetadataChanges(previous.markdown, current.markdown),
      relationshipDelta:
        getRelationshipCount(nextIndex, current.id) -
        getRelationshipCount(previousIndex, previous.id),
    });
  }

  for (const current of nextDocuments) {
    if (previousById.has(current.id)) continue;
    changes.push({
      documentId: current.id,
      kind: "added",
      path: current.path,
      title: getDocumentTitle(nextIndex, current.id, current.path),
      bodyChanged: true,
      metadataChanges: [],
      relationshipDelta: getRelationshipCount(nextIndex, current.id),
    });
  }

  changes.sort((first, second) =>
    compareText(first.path, second.path) || compareText(first.kind, second.kind));
  return {
    baselineCapturedAt: baseline.capturedAt,
    changes,
    addedCount: changes.filter((change) => change.kind === "added").length,
    modifiedCount: changes.filter((change) => change.kind === "modified").length,
    deletedCount: changes.filter((change) => change.kind === "deleted").length,
  };
};

const escapeLinkLabel = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");

const encodeLinkTarget = (value: string) => value
  .split("/")
  .map((segment) => encodeURIComponent(segment))
  .join("/");

const renderChange = (change: WorkspaceKnowledgeChange) => {
  if (change.kind === "deleted") {
    return [`- Removed \`${change.path}\``];
  }
  const verb = change.kind === "added" ? "Added" : "Updated";
  const lines = [
    `- ${verb} [${escapeLinkLabel(change.title)}](${encodeLinkTarget(change.path)})`,
  ];
  if (change.previousPath) {
    lines.push(`  - Path: \`${change.previousPath}\` → \`${change.path}\``);
  }
  for (const metadataChange of change.metadataChanges) {
    lines.push(
      `  - ${metadataChange.field}: ${
        metadataChange.before ? `\`${metadataChange.before}\`` : "not set"
      } → ${
        metadataChange.after ? `\`${metadataChange.after}\`` : "removed"
      }`,
    );
  }
  if (change.kind === "modified" && change.bodyChanged) {
    lines.push("  - Content changed");
  }
  if (change.relationshipDelta !== 0) {
    lines.push(
      `  - ${
        change.relationshipDelta > 0 ? "Added" : "Removed"
      } ${Math.abs(change.relationshipDelta)} ${
        Math.abs(change.relationshipDelta) === 1 ? "relationship" : "relationships"
      }`,
    );
  }
  return lines;
};

const renderLogEntry = (date: string, changeSet: WorkspaceKnowledgeChangeSet) => [
  `## ${date}`,
  "",
  ...changeSet.changes.flatMap(renderChange),
].join("\n");

const datedHeadingPattern = /^## (\d{4}-\d{2}-\d{2})\s*$/gm;

const appendLogEntry = (
  currentMarkdown: string,
  date: string,
  entry: string,
) => {
  const normalized = normalizeMarkdown(currentMarkdown);
  const headings = [...normalized.matchAll(datedHeadingPattern)];
  const h1 = /^# .+$/m.exec(normalized);
  if (!h1 || headings.some((heading, index) =>
    index > 0 && heading[1]! > headings[index - 1]![1]!
  )) {
    return undefined;
  }
  const matching = headings.find((heading) => heading[1] === date);
  if (matching?.index !== undefined) {
    const entryLines = entry.split("\n").slice(2).join("\n");
    const nextHeading = headings.find((heading) => (heading.index ?? 0) > matching.index!);
    const insertAt = nextHeading?.index ?? normalized.length;
    return `${normalized.slice(0, insertAt).trimEnd()}\n\n${entryLines}\n\n${
      normalized.slice(insertAt).trimStart()
    }`.trimEnd();
  }
  const firstHeadingIndex = headings[0]?.index ?? normalized.length;
  return `${normalized.slice(0, firstHeadingIndex).trimEnd()}\n\n${entry}\n\n${
    normalized.slice(firstHeadingIndex).trimStart()
  }`.trimEnd();
};

export const planWorkspaceOkfLog = (
  baseline: WorkspaceKnowledgeBaseline,
  currentDocuments: readonly WorkspaceSourceDocument[],
  date = new Date().toISOString().slice(0, 10),
): WorkspaceOkfLogCandidate => {
  const changeSet = getWorkspaceKnowledgeChangeSet(baseline, currentDocuments);
  const currentLog = currentDocuments.find(
    (document) => document.path.toLocaleLowerCase() === "log.md",
  );
  if (changeSet.changes.length === 0) {
    return {
      path: "log.md",
      state: currentLog ? "appendable" : "missing",
      date,
      ...(currentLog ? {
        currentDocumentId: currentLog.id,
        currentMarkdown: currentLog.markdown,
      } : {}),
      changeSet,
    };
  }
  const entry = renderLogEntry(date, changeSet);
  if (!currentLog) {
    return {
      path: "log.md",
      state: "missing",
      date,
      markdown: `# Log\n\n${entry}\n`,
      changeSet,
    };
  }
  const markdown = appendLogEntry(currentLog.markdown, date, entry);
  return {
    path: "log.md",
    state: markdown ? "appendable" : "blocked",
    date,
    currentDocumentId: currentLog.id,
    currentMarkdown: currentLog.markdown,
    ...(markdown ? { markdown: `${markdown}\n` } : {}),
    changeSet,
  };
};
