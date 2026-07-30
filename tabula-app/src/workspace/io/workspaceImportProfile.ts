import {
  createWorkspaceKnowledgeIndex,
  getWorkspaceOkfCompatibility,
  type WorkspaceProfile,
  type WorkspaceSourceDocument,
} from "@tabula-md/tabula";

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

export type WorkspaceImportProfile = WorkspaceProfile & {
  linkSyntaxes: readonly WorkspaceImportLinkSyntax[];
  evidence: readonly WorkspaceImportEvidence[];
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

const getBasename = (path: string) =>
  path.split("/").at(-1)?.toLocaleLowerCase() ?? "";

const getExtension = (path: string) => {
  const basename = getBasename(path);
  const dotIndex = basename.lastIndexOf(".");
  return dotIndex > 0 ? basename.slice(dotIndex) : "";
};

const hasPathSegment = (path: string, segment: string) =>
  path.toLocaleLowerCase().split("/").includes(segment);

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
  syntaxes: input.sourcePaths.some((path) => getExtension(path) === ".mdx")
    ? ["gfm", "mdx"]
    : ["gfm"],
  conventions: input.sourcePaths.some((path) =>
    hasPathSegment(path, ".obsidian"))
    ? ["obsidian"]
    : [],
  schemas: [],
  workflows: [],
  agentInstructions: [],
  deliveries: [],
  linkSyntaxes: [],
  evidence: input.sourcePaths.some((path) =>
    path.toLocaleLowerCase().split("/").includes(".obsidian"))
    ? [{ code: "obsidian-config" }]
    : [],
  preservedSupportFileCount: input.supportFiles.length,
  ignoredFileCount: Math.max(
    0,
    input.sourcePaths.length - input.importedPaths.length,
  ),
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
    const conventions: WorkspaceImportProfile["conventions"][number][] = [];
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

    const markdownPathCount = input.sourcePaths.filter((path) =>
      [".md", ".markdown"].includes(getExtension(path))).length;
    const mdxPathCount = input.sourcePaths.filter((path) =>
      getExtension(path) === ".mdx").length;
    const syntaxes: WorkspaceImportProfile["syntaxes"][number][] = [];
    if (markdownPathCount > 0 || mdxPathCount === 0) syntaxes.push("gfm");
    if (mdxPathCount > 0) syntaxes.push("mdx");
    const lowerPaths = input.sourcePaths.map((path) =>
      path.toLocaleLowerCase());
    const hasRawRole = lowerPaths.some((path) =>
      path.split("/").includes("raw"));
    const hasWikiRole = lowerPaths.some((path) =>
      path.split("/").includes("wiki"));
    const agentInstructions:
      WorkspaceImportProfile["agentInstructions"][number][] = [];
    if (lowerPaths.some((path) => getBasename(path) === "agents.md")) {
      agentInstructions.push("agents-md");
    }
    if (lowerPaths.some((path) => getBasename(path) === "claude.md")) {
      agentInstructions.push("claude-md");
    }
    if (lowerPaths.some((path) =>
      getBasename(path) === "skill.md" &&
      path.split("/").includes("skills"))) {
      agentInstructions.push("agent-skills");
    }

    return {
      syntaxes,
      conventions,
      schemas: compatibility.declaredVersion
        ? [{ id: "okf", version: compatibility.declaredVersion }]
        : [],
      workflows: hasRawRole && hasWikiRole ? ["llm-wiki"] : [],
      agentInstructions,
      deliveries: lowerPaths.some((path) =>
        getBasename(path) === "llms.txt")
        ? ["llms-txt"]
        : [],
      linkSyntaxes,
      evidence,
      preservedSupportFileCount: input.supportFiles.length,
      ignoredFileCount: Math.max(
        0,
        input.sourcePaths.length - input.importedPaths.length,
      ),
    };
  } catch {
    return createFallbackProfile(input);
  }
};
