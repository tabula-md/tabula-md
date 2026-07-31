import { isMap, parseDocument } from "yaml";
import { inspectFrontmatterData } from "./markdown/parse";
import type { TextPatch } from "./textPatches";
import type { WorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";
import { isOkfActor } from "./workspaceOkfVersionAdapters";

export type OkfMigrationIssueCode =
  | "citation_requires_manual_source_id"
  | "generated_metadata_conflict"
  | "invalid_frontmatter"
  | "invalid_legacy_timestamp"
  | "producer_identity_required";

export type OkfMigrationIssue = {
  code: OkfMigrationIssueCode;
  documentId: string;
  path: string;
  value?: string;
};

export type OkfMigrationCandidate = {
  documentId: string;
  path: string;
  beforeMarkdown: string;
  markdown: string;
  changed: boolean;
  patches: readonly TextPatch[];
  issues: readonly OkfMigrationIssue[];
};

export type OkfMigrationPlan = {
  applicable: boolean;
  sourceVersion?: string;
  targetVersion: "0.2";
  candidates: readonly OkfMigrationCandidate[];
  changedFileCount: number;
  manualCitationCount: number;
  missingProducerCount: number;
  invalidDocumentCount: number;
  deletedFileCount: 0;
};

export type OkfMigrationOptions = {
  producerBy?: string;
};

export type OkfMigrationUpdate = {
  documentId: string;
  path: string;
  beforeMarkdown: string;
  markdown: string;
  patches: readonly TextPatch[];
};

type FrontmatterSource = {
  raw: string;
  rawStart: number;
  rawEnd: number;
  newline: "\n" | "\r\n";
};

type ParsedCitation = {
  id: string;
  title: string;
  resource: string;
};

const frontmatterClosingDelimiterPattern = /^(?:---|\.\.\.)\s*$/;

const getFrontmatterSource = (markdown: string): FrontmatterSource | null => {
  const openingLineEnd = markdown.indexOf("\n");
  if (openingLineEnd === -1) return null;
  const newline = markdown[openingLineEnd - 1] === "\r" ? "\r\n" : "\n";
  const rawStart = openingLineEnd + 1;
  let cursor = rawStart;
  while (cursor < markdown.length) {
    const nextLineBreak = markdown.indexOf("\n", cursor);
    const lineEnd = nextLineBreak === -1
      ? markdown.length
      : markdown[nextLineBreak - 1] === "\r"
        ? nextLineBreak - 1
        : nextLineBreak;
    if (frontmatterClosingDelimiterPattern.test(markdown.slice(cursor, lineEnd))) {
      return {
        raw: markdown.slice(rawStart, cursor),
        rawStart,
        rawEnd: cursor,
        newline,
      };
    }
    if (nextLineBreak === -1) return null;
    cursor = nextLineBreak + 1;
  }
  return null;
};

const createIssue = (
  documentId: string,
  path: string,
  code: OkfMigrationIssueCode,
  value?: string,
): OkfMigrationIssue => ({
  code,
  documentId,
  path,
  ...(value ? { value } : {}),
});

const isIsoTimestamp = (value: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && !Number.isNaN(Date.parse(value));

const slugSourceId = (value: string, fallback: string) => {
  const normalized = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || fallback;
};

const getUniqueSourceId = (baseId: string, usedIds: Set<string>) => {
  if (!usedIds.has(baseId)) {
    usedIds.add(baseId);
    return baseId;
  }
  let suffix = 2;
  while (usedIds.has(`${baseId}-${suffix}`)) suffix += 1;
  const id = `${baseId}-${suffix}`;
  usedIds.add(id);
  return id;
};

const migrateCitations = (
  body: string,
  existingSourceIds: readonly string[],
  newline: "\n" | "\r\n",
) => {
  const lines = body.split(/\r?\n/);
  const sectionStart = lines.findIndex((line) => /^#\s+Citations\s*$/i.test(line));
  if (sectionStart === -1) {
    return {
      body,
      citations: [] as ParsedCitation[],
      manualCitationCount: 0,
    };
  }
  let sectionEnd = lines.length;
  for (let index = sectionStart + 1; index < lines.length; index += 1) {
    if (/^#\s+/.test(lines[index] ?? "")) {
      sectionEnd = index;
      break;
    }
  }

  const usedIds = new Set(existingSourceIds);
  const citations: ParsedCitation[] = [];
  const manualLines: string[] = [];
  for (const line of lines.slice(sectionStart + 1, sectionEnd)) {
    if (!line.trim()) continue;
    const match = line.match(
      /^\s*(?:(?:[-*]|\[(\d+)])\s*)?\[([^\]]+)]\(([^)]+)\)\s*$/,
    );
    if (!match?.[2] || !match[3]) {
      manualLines.push(line);
      continue;
    }
    const baseId = match[1]
      ? `source-${match[1]}`
      : slugSourceId(match[2], `source-${citations.length + 1}`);
    citations.push({
      id: getUniqueSourceId(baseId, usedIds),
      title: match[2].trim(),
      resource: match[3].trim(),
    });
  }
  if (citations.length === 0) {
    return {
      body,
      citations,
      manualCitationCount: manualLines.length,
    };
  }

  const replacement = [
    ...(manualLines.length > 0 ? ["# Citations", "", ...manualLines, ""] : []),
    `Sources: ${citations.map((citation) => `[^${citation.id}]`).join(" ")}`,
    "",
    ...citations.map(
      (citation) =>
        `[^${citation.id}]: [${citation.title}](${citation.resource})`,
    ),
  ];
  const nextLines = [
    ...lines.slice(0, sectionStart),
    ...replacement,
    ...lines.slice(sectionEnd),
  ];
  return {
    body: nextLines.join(newline),
    citations,
    manualCitationCount: manualLines.length,
  };
};

const migrateRootIndex = (
  documentId: string,
  path: string,
  markdown: string,
): OkfMigrationCandidate => {
  const source = getFrontmatterSource(markdown);
  const inspection = inspectFrontmatterData(markdown);
  if (!source || inspection.status !== "valid") {
    const issue = createIssue(documentId, path, "invalid_frontmatter");
    return {
      documentId,
      path,
      beforeMarkdown: markdown,
      markdown,
      changed: false,
      patches: [],
      issues: [issue],
    };
  }
  const yaml = parseDocument(source.raw, { prettyErrors: false });
  if (yaml.errors.length > 0 || yaml.contents === null || !isMap(yaml.contents)) {
    const issue = createIssue(documentId, path, "invalid_frontmatter");
    return {
      documentId,
      path,
      beforeMarkdown: markdown,
      markdown,
      changed: false,
      patches: [],
      issues: [issue],
    };
  }
  yaml.set("okf_version", "0.2");
  const serialized = yaml.toString({ lineWidth: 0 });
  const insert = source.newline === "\n"
    ? serialized
    : serialized.replace(/\n/g, "\r\n");
  const next = `${markdown.slice(0, source.rawStart)}${insert}${markdown.slice(source.rawEnd)}`;
  return {
    documentId,
    path,
    beforeMarkdown: markdown,
    markdown: next,
    changed: next !== markdown,
    patches: next === markdown ? [] : [{ from: 0, to: markdown.length, insert: next }],
    issues: [],
  };
};

const migrateConcept = (
  documentId: string,
  path: string,
  markdown: string,
  producerBy: string | undefined,
): OkfMigrationCandidate => {
  const source = getFrontmatterSource(markdown);
  const inspection = inspectFrontmatterData(markdown);
  if (!source || inspection.status !== "valid") {
    return {
      documentId,
      path,
      beforeMarkdown: markdown,
      markdown,
      changed: false,
      patches: [],
      issues: [createIssue(documentId, path, "invalid_frontmatter")],
    };
  }
  const yaml = parseDocument(source.raw, { prettyErrors: false });
  if (yaml.errors.length > 0 || yaml.contents === null || !isMap(yaml.contents)) {
    return {
      documentId,
      path,
      beforeMarkdown: markdown,
      markdown,
      changed: false,
      patches: [],
      issues: [createIssue(documentId, path, "invalid_frontmatter")],
    };
  }

  const issues: OkfMigrationIssue[] = [];
  const metadata = yaml.toJS() as Record<string, unknown>;
  const timestamp = typeof metadata.timestamp === "string"
    ? metadata.timestamp.trim()
    : undefined;
  if (typeof metadata.timestamp !== "undefined") {
    if (!timestamp || !isIsoTimestamp(timestamp)) {
      issues.push(createIssue(
        documentId,
        path,
        "invalid_legacy_timestamp",
        String(metadata.timestamp),
      ));
    } else if (typeof metadata.generated !== "undefined") {
      issues.push(createIssue(documentId, path, "generated_metadata_conflict"));
    } else if (!producerBy || !isOkfActor(producerBy)) {
      issues.push(createIssue(documentId, path, "producer_identity_required"));
    } else {
      yaml.set("generated", { by: producerBy, at: timestamp });
      yaml.delete("timestamp");
    }
  }

  const existingSources = Array.isArray(metadata.sources)
    ? metadata.sources
    : [];
  const existingSourceIds = existingSources.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return [];
    }
    const id = (candidate as Record<string, unknown>).id;
    return typeof id === "string" && id.trim() ? [id.trim()] : [];
  });
  const citations = migrateCitations(
    inspection.body,
    existingSourceIds,
    source.newline,
  );
  if (citations.manualCitationCount > 0) {
    for (let index = 0; index < citations.manualCitationCount; index += 1) {
      issues.push(createIssue(
        documentId,
        path,
        "citation_requires_manual_source_id",
      ));
    }
  }
  if (citations.citations.length > 0) {
    yaml.set("sources", [
      ...existingSources,
      ...citations.citations.map(({ id, title, resource }) => ({
        id,
        resource,
        title,
      })),
    ]);
  }

  const serialized = yaml.toString({ lineWidth: 0 });
  const frontmatter = source.newline === "\n"
    ? serialized
    : serialized.replace(/\n/g, "\r\n");
  const next = [
    markdown.slice(0, source.rawStart),
    frontmatter,
    "---",
    source.newline,
    citations.body,
  ].join("");
  return {
    documentId,
    path,
    beforeMarkdown: markdown,
    markdown: next,
    changed: next !== markdown,
    patches: next === markdown ? [] : [{ from: 0, to: markdown.length, insert: next }],
    issues,
  };
};

