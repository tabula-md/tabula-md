import {
  analyzeLlmWikiWorkflow,
  analyzeMarkdownCapabilities,
  createWorkspaceKnowledgeIndex,
  getKnowledgeProfileDefinition,
  getWorkspaceOkfCompatibility,
  validateLlmsTxt,
  type KnowledgeProfileKind,
  type LlmWikiRoleAssignment,
  type WorkspaceKnowledgeIndex,
  type WorkspaceProfile,
} from "@tabula-md/tabula";
import type {
  WorkspaceImportEvidence,
  WorkspaceImportProfileInput,
} from "./workspaceImportProfile";

export type ProfileDetectionConfidence =
  | "declared"
  | "strong"
  | "heuristic";

export type ProfileDiagnostic = {
  code: "detector-failed" | "inspection-failed";
  detectorId: string;
};

export type ProfileDetectionResult = {
  profileId: string;
  kind: KnowledgeProfileKind;
  confidence: ProfileDetectionConfidence;
  evidence: readonly WorkspaceImportEvidence[];
  diagnostics: readonly ProfileDiagnostic[];
  fileCount?: number;
  healthIssueCount?: number;
  roleAssignments?: readonly LlmWikiRoleAssignment[];
  version?: string;
};

export type WorkspaceInspection = WorkspaceImportProfileInput & {
  knowledgeIndex: WorkspaceKnowledgeIndex | null;
};

export interface WorkspaceProfileDetector {
  id: string;
  detect(input: WorkspaceInspection): ProfileDetectionResult | null;
}

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
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
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

const result = (
  profileId: string,
  confidence: ProfileDetectionConfidence,
  evidence: readonly WorkspaceImportEvidence[],
  options: {
    fileCount?: number;
    healthIssueCount?: number;
    roleAssignments?: readonly LlmWikiRoleAssignment[];
    version?: string;
  } = {},
): ProfileDetectionResult => {
  const definition = getKnowledgeProfileDefinition(profileId);
  const inferredOkfSchema =
    profileId.startsWith("okf-") && Boolean(options.version);
  if (!definition && !inferredOkfSchema) {
    throw new Error(`Unknown workspace profile detector result: ${profileId}`);
  }
  return {
    profileId,
    kind: definition?.kind ?? "schema",
    confidence,
    evidence,
    diagnostics: [],
    ...options,
  };
};

const getAnalyses = (inspection: WorkspaceInspection) =>
  inspection.knowledgeIndex
    ? [...inspection.knowledgeIndex.analysesByDocumentId.values()]
    : [];

