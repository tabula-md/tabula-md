import { fromMarkdown } from "mdast-util-from-markdown";
import { getMarkdownDocumentTitle, parseFrontmatterData } from "./markdown/parse";
import { isWorkspacePathSegment } from "./workspacePath";

export type WorkspaceSourceDocument = {
  id: string;
  path: string;
  markdown: string;
};

export type DocumentHeadingAnalysis = {
  depth: number;
  text: string;
  from: number;
  to: number;
};

export type DocumentLinkAnalysis = {
  label: string;
  target: string;
  from: number;
  to: number;
};

export type DocumentAnalysis = {
  documentId: string;
  path: string;
  title: string;
  metadata: Record<string, unknown>;
  headings: readonly DocumentHeadingAnalysis[];
  links: readonly DocumentLinkAnalysis[];
};

export type WorkspaceLinkStatus = "resolved" | "broken" | "external";

export type WorkspaceKnowledgeLink = DocumentLinkAnalysis & {
  sourceDocumentId: string;
  sourcePath: string;
  status: WorkspaceLinkStatus;
  targetDocumentId?: string;
  targetPath?: string;
  fragment?: string;
};

export type WorkspaceKnowledgeIndex = {
  documentsById: ReadonlyMap<string, WorkspaceSourceDocument>;
  documentIdsByPath: ReadonlyMap<string, string>;
  analysesByDocumentId: ReadonlyMap<string, DocumentAnalysis>;
  outgoingLinksByDocumentId: ReadonlyMap<string, readonly WorkspaceKnowledgeLink[]>;
  backlinksByDocumentId: ReadonlyMap<string, readonly WorkspaceKnowledgeLink[]>;
  brokenLinks: readonly WorkspaceKnowledgeLink[];
  externalLinks: readonly WorkspaceKnowledgeLink[];
};

type AstNode = {
  type: string;
  value?: string;
  url?: string;
  identifier?: string;
  depth?: number;
  children?: AstNode[];
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
};

const visitAst = (node: AstNode, visitor: (node: AstNode) => void) => {
  visitor(node);
  node.children?.forEach((child) => visitAst(child, visitor));
};

const getNodeText = (node: AstNode): string => {
  if (typeof node.value === "string") {
    return node.value;
  }
  return node.children?.map(getNodeText).join("") ?? "";
};

const getNodeOffsets = (node: AstNode, bodyOffset: number) => {
  const from = node.position?.start.offset;
  const to = node.position?.end.offset;
  return typeof from === "number" && typeof to === "number"
    ? { from: from + bodyOffset, to: to + bodyOffset }
    : null;
};

const normalizeReferenceIdentifier = (identifier: string) =>
  identifier.trim().replace(/\s+/g, " ").toLowerCase();

export const analyzeWorkspaceDocument = (document: WorkspaceSourceDocument): DocumentAnalysis => {
  const parsed = parseFrontmatterData(document.markdown);
  const root = fromMarkdown(parsed.body) as AstNode;
  const definitions = new Map<string, string>();
  const headings: DocumentHeadingAnalysis[] = [];
  const links: DocumentLinkAnalysis[] = [];

  visitAst(root, (node) => {
    if (node.type === "definition" && node.identifier && typeof node.url === "string") {
      const identifier = normalizeReferenceIdentifier(node.identifier);
      if (!definitions.has(identifier)) {
        definitions.set(identifier, node.url);
      }
    }
  });

  visitAst(root, (node) => {
    const offsets = getNodeOffsets(node, parsed.bodyOffset);
    if (!offsets) {
      return;
    }

    if (node.type === "heading" && node.depth) {
      const text = getNodeText(node).trim();
      if (text) {
        headings.push({ depth: node.depth, text, ...offsets });
      }
      return;
    }

    const target =
      node.type === "link"
        ? node.url
        : node.type === "linkReference" && node.identifier
          ? definitions.get(normalizeReferenceIdentifier(node.identifier))
          : undefined;
    if (typeof target === "string") {
      links.push({ label: getNodeText(node).trim(), target, ...offsets });
    }
  });

  return {
    documentId: document.id,
    path: document.path,
    title: getMarkdownDocumentTitle(document.markdown),
    metadata: parsed.metadata,
    headings,
    links,
  };
};

const externalTargetPattern = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

const splitLinkTarget = (target: string) => {
  const hashIndex = target.indexOf("#");
  const pathAndQuery = hashIndex === -1 ? target : target.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? undefined : target.slice(hashIndex + 1);
  const queryIndex = pathAndQuery.indexOf("?");
  return {
    path: queryIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, queryIndex),
    fragment,
  };
};

const resolvePath = (sourcePath: string, rawTargetPath: string): string | null => {
  const sourceDirectory = sourcePath.split("/").slice(0, -1);
  const rawSegments = rawTargetPath.startsWith("/")
    ? rawTargetPath.slice(1).split("/")
    : rawTargetPath.split("/");
  const resolved = rawTargetPath.startsWith("/") ? [] : [...sourceDirectory];
  for (const rawSegment of rawSegments) {
    let segment: string;
    try {
      segment = decodeURIComponent(rawSegment);
    } catch {
      return null;
    }
    if (!segment || segment.includes("/") || segment.includes("\\")) {
      return null;
    }
    if (segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (!resolved.pop()) {
        return null;
      }
      continue;
    }
    resolved.push(segment);
  }
  return resolved.join("/");
};

