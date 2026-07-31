import { inspectFrontmatterData } from "./markdown/parse";
import type { WorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";

export type AgentInstructionKind = "agents" | "claude" | "skill";
export type AgentInstructionTrust = "trusted" | "unreviewed";

export type AgentInstructionDocument = {
  documentId: string;
  path: string;
  kind: AgentInstructionKind;
  scopePath: string;
  vendorSpecific: boolean;
};

export type AgentInstructionApplication = {
  documentId: string;
  path: string;
  instructions: readonly AgentInstructionDocument[];
};

export type AgentInstructionIssueCode =
  | "agents_scope_conflict_candidate"
  | "skill_description_missing"
  | "skill_frontmatter_invalid"
  | "skill_name_invalid"
  | "skill_reference_missing";

export type AgentInstructionIssue = {
  code: AgentInstructionIssueCode;
  documentId: string;
  path: string;
  value?: string;
};

export type AgentSkillReport = {
  documentId: string;
  path: string;
  name?: string;
  description?: string;
  trust: AgentInstructionTrust;
  referencePaths: readonly string[];
  hasReferencesDirectory: boolean;
  hasScriptsDirectory: boolean;
  hasAssetsDirectory: boolean;
  scriptsExecutable: false;
};

export type AgentInstructionReport = {
  documents: readonly AgentInstructionDocument[];
  applications: readonly AgentInstructionApplication[];
  issues: readonly AgentInstructionIssue[];
  skills: readonly AgentSkillReport[];
};

export type AgentInstructionOptions = {
  trustedInstructionPaths?: readonly string[];
};

export type AgentInstructionChange = {
  path: string;
  kind: "added" | "modified" | "deleted";
  importance: "critical";
};

const normalizePath = (path: string) =>
  path.replace(/\\/g, "/").replace(/^\.?\//, "").replace(/\/+/g, "/");

const getBasename = (path: string) =>
  normalizePath(path).split("/").at(-1)?.toLowerCase() ?? "";

const getDirectory = (path: string) =>
  normalizePath(path).split("/").slice(0, -1).join("/");

const isWithinScope = (path: string, scopePath: string) =>
  !scopePath || path === scopePath || path.startsWith(`${scopePath}/`);

const getInstructionKind = (path: string): AgentInstructionKind | undefined => {
  const basename = getBasename(path);
  if (basename === "agents.md") return "agents";
  if (basename === "claude.md") return "claude";
  if (basename === "skill.md") return "skill";
  return undefined;
};

const createIssue = (
  code: AgentInstructionIssueCode,
  documentId: string,
  path: string,
  value?: string,
): AgentInstructionIssue => ({
  code,
  documentId,
  path,
  ...(value ? { value } : {}),
});

type Directive = { key: string; negative: boolean };

const getDirectives = (markdown: string): Directive[] =>
  markdown.split(/\r?\n/).flatMap((line): Directive[] => {
    const text = line
      .replace(/^\s*(?:[-*+]|\d+\.)\s+/, "")
      .replace(/^#+\s+/, "")
      .trim()
      .toLowerCase()
      .replace(/[.!]+$/, "");
    if (!text) return [];
    const negative = text.match(/^(?:do not|don't|never|must not)\s+(.+)$/);
    if (negative?.[1]) return [{ key: negative[1].trim(), negative: true }];
    const positive = text.match(/^(?:always|must|use)\s+(.+)$/);
    return positive?.[1]
      ? [{ key: positive[1].trim(), negative: false }]
      : [];
  });

const resolveRelativePath = (sourcePath: string, targetPath: string) => {
  if (/^[a-z][a-z0-9+.-]*:/i.test(targetPath)) return null;
  const segments = targetPath.startsWith("/")
    ? []
    : getDirectory(sourcePath).split("/").filter(Boolean);
  for (const segment of targetPath.replace(/^\/+/, "").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return undefined;
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return segments.join("/");
};

export const analyzeWorkspaceAgentInstructions = (
  index: WorkspaceKnowledgeIndex,
  availablePaths: readonly string[],
  options: AgentInstructionOptions = {},
): AgentInstructionReport => {
  const pathSet = new Set(availablePaths.map(normalizePath));
  const trustedPaths = new Set(
    (options.trustedInstructionPaths ?? []).map(normalizePath),
  );
  const documents = [...index.documentsById.values()].flatMap((document) => {
    const kind = getInstructionKind(document.path);
    return kind
      ? [{
          documentId: document.id,
          path: normalizePath(document.path),
          kind,
          scopePath: getDirectory(document.path),
          vendorSpecific: kind === "claude",
        } satisfies AgentInstructionDocument]
      : [];
  }).sort((first, second) =>
    first.scopePath.length - second.scopePath.length
    || first.path.localeCompare(second.path)
  );
  const applications = [...index.documentsById.values()].map((document) => ({
    documentId: document.id,
    path: document.path,
    instructions: documents.filter((instruction) =>
      instruction.kind !== "skill"
      && isWithinScope(normalizePath(document.path), instruction.scopePath)
    ),
  }));
  const issues: AgentInstructionIssue[] = [];

  for (const application of applications) {
    const scoped = application.instructions.filter(
      (instruction) => instruction.kind === "agents",
    );
    if (scoped.length < 2) continue;
    const directives = scoped.flatMap((instruction) => {
      const markdown = index.documentsById.get(instruction.documentId)?.markdown ?? "";
      return getDirectives(markdown).map((directive) => ({
        ...directive,
        instruction,
      }));
    });
    const conflict = directives.find((directive, directiveIndex) =>
      directives.some((candidate, candidateIndex) =>
        candidateIndex !== directiveIndex
        && candidate.key === directive.key
        && candidate.negative !== directive.negative
      )
    );
    if (conflict) {
      issues.push(createIssue(
        "agents_scope_conflict_candidate",
        application.documentId,
        application.path,
        conflict.key,
      ));
    }
  }

  const skills = documents
    .filter((document) => document.kind === "skill")
    .map((document): AgentSkillReport => {
      const markdown = index.documentsById.get(document.documentId)?.markdown ?? "";
      const inspection = inspectFrontmatterData(markdown);
      const name = inspection.status === "valid"
        && typeof inspection.metadata.name === "string"
        ? inspection.metadata.name.trim()
        : undefined;
      const description = inspection.status === "valid"
        && typeof inspection.metadata.description === "string"
        ? inspection.metadata.description.trim()
        : undefined;
      if (inspection.status !== "valid") {
        issues.push(createIssue(
          "skill_frontmatter_invalid",
          document.documentId,
          document.path,
        ));
      }
      if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
        issues.push(createIssue(
          "skill_name_invalid",
          document.documentId,
          document.path,
          name,
        ));
      }
      if (!description) {
        issues.push(createIssue(
          "skill_description_missing",
          document.documentId,
          document.path,
        ));
      }
      const referencePaths = (
        index.outgoingLinksByDocumentId.get(document.documentId) ?? []
      ).flatMap((link) => {
        const resolved = link.targetPath
          ?? resolveRelativePath(document.path, link.target.split("#")[0] ?? "");
        return resolved ? [normalizePath(resolved)] : [];
      });
      for (const path of referencePaths) {
        if (!pathSet.has(path)) {
          issues.push(createIssue(
            "skill_reference_missing",
            document.documentId,
            document.path,
            path,
          ));
        }
      }
      const skillDirectory = getDirectory(document.path);
      const hasDirectory = (name: string) =>
        [...pathSet].some((path) => path.startsWith(`${skillDirectory}/${name}/`));
      return {
        documentId: document.documentId,
        path: document.path,
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
        trust: trustedPaths.has(document.path) ? "trusted" : "unreviewed",
        referencePaths: [...new Set(referencePaths)].sort(),
        hasReferencesDirectory: hasDirectory("references"),
        hasScriptsDirectory: hasDirectory("scripts"),
        hasAssetsDirectory: hasDirectory("assets"),
        scriptsExecutable: false,
      };
    });

  return { documents, applications, issues, skills };
};

export const getAgentInstructionChanges = (
  previous: WorkspaceKnowledgeIndex,
  current: WorkspaceKnowledgeIndex,
): AgentInstructionChange[] => {
  const getDocuments = (index: WorkspaceKnowledgeIndex) => new Map(
    [...index.documentsById.values()]
      .filter((document) => Boolean(getInstructionKind(document.path)))
      .map((document) => [normalizePath(document.path), document.markdown]),
  );
  const before = getDocuments(previous);
  const after = getDocuments(current);
  return [...new Set([...before.keys(), ...after.keys()])]
    .sort()
    .flatMap((path): AgentInstructionChange[] => {
      if (!before.has(path)) return [{ path, kind: "added", importance: "critical" }];
      if (!after.has(path)) return [{ path, kind: "deleted", importance: "critical" }];
      return before.get(path) !== after.get(path)
        ? [{ path, kind: "modified", importance: "critical" }]
        : [];
    });
};