export const WORKSPACE_PROFILE_DETECTORS: readonly WorkspaceProfileDetector[] = [
  {
    id: "commonmark",
    detect: (input) => {
      const fileCount = input.sourcePaths.filter((path) =>
        [".md", ".markdown"].includes(getExtension(path))).length;
      return fileCount > 0
        ? result(
            "commonmark",
            "strong",
            [{ code: "commonmark-files", count: fileCount }],
            { fileCount },
          )
        : null;
    },
  },
  {
    id: "gfm",
    detect: (input) => {
      const fileCount = input.documents.filter((document) => {
        const capabilities = analyzeMarkdownCapabilities(document.markdown)
          .capabilities;
        return capabilities.includes("gfm-table") ||
          capabilities.includes("gfm-task-list");
      }).length;
      return fileCount > 0
        ? result("gfm", "strong", [{ code: "gfm-files", count: fileCount }], {
            fileCount,
          })
        : null;
    },
  },
  {
    id: "mdx",
    detect: (input) => {
      const fileCount = input.sourcePaths.filter((path) =>
        getExtension(path) === ".mdx").length;
      return fileCount > 0
        ? result("mdx", "declared", [{ code: "mdx-files", count: fileCount }], {
            fileCount,
          })
        : null;
    },
  },
  {
    id: "obsidian",
    detect: (input) => {
      const hasConfig = input.sourcePaths.some((path) =>
        hasPathSegment(path, ".obsidian"));
      if (!hasConfig) return null;
      const wikilinkCount = getAnalyses(input)
        .flatMap((analysis) => analysis.links)
        .filter((link) => link.syntax === "wikilink").length;
      return result(
        "obsidian",
        "declared",
        [
          { code: "obsidian-config" as const },
          ...(wikilinkCount > 0
            ? [{ code: "wikilinks" as const, count: wikilinkCount }]
            : []),
        ],
      );
    },
  },
  {
    id: "okf",
    detect: (input) => {
      if (!input.knowledgeIndex) return null;
      const version =
        getWorkspaceOkfCompatibility(input.knowledgeIndex).declaredVersion;
      const analyses = getAnalyses(input);
      const typedConceptCount = analyses.filter((analysis) => {
        const basename = getBasename(analysis.path);
        return basename !== "index.md" &&
          basename !== "log.md" &&
          Boolean(analysis.knowledgeMetadata.type);
      }).length;
      const directoryIndexCount = analyses.filter((analysis) =>
        getBasename(analysis.path) === "index.md" &&
        analysis.path.toLocaleLowerCase() !== "index.md"
      ).length;
      const hasActivityLog = analyses.some((analysis) =>
        getBasename(analysis.path) === "log.md");
      if (version) {
        return result(
            `okf-${version}`,
            "declared",
            [
              { code: "okf-version", value: version },
              ...(typedConceptCount > 0
                ? [{
                    code: "typed-concepts" as const,
                    count: typedConceptCount,
                  }]
                : []),
              ...(directoryIndexCount > 0
                ? [{
                    code: "directory-indexes" as const,
                    count: directoryIndexCount,
                  }]
                : []),
              ...(hasActivityLog
                ? [{ code: "activity-log" as const }]
                : []),
            ],
            { version },
          );
      }
      return typedConceptCount > 0 && directoryIndexCount > 0
        ? result(
            "okf-like",
            "heuristic",
            [
              { code: "typed-concepts", count: typedConceptCount },
              { code: "directory-indexes", count: directoryIndexCount },
              ...(hasActivityLog
                ? [{ code: "activity-log" as const }]
                : []),
            ],
          )
        : null;
    },
  },
  {
    id: "openwiki",
    detect: (input) => {
      const hasState = input.supportFiles.some((file) =>
        getBasename(file.path) === ".last-update.json" &&
        hasOpenWikiStateShape(file.text));
      if (!hasState) return null;
      const analyses = getAnalyses(input);
      const directoryIndexCount = analyses.filter((analysis) =>
        getBasename(analysis.path) === "index.md" &&
        analysis.path.toLocaleLowerCase() !== "index.md"
      ).length;
      const declaredVersion = input.knowledgeIndex
        ? getWorkspaceOkfCompatibility(input.knowledgeIndex).declaredVersion
        : undefined;
      if (!declaredVersion && directoryIndexCount === 0) return null;
      return result("openwiki", "strong", [
        { code: "openwiki-state" },
        ...(directoryIndexCount > 0
          ? [{ code: "directory-indexes" as const, count: directoryIndexCount }]
          : []),
      ]);
    },
  },
  {
    id: "llm-wiki",
    detect: (input) => {
      if (!input.knowledgeIndex) return null;
      const report = analyzeLlmWikiWorkflow(
        input.knowledgeIndex,
        input.sourcePaths,
      );
      return report.detected
        ? result("llm-wiki", "heuristic", [
            { code: "raw-wiki-roles" },
            {
              code: "llm-wiki-source-material",
              count: report.sourceMaterialCount,
            },
            {
              code: "llm-wiki-compiled-knowledge",
              count: report.compiledKnowledgeCount,
            },
            ...(report.workflowRuleCount > 0
              ? [{
                  code: "llm-wiki-workflow-rules" as const,
                  count: report.workflowRuleCount,
                }]
              : []),
            ...(report.issues.length > 0
              ? [{
                  code: "llm-wiki-health-issues" as const,
                  count: report.issues.length,
                }]
              : []),
          ], {
            healthIssueCount: report.issues.length,
            roleAssignments: report.assignments,
          })
        : null;
    },
  },
  {
    id: "agents-md",
    detect: (input) => {
      const fileCount = input.sourcePaths.filter((path) =>
        getBasename(path) === "agents.md").length;
      return fileCount > 0
        ? result(
            "agents-md",
            "declared",
            [{ code: "agents-files", count: fileCount }],
            { fileCount },
          )
        : null;
    },
  },
  {
    id: "claude-md",
    detect: (input) => {
      const fileCount = input.sourcePaths.filter((path) =>
        getBasename(path) === "claude.md").length;
      return fileCount > 0
        ? result(
            "claude-md",
            "declared",
            [{ code: "claude-files", count: fileCount }],
            { fileCount },
          )
        : null;
    },
  },
  {
    id: "agent-skills",
    detect: (input) => {
      const fileCount = input.sourcePaths.filter((path) =>
        getBasename(path) === "skill.md" &&
        hasPathSegment(path, "skills")).length;
      return fileCount > 0
        ? result(
            "agent-skills",
            "declared",
            [{ code: "skill-files", count: fileCount }],
            { fileCount },
          )
        : null;
    },
  },
  {
    id: "llms-txt",
    detect: (input) => {
      const files = input.supportFiles.filter((file) =>
        getBasename(file.path) === "llms.txt");
      const fileCount = files.length;
      const validations = files.map((file) =>
        validateLlmsTxt(file.text, input.sourcePaths)
      );
      const issueCount = validations.reduce(
        (count, report) => count + report.issues.length,
        0,
      );
      const externalLinkCount = validations.reduce(
        (count, report) => count + report.externalLinkCount,
        0,
      );
      return fileCount > 0
        ? result(
            "llms-txt",
            "declared",
            [
              { code: "llms-files", count: fileCount },
              ...(issueCount > 0
                ? [{ code: "llms-validation-issues" as const, count: issueCount }]
                : []),
              ...(externalLinkCount > 0
                ? [{ code: "llms-external-links" as const, count: externalLinkCount }]
                : []),
            ],
            { fileCount },
          )
        : null;
    },
  },
];