const assertWorkspaceSourceDocument = (document: WorkspaceSourceDocument) => {
  const segments = document.path.split("/");
  if (segments.length === 0 || segments.some((segment) => !isWorkspacePathSegment(segment))) {
    throw new Error(`Invalid workspace document path: ${document.path}`);
  }
};

const buildKnowledgeIndex = (
  documentsById: Map<string, WorkspaceSourceDocument>,
  analysesByDocumentId: Map<string, DocumentAnalysis>,
): WorkspaceKnowledgeIndex => {
  const documentIdsByPath = new Map<string, string>();
  for (const document of documentsById.values()) {
    const duplicateId = documentIdsByPath.get(document.path);
    if (typeof duplicateId !== "undefined" && duplicateId !== document.id) {
      throw new Error(`Duplicate workspace document path: ${document.path}`);
    }
    documentIdsByPath.set(document.path, document.id);
  }

  const outgoingLinksByDocumentId = new Map<string, WorkspaceKnowledgeLink[]>();
  const backlinksByDocumentId = new Map<string, WorkspaceKnowledgeLink[]>();
  const brokenLinks: WorkspaceKnowledgeLink[] = [];
  const externalLinks: WorkspaceKnowledgeLink[] = [];

  for (const analysis of analysesByDocumentId.values()) {
    const outgoing: WorkspaceKnowledgeLink[] = [];
    for (const link of analysis.links) {
      const base = {
        ...link,
        sourceDocumentId: analysis.documentId,
        sourcePath: analysis.path,
      };
      if (externalTargetPattern.test(link.target)) {
        const externalLink: WorkspaceKnowledgeLink = { ...base, status: "external" };
        outgoing.push(externalLink);
        externalLinks.push(externalLink);
        continue;
      }

      const target = splitLinkTarget(link.target);
      const targetPath = target.path
        ? resolvePath(analysis.path, target.path)
        : analysis.path;
      const targetDocumentId = targetPath ? documentIdsByPath.get(targetPath) : undefined;
      const resolvedLink: WorkspaceKnowledgeLink = targetPath && targetDocumentId
        ? {
            ...base,
            status: "resolved",
            targetDocumentId,
            targetPath,
            fragment: target.fragment,
          }
        : {
            ...base,
            status: "broken",
            targetPath: targetPath ?? undefined,
            fragment: target.fragment,
          };
      outgoing.push(resolvedLink);
      if (targetDocumentId) {
        const backlinks = backlinksByDocumentId.get(targetDocumentId) ?? [];
        backlinks.push(resolvedLink);
        backlinksByDocumentId.set(targetDocumentId, backlinks);
      } else {
        brokenLinks.push(resolvedLink);
      }
    }
    outgoingLinksByDocumentId.set(analysis.documentId, outgoing);
  }

  return {
    documentsById,
    documentIdsByPath,
    analysesByDocumentId,
    outgoingLinksByDocumentId,
    backlinksByDocumentId,
    brokenLinks,
    externalLinks,
  };
};

export const createWorkspaceKnowledgeIndex = (
  documents: readonly WorkspaceSourceDocument[],
): WorkspaceKnowledgeIndex => {
  const documentsById = new Map<string, WorkspaceSourceDocument>();
  const analysesByDocumentId = new Map<string, DocumentAnalysis>();
  for (const document of documents) {
    assertWorkspaceSourceDocument(document);
    if (documentsById.has(document.id)) {
      throw new Error(`Duplicate workspace document id: ${document.id}`);
    }
    documentsById.set(document.id, document);
    analysesByDocumentId.set(document.id, analyzeWorkspaceDocument(document));
  }
  return buildKnowledgeIndex(documentsById, analysesByDocumentId);
};

export const updateWorkspaceKnowledgeIndex = (
  index: WorkspaceKnowledgeIndex,
  document: WorkspaceSourceDocument,
): WorkspaceKnowledgeIndex => {
  assertWorkspaceSourceDocument(document);
  const documentsById = new Map(index.documentsById);
  const analysesByDocumentId = new Map(index.analysesByDocumentId);
  documentsById.set(document.id, document);
  analysesByDocumentId.set(document.id, analyzeWorkspaceDocument(document));
  return buildKnowledgeIndex(documentsById, analysesByDocumentId);
};

export const removeWorkspaceDocumentFromKnowledgeIndex = (
  index: WorkspaceKnowledgeIndex,
  documentId: string,
): WorkspaceKnowledgeIndex => {
  const documentsById = new Map(index.documentsById);
  const analysesByDocumentId = new Map(index.analysesByDocumentId);
  documentsById.delete(documentId);
  analysesByDocumentId.delete(documentId);
  return buildKnowledgeIndex(documentsById, analysesByDocumentId);
};