export const planOkf01To02Migration = (
  index: WorkspaceKnowledgeIndex,
  options: OkfMigrationOptions = {},
): OkfMigrationPlan => {
  const rootIndex = [...index.documentsById.values()]
    .find((document) => document.path === "index.md");
  const rootInspection = rootIndex
    ? inspectFrontmatterData(rootIndex.markdown)
    : undefined;
  const declaredVersion = rootInspection?.status === "valid"
    && typeof rootInspection.metadata.okf_version === "string"
    ? rootInspection.metadata.okf_version.trim()
    : undefined;
  if (!rootIndex || declaredVersion !== "0.1") {
    return {
      applicable: false,
      ...(declaredVersion ? { sourceVersion: declaredVersion } : {}),
      targetVersion: "0.2",
      candidates: [],
      changedFileCount: 0,
      manualCitationCount: 0,
      missingProducerCount: 0,
      invalidDocumentCount: 0,
      deletedFileCount: 0,
    };
  }

  const candidates = [...index.documentsById.values()]
    .filter((document) => {
      const basename = document.path.split("/").at(-1);
      return document.path === "index.md"
        || (
          document.path.endsWith(".md")
          && basename !== "index.md"
          && basename !== "log.md"
        );
    })
    .sort((first, second) => first.path.localeCompare(second.path))
    .map((document) =>
      document.path === "index.md"
        ? migrateRootIndex(document.id, document.path, document.markdown)
        : migrateConcept(
            document.id,
            document.path,
            document.markdown,
            options.producerBy?.trim(),
          ));
  const issues = candidates.flatMap((candidate) => candidate.issues);
  return {
    applicable: true,
    sourceVersion: "0.1",
    targetVersion: "0.2",
    candidates,
    changedFileCount: candidates.filter((candidate) => candidate.changed).length,
    manualCitationCount: issues.filter(
      (issue) => issue.code === "citation_requires_manual_source_id",
    ).length,
    missingProducerCount: issues.filter(
      (issue) => issue.code === "producer_identity_required",
    ).length,
    invalidDocumentCount: new Set(
      issues
        .filter((issue) =>
          issue.code === "invalid_frontmatter"
          || issue.code === "invalid_legacy_timestamp")
        .map((issue) => issue.documentId),
    ).size,
    deletedFileCount: 0,
  };
};

export const getOkfMigrationUpdates = (
  plan: OkfMigrationPlan,
  selectedDocumentIds: readonly string[] = plan.candidates.map(
    (candidate) => candidate.documentId,
  ),
): OkfMigrationUpdate[] => {
  if (!plan.applicable) return [];
  const selected = new Set(selectedDocumentIds);
  return plan.candidates.flatMap((candidate) =>
    candidate.changed && selected.has(candidate.documentId)
      ? [{
          documentId: candidate.documentId,
          path: candidate.path,
          beforeMarkdown: candidate.beforeMarkdown,
          markdown: candidate.markdown,
          patches: candidate.patches,
        }]
      : []);
};