export const createWorkspaceInspection = (
  input: WorkspaceImportProfileInput,
): {
  inspection: WorkspaceInspection;
  diagnostics: ProfileDiagnostic[];
} => {
  try {
    return {
      inspection: {
        ...input,
        knowledgeIndex: createWorkspaceKnowledgeIndex(input.documents),
      },
      diagnostics: [],
    };
  } catch {
    return {
      inspection: { ...input, knowledgeIndex: null },
      diagnostics: [{
        code: "inspection-failed",
        detectorId: "workspace-knowledge-index",
      }],
    };
  }
};

export const runWorkspaceProfileDetectors = (
  input: WorkspaceImportProfileInput,
  detectors: readonly WorkspaceProfileDetector[] =
    WORKSPACE_PROFILE_DETECTORS,
) => {
  const { inspection, diagnostics } = createWorkspaceInspection(input);
  const detections: ProfileDetectionResult[] = [];
  for (const detector of detectors) {
    try {
      const detection = detector.detect(inspection);
      if (detection) detections.push(detection);
    } catch {
      diagnostics.push({
        code: "detector-failed",
        detectorId: detector.id,
      });
    }
  }
  return { detections, diagnostics, inspection };
};

export const createWorkspaceProfileFromDetections = (
  detections: readonly ProfileDetectionResult[],
): WorkspaceProfile => {
  const syntaxes: WorkspaceProfile["syntaxes"][number][] = [];
  const conventions: WorkspaceProfile["conventions"][number][] = [];
  const schemas: WorkspaceProfile["schemas"][number][] = [];
  const workflows: WorkspaceProfile["workflows"][number][] = [];
  const agentInstructions:
    WorkspaceProfile["agentInstructions"][number][] = [];
  const deliveries: WorkspaceProfile["deliveries"][number][] = [];

  for (const detection of detections) {
    switch (detection.profileId) {
      case "commonmark":
      case "gfm":
      case "mdx":
        syntaxes.push(detection.profileId);
        break;
      case "obsidian":
      case "openwiki":
        conventions.push(detection.profileId);
        break;
      case "llm-wiki":
        workflows.push(detection.profileId);
        break;
      case "agents-md":
      case "claude-md":
      case "agent-skills":
        agentInstructions.push(detection.profileId);
        break;
      case "llms-txt":
        deliveries.push(detection.profileId);
        break;
      default:
        if (
          detection.kind === "schema" &&
          detection.profileId.startsWith("okf-") &&
          detection.version
        ) {
          schemas.push({ id: "okf", version: detection.version });
        }
    }
  }
  return {
    syntaxes,
    conventions,
    schemas,
    workflows,
    agentInstructions,
    deliveries,
  };
};
