import {
  getOutlineHeadingsFromMarkdown,
  inspectFrontmatterData,
} from "./markdown/parse";
import type { WorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";

/** Canonical draft: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md */
export const OKF_TARGET_VERSION = "0.1";

export type OkfDocumentRole = "concept" | "index" | "log" | "unsupported";
export type OkfDocumentStatus = "conformant" | "nonconformant" | "ignored";
export type OkfCompatibilityStatus = "conformant" | "nonconformant";
export type OkfCompatibilityIssueSeverity = "error" | "warning";
export type OkfCompatibilityIssueCode =
  | "concept_frontmatter_missing"
  | "concept_frontmatter_invalid"
  | "concept_type_missing"
  | "concept_type_invalid"
  | "reserved_frontmatter_invalid"
  | "reserved_frontmatter_not_allowed"
  | "root_index_version_invalid"
  | "root_index_extra_metadata"
  | "unsupported_okf_version"
  | "index_structure_invalid"
  | "log_structure_invalid"
  | "log_date_invalid"
  | "log_dates_out_of_order"
  | "nonstandard_markdown_extension"
  | "wikilink_syntax";

export type OkfCompatibilityIssue = {
  code: OkfCompatibilityIssueCode;
  severity: OkfCompatibilityIssueSeverity;
  documentId: string;
  path: string;
  value?: string;
};

export type OkfDocumentCompatibility = {
  documentId: string;
  path: string;
  role: OkfDocumentRole;
  status: OkfDocumentStatus;
  conceptId?: string;
  conceptType?: string;
  issues: readonly OkfCompatibilityIssue[];
};

export type OkfCompatibilityReport = {
  targetVersion: typeof OKF_TARGET_VERSION;
  declaredVersion?: string;
  status: OkfCompatibilityStatus;
  conceptCount: number;
  reservedDocumentCount: number;
  ignoredDocumentCount: number;
  errorCount: number;
  warningCount: number;
  documents: readonly OkfDocumentCompatibility[];
  issues: readonly OkfCompatibilityIssue[];
};

const compareText = (first: string, second: string) =>
  first < second ? -1 : first > second ? 1 : 0;

const getBasename = (path: string) => path.split("/").at(-1) ?? path;

const getDocumentRole = (path: string): OkfDocumentRole => {
  const basename = getBasename(path);
  if (basename === "index.md") return "index";
  if (basename === "log.md") return "log";
  return path.endsWith(".md") ? "concept" : "unsupported";
};

const createIssue = (
  documentId: string,
  path: string,
  code: OkfCompatibilityIssueCode,
  severity: OkfCompatibilityIssueSeverity,
  value?: string,
): OkfCompatibilityIssue => ({
  code,
  severity,
  documentId,
  path,
  ...(typeof value === "undefined" ? {} : { value }),
});

const isIsoDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

const getIndexStructureIssues = (
  documentId: string,
  path: string,
  body: string,
) => getOutlineHeadingsFromMarkdown(body).some((heading) => heading.depth === 1)
  ? []
  : [createIssue(documentId, path, "index_structure_invalid", "error")];

const getLogStructureIssues = (
  documentId: string,
  path: string,
  body: string,
) => {
  const headings = getOutlineHeadingsFromMarkdown(body);
  const issues: OkfCompatibilityIssue[] = [];
  const dateHeadings = headings.filter((heading) => heading.depth === 2);
  if (
    !headings.some((heading) => heading.depth === 1) ||
    dateHeadings.length === 0
  ) {
    issues.push(createIssue(documentId, path, "log_structure_invalid", "error"));
  }

  const validDates: string[] = [];
  for (const heading of dateHeadings) {
    if (isIsoDate(heading.text)) {
      validDates.push(heading.text);
    } else {
      issues.push(createIssue(documentId, path, "log_date_invalid", "error", heading.text));
    }
  }
  if (validDates.some((date, index) => index > 0 && date > validDates[index - 1]!)) {
    issues.push(createIssue(documentId, path, "log_dates_out_of_order", "error"));
  }
  return issues;
};

export const getWorkspaceOkfCompatibility = (
  index: WorkspaceKnowledgeIndex,
): OkfCompatibilityReport => {
  const documents = [...index.documentsById.values()]
    .sort((first, second) => compareText(first.path, second.path));
  const documentReports: OkfDocumentCompatibility[] = [];
  let declaredVersion: string | undefined;

  for (const document of documents) {
    const role = getDocumentRole(document.path);
    const inspection = inspectFrontmatterData(document.markdown);
    const issues: OkfCompatibilityIssue[] = [];
    let conceptType: string | undefined;

    if (role === "unsupported") {
      issues.push(createIssue(
        document.id,
        document.path,
        "nonstandard_markdown_extension",
        "warning",
      ));
    } else if (role === "concept") {
      if (inspection.status === "absent") {
        issues.push(createIssue(
          document.id,
          document.path,
          "concept_frontmatter_missing",
          "error",
        ));
      } else if (inspection.status === "invalid") {
        issues.push(createIssue(
          document.id,
          document.path,
          "concept_frontmatter_invalid",
          "error",
        ));
      } else {
        const type = inspection.metadata.type;
        if (typeof type === "undefined" || type === null || type === "") {
          issues.push(createIssue(
            document.id,
            document.path,
            "concept_type_missing",
            "error",
          ));
        } else if (typeof type !== "string") {
          issues.push(createIssue(
            document.id,
            document.path,
            "concept_type_invalid",
            "error",
          ));
        } else if (!type.trim()) {
          issues.push(createIssue(
            document.id,
            document.path,
            "concept_type_missing",
            "error",
          ));
        } else {
          conceptType = type.trim();
        }
      }
    } else {
      const isRootIndex = role === "index" && document.path === "index.md";
      let body = document.markdown;
      if (inspection.status === "invalid") {
        issues.push(createIssue(
          document.id,
          document.path,
          "reserved_frontmatter_invalid",
          "error",
        ));
      } else if (inspection.status === "valid") {
        body = inspection.body;
        if (!isRootIndex) {
          issues.push(createIssue(
            document.id,
            document.path,
            "reserved_frontmatter_not_allowed",
            "error",
          ));
        } else {
          const version = inspection.metadata.okf_version;
          if (typeof version !== "string" || !version.trim()) {
            issues.push(createIssue(
              document.id,
              document.path,
              "root_index_version_invalid",
              "error",
            ));
          } else {
            declaredVersion = version.trim();
            if (declaredVersion !== OKF_TARGET_VERSION) {
              issues.push(createIssue(
                document.id,
                document.path,
                "unsupported_okf_version",
                "warning",
                declaredVersion,
              ));
            }
          }
          const extraMetadataKeys = Object.keys(inspection.metadata)
            .filter((key) => key !== "okf_version");
          if (extraMetadataKeys.length > 0) {
            issues.push(createIssue(
              document.id,
              document.path,
              "root_index_extra_metadata",
              "warning",
              extraMetadataKeys.join(", "),
            ));
          }
        }
      }

      issues.push(...(
        role === "index"
          ? getIndexStructureIssues(document.id, document.path, body)
          : getLogStructureIssues(document.id, document.path, body)
      ));
    }

    const hasWikiLinks = index.analysesByDocumentId.get(document.id)?.links
      .some((link) => link.syntax === "wikilink");
    if (hasWikiLinks) {
      issues.push(createIssue(
        document.id,
        document.path,
        "wikilink_syntax",
        "warning",
      ));
    }

    const hasErrors = issues.some((issue) => issue.severity === "error");
    documentReports.push({
      documentId: document.id,
      path: document.path,
      role,
      status:
        role === "unsupported"
          ? "ignored"
          : hasErrors
            ? "nonconformant"
            : "conformant",
      ...(role === "concept"
        ? { conceptId: document.path.slice(0, -".md".length) }
        : {}),
      ...(conceptType ? { conceptType } : {}),
      issues,
    });
  }

  const issues = documentReports.flatMap((document) => document.issues);
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - errorCount;
  return {
    targetVersion: OKF_TARGET_VERSION,
    ...(declaredVersion ? { declaredVersion } : {}),
    status: errorCount > 0 ? "nonconformant" : "conformant",
    conceptCount: documentReports.filter((document) => document.role === "concept").length,
    reservedDocumentCount: documentReports.filter(
      (document) => document.role === "index" || document.role === "log",
    ).length,
    ignoredDocumentCount: documentReports.filter(
      (document) => document.role === "unsupported",
    ).length,
    errorCount,
    warningCount,
    documents: documentReports,
    issues,
  };
};
