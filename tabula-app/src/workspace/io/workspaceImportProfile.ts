import {
  createWorkspaceKnowledgeIndex,
  getWorkspaceOkfCompatibility,
  type WorkspaceSourceDocument,
} from "@tabula-md/tabula";

export type WorkspaceImportFormat =
  | "plain-markdown"
  | "markdown-wiki"
  | "okf";

export type WorkspaceImportConvention = "openwiki" | "obsidian";

export type WorkspaceImportLinkSyntax =
  | "markdown-links"
  | "wikilinks"
  | "embeds";

export type WorkspaceImportEvidenceCode =
  | "okf-version"
  | "typed-concepts"
  | "directory-indexes"
  | "activity-log"
  | "openwiki-state"
  | "obsidian-config"
  | "internal-links"
  | "wikilinks";

export type WorkspaceImportEvidence = {
  code: WorkspaceImportEvidenceCode;
  count?: number;
  value?: string;
};

export type WorkspaceImportProfile = {
  format: WorkspaceImportFormat;
  okfVersion?: string;
  conventions: readonly WorkspaceImportConvention[];
  linkSyntaxes: readonly WorkspaceImportLinkSyntax[];
  evidence: readonly WorkspaceImportEvidence[];
  markdownFileCount: number;
  preservedSupportPaths: readonly string[];
  ignoredPaths: readonly string[];
  preservedSupportFileCount: number;
  ignoredFileCount: number;
};

type WorkspaceImportSupportFile = {
  path: string;
  text: string;
};

type WorkspaceImportProfileInput = {
  documents: readonly WorkspaceSourceDocument[];
  supportFiles: readonly WorkspaceImportSupportFile[];
  sourcePaths: readonly string[];
  importedPaths: readonly string[];
};

const getImportFileHandling = (input: WorkspaceImportProfileInput) => {
  const importedPathSet = new Set(input.importedPaths);
  const preservedSupportPaths = input.supportFiles
    .map((file) => file.path)
    .sort((first, second) => first.localeCompare(second));
  const ignoredPaths = input.sourcePaths
    .filter((path) => !importedPathSet.has(path))
    .sort((first, second) => first.localeCompare(second));
  return {
    markdownFileCount: input.documents.length,
    preservedSupportPaths,
    ignoredPaths,
    preservedSupportFileCount: preservedSupportPaths.length,
    ignoredFileCount: ignoredPaths.length,
  };
};

const getBasename = (path: string) =>
  path.split("/").at(-1)?.toLocaleLowerCase() ?? "";

const hasOpenWikiStateShape = (text: string) => {
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const state = value as Record<string, unknown>;
    return typeof state.command === "string" &&
      (
        typeof state.gitHead === "string" ||
        typeof state.git_head === "string"
      ) &&
      (
        typeof state.updatedAt === "string" ||
        typeof state.last_update === "string"
      );
  } catch {
    return false;
  }
};

const createFallbackProfile = (
  input: WorkspaceImportProfileInput,
): WorkspaceImportProfile => ({
  format: "plain-markdown",
  conventions: input.sourcePaths.some((path) =>
    path.toLocaleLowerCase().split("/").includes(".obsidian"))
    ? ["obsidian"]
    : [],
  linkSyntaxes: [],
  evidence: input.sourcePaths.some((path) =>
    path.toLocaleLowerCase().split("/").includes(".obsidian"))
    ? [{ code: "obsidian-config" }]
    : [],
  ...getImportFileHandling(input),
});

export const detectWorkspaceImportProfile = (
  input: WorkspaceImportProfileInput,
): WorkspaceImportProfile => {
  try {
    const index = createWorkspaceKnowledgeIndex(input.documents);
    const compatibility = getWorkspaceOkfCompatibility(index);
    const analyses = [...index.analysesByDocumentId.values()];
    const typedConceptCount = analyses.filter((analysis) => {
      const basename = getBasename(analysis.path);
      return basename !== "index.md" &&
        basename !== "log.md" &&
        Boolean(analysis.knowledgeMetadata.type);
    }).length;
    const directoryIndexCount = analyses.filter((analysis) =>
      getBasename(analysis.path) === "index.md" && analysis.path !== "index.md"
    ).length;
    const hasActivityLog = analyses.some((analysis) =>
      getBasename(analysis.path) === "log.md");
    const allLinks = analyses.flatMap((analysis) => analysis.links);
    const hasMarkdownLinks = allLinks.some((link) => link.syntax === "markdown");
    const hasWikilinks = allLinks.some((link) => link.syntax === "wikilink");
    const hasEmbeds = allLinks.some((link) => link.relation === "embed");
    const internalLinkCount = [...index.outgoingLinksByDocumentId.values()]
      .flat()
      .filter((link) => link.status !== "external")
      .length;
    const hasObsidianConfig = input.sourcePaths.some((path) =>
      path.toLocaleLowerCase().split("/").includes(".obsidian"));
    const hasOpenWikiState = input.supportFiles.some((file) =>
      getBasename(file.path) === ".last-update.json" &&
      hasOpenWikiStateShape(file.text));
    const conventions: WorkspaceImportConvention[] = [];
    if (
      hasOpenWikiState &&
      (Boolean(compatibility.declaredVersion) || directoryIndexCount > 0)
    ) {
      conventions.push("openwiki");
    }
    if (hasObsidianConfig || hasWikilinks) {
      conventions.push("obsidian");
    }
    const linkSyntaxes: WorkspaceImportLinkSyntax[] = [];
    if (hasMarkdownLinks) linkSyntaxes.push("markdown-links");
    if (hasWikilinks) linkSyntaxes.push("wikilinks");
    if (hasEmbeds) linkSyntaxes.push("embeds");
    const evidence: WorkspaceImportEvidence[] = [];
    if (compatibility.declaredVersion) {
      evidence.push({
        code: "okf-version",
        value: compatibility.declaredVersion,
      });
    }
    if (typedConceptCount > 0) {
      evidence.push({ code: "typed-concepts", count: typedConceptCount });
    }
    if (directoryIndexCount > 0) {
      evidence.push({ code: "directory-indexes", count: directoryIndexCount });
    }
    if (hasActivityLog) evidence.push({ code: "activity-log" });
    if (hasOpenWikiState) evidence.push({ code: "openwiki-state" });
    if (hasObsidianConfig) evidence.push({ code: "obsidian-config" });
    if (internalLinkCount > 0) {
      evidence.push({ code: "internal-links", count: internalLinkCount });
    }
    if (hasWikilinks) evidence.push({ code: "wikilinks" });

    return {
      format: compatibility.declaredVersion
        ? "okf"
        : (
            directoryIndexCount > 0 ||
            hasActivityLog ||
            typedConceptCount > 1 ||
            internalLinkCount > 1
          )
          ? "markdown-wiki"
          : "plain-markdown",
      ...(compatibility.declaredVersion
        ? { okfVersion: compatibility.declaredVersion }
        : {}),
      conventions,
      linkSyntaxes,
      evidence,
      ...getImportFileHandling(input),
    };
  } catch {
    return createFallbackProfile(input);
  }
};
