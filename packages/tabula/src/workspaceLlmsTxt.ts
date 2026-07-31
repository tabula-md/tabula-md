import type { WorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";

export type LlmsTxtValidationIssueCode =
  | "llms_h1_missing"
  | "llms_h1_multiple"
  | "llms_link_broken"
  | "llms_link_invalid"
  | "llms_optional_duplicate";

export type LlmsTxtValidationIssue = {
  code: LlmsTxtValidationIssueCode;
  line?: number;
  value?: string;
};

export type LlmsTxtValidationReport = {
  valid: boolean;
  title?: string;
  sections: readonly {
    heading: string;
    optional: boolean;
    links: readonly { label: string; target: string; external: boolean }[];
  }[];
  issues: readonly LlmsTxtValidationIssue[];
  externalLinkCount: number;
  internalLinkCount: number;
};

export type LlmsTxtExportSection = {
  heading: string;
  documentIds: readonly string[];
  optional?: boolean;
};

export type LlmsTxtExportOptions = {
  title: string;
  summary?: string;
  details?: string;
  sections: readonly LlmsTxtExportSection[];
  includePrivateDocumentIds?: readonly string[];
  existingLlmsTxt?: string;
};

export type LlmsTxtExportCandidate = {
  markdown: string;
  includedDocumentIds: readonly string[];
  excludedPrivateDocumentIds: readonly string[];
  requiresPrivateReview: boolean;
  existingFilePreserved: boolean;
  overwritesExistingFile: false;
  workspaceSourceChanged: false;
};

const getPrivateDocumentIds = (index: WorkspaceKnowledgeIndex) => new Set(
  [...index.analysesByDocumentId.values()].flatMap((analysis) => {
    const visibility = analysis.metadata.visibility;
    const privateFlag = analysis.metadata.private;
    const tags = Array.isArray(analysis.metadata.tags)
      ? analysis.metadata.tags
      : [];
    return visibility === "private"
      || privateFlag === true
      || tags.some((tag) =>
        typeof tag === "string" && tag.toLowerCase() === "private"
      )
      ? [analysis.documentId]
      : [];
  }),
);

const normalizeInternalTarget = (target: string) => {
  const withoutFragment = target.split("#")[0] ?? "";
  try {
    return decodeURIComponent(withoutFragment)
      .replace(/^\/+/, "")
      .replace(/^\.\//, "");
  } catch {
    return "";
  }
};

export const validateLlmsTxt = (
  source: string,
  availablePaths: readonly string[] = [],
): LlmsTxtValidationReport => {
  const text = source.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);
  const issues: LlmsTxtValidationIssue[] = [];
  const h1Lines = lines.flatMap((line, index) =>
    /^#\s+[^#]/.test(line) ? [{ index, title: line.replace(/^#\s+/, "").trim() }] : []
  );
  if (h1Lines.length === 0) {
    issues.push({ code: "llms_h1_missing" });
  } else if (h1Lines.length > 1) {
    issues.push({ code: "llms_h1_multiple", value: String(h1Lines.length) });
  }
  const pathSet = new Set(availablePaths);
  const sections: LlmsTxtValidationReport["sections"][number][] = [];
  let currentSection: LlmsTxtValidationReport["sections"][number] | undefined;
  let externalLinkCount = 0;
  let internalLinkCount = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const heading = line.match(/^##\s+(.+?)\s*$/)?.[1];
    if (heading) {
      currentSection = {
        heading,
        optional: heading.toLowerCase() === "optional",
        links: [],
      };
      sections.push(currentSection);
      continue;
    }
    if (!/^\s*[-*]\s+/.test(line)) continue;
    const link = line.match(
      /^\s*[-*]\s+\[([^\]]+)]\(([^)\s]+)\)(?:\s*:\s*.*)?\s*$/,
    );
    if (!link?.[1] || !link[2] || !currentSection) {
      issues.push({
        code: "llms_link_invalid",
        line: index + 1,
        value: line.trim(),
      });
      continue;
    }
    const external = /^[a-z][a-z0-9+.-]*:/i.test(link[2]);
    if (external) {
      externalLinkCount += 1;
    } else {
      internalLinkCount += 1;
      const targetPath = normalizeInternalTarget(link[2]);
      if (!targetPath || !pathSet.has(targetPath)) {
        issues.push({
          code: "llms_link_broken",
          line: index + 1,
          value: link[2],
        });
      }
    }
    currentSection = {
      ...currentSection,
      links: [
        ...currentSection.links,
        { label: link[1], target: link[2], external },
      ],
    };
    sections[sections.length - 1] = currentSection;
  }
  if (sections.filter((section) => section.optional).length > 1) {
    issues.push({ code: "llms_optional_duplicate" });
  }
  return {
    valid: issues.length === 0,
    ...(h1Lines[0]?.title ? { title: h1Lines[0].title } : {}),
    sections,
    issues,
    externalLinkCount,
    internalLinkCount,
  };
};

export const planLlmsTxtExport = (
  index: WorkspaceKnowledgeIndex,
  options: LlmsTxtExportOptions,
): LlmsTxtExportCandidate => {
  const privateDocumentIds = getPrivateDocumentIds(index);
  const reviewedPrivateIds = new Set(options.includePrivateDocumentIds ?? []);
  const includedDocumentIds: string[] = [];
  const excludedPrivateDocumentIds: string[] = [];
  const renderedSections: string[] = [];
  for (const section of options.sections) {
    const entries = section.documentIds.flatMap((documentId) => {
      const document = index.documentsById.get(documentId);
      const analysis = index.analysesByDocumentId.get(documentId);
      if (!document || !analysis) return [];
      if (privateDocumentIds.has(documentId) && !reviewedPrivateIds.has(documentId)) {
        excludedPrivateDocumentIds.push(documentId);
        return [];
      }
      includedDocumentIds.push(documentId);
      const description = analysis.knowledgeMetadata.description;
      return [
        `- [${analysis.title}](/${document.path})${
          description ? `: ${description}` : ""
        }`,
      ];
    });
    if (entries.length === 0) continue;
    renderedSections.push(
      `## ${section.optional ? "Optional" : section.heading.trim() || "Docs"}`,
      "",
      ...entries,
      "",
    );
  }
  const markdown = [
    `# ${options.title.trim() || "Knowledge workspace"}`,
    "",
    ...(options.summary?.trim()
      ? [`> ${options.summary.trim()}`, ""]
      : []),
    ...(options.details?.trim()
      ? [options.details.trim(), ""]
      : []),
    ...renderedSections,
  ].join("\n").trimEnd() + "\n";
  return {
    markdown,
    includedDocumentIds: [...new Set(includedDocumentIds)],
    excludedPrivateDocumentIds: [...new Set(excludedPrivateDocumentIds)],
    requiresPrivateReview: excludedPrivateDocumentIds.length > 0,
    existingFilePreserved: typeof options.existingLlmsTxt === "string",
    overwritesExistingFile: false,
    workspaceSourceChanged: false,
  };
};
