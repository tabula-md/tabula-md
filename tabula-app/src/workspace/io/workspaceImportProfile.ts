import type {
  WorkspaceProfile,
  WorkspaceSourceDocument,
} from "@tabula-md/tabula";
import {
  createWorkspaceProfileFromDetections,
  runWorkspaceProfileDetectors,
  type ProfileDetectionResult,
  type ProfileDiagnostic,
  type WorkspaceProfileDetector,
} from "./workspaceProfileDetector";

export type WorkspaceImportLinkSyntax =
  | "markdown-links"
  | "wikilinks"
  | "embeds";

export type WorkspaceImportEvidenceCode =
  | "gfm-files"
  | "mdx-files"
  | "okf-version"
  | "typed-concepts"
  | "directory-indexes"
  | "activity-log"
  | "openwiki-state"
  | "obsidian-config"
  | "internal-links"
  | "wikilinks"
  | "raw-wiki-roles"
  | "llm-wiki-source-material"
  | "llm-wiki-compiled-knowledge"
  | "llm-wiki-workflow-rules"
  | "llm-wiki-health-issues"
  | "agents-files"
  | "claude-files"
  | "skill-files"
  | "llms-files";

export type WorkspaceImportEvidence = {
  code: WorkspaceImportEvidenceCode;
  count?: number;
  value?: string;
};

export type WorkspaceImportProfile = WorkspaceProfile & {
  detections: readonly ProfileDetectionResult[];
  diagnostics: readonly ProfileDiagnostic[];
  linkSyntaxes: readonly WorkspaceImportLinkSyntax[];
  evidence: readonly WorkspaceImportEvidence[];
  preservedSupportFileCount: number;
  ignoredFileCount: number;
};

type WorkspaceImportSupportFile = {
  path: string;
  text: string;
};

export type WorkspaceImportProfileInput = {
  documents: readonly WorkspaceSourceDocument[];
  supportFiles: readonly WorkspaceImportSupportFile[];
  sourcePaths: readonly string[];
  importedPaths: readonly string[];
};

const createFallbackProfile = (
  input: WorkspaceImportProfileInput,
  diagnostics: readonly ProfileDiagnostic[],
): WorkspaceImportProfile => ({
  syntaxes: ["gfm"],
  conventions: [],
  schemas: [],
  workflows: [],
  agentInstructions: [],
  deliveries: [],
  detections: [],
  diagnostics,
  linkSyntaxes: [],
  evidence: [],
  preservedSupportFileCount: input.supportFiles.length,
  ignoredFileCount: Math.max(
    0,
    input.sourcePaths.length - input.importedPaths.length,
  ),
});

export const detectWorkspaceImportProfile = (
  input: WorkspaceImportProfileInput,
  detectors?: readonly WorkspaceProfileDetector[],
): WorkspaceImportProfile => {
  const { detections, diagnostics, inspection } =
    runWorkspaceProfileDetectors(input, detectors);
  if (detections.length === 0) {
    return createFallbackProfile(input, diagnostics);
  }

  const analyses = inspection.knowledgeIndex
    ? [...inspection.knowledgeIndex.analysesByDocumentId.values()]
    : [];
  const allLinks = analyses.flatMap((analysis) => analysis.links);
  const linkSyntaxes: WorkspaceImportLinkSyntax[] = [];
  if (allLinks.some((link) => link.syntax === "markdown")) {
    linkSyntaxes.push("markdown-links");
  }
  if (allLinks.some((link) => link.syntax === "wikilink")) {
    linkSyntaxes.push("wikilinks");
  }
  if (allLinks.some((link) => link.relation === "embed")) {
    linkSyntaxes.push("embeds");
  }

  return {
    ...createWorkspaceProfileFromDetections(detections),
    detections,
    diagnostics,
    linkSyntaxes,
    evidence: detections.flatMap((detection) => detection.evidence),
    preservedSupportFileCount: input.supportFiles.length,
    ignoredFileCount: Math.max(
      0,
      input.sourcePaths.length - input.importedPaths.length,
    ),
  };
};

export type {
  ProfileDetectionConfidence,
  ProfileDetectionResult,
  ProfileDiagnostic,
  WorkspaceInspection,
  WorkspaceProfileDetector,
} from "./workspaceProfileDetector";
