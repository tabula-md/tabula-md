import { fromMarkdown } from "mdast-util-from-markdown";
import GithubSlugger from "github-slugger";
import { getMarkdownDocumentTitle, parseFrontmatterData } from "./markdown/parse";
import { isWorkspacePathSegment } from "./workspacePath";

export type WorkspaceSourceDocument = {
  id: string;
  path: string;
  markdown: string;
};

export type DocumentHeadingAnalysis = {
  depth: number;
  id: string;
  sourceLineNumber: number;
  text: string;
  from: number;
  to: number;
};

export type DocumentLinkSyntax = "markdown" | "wikilink";
export type DocumentLinkRelation = "link" | "embed";

export type MarkdownWikiLinkToken = {
  relation: DocumentLinkRelation;
  label: string;
  target: string;
  from: number;
  to: number;
};

export type DocumentLinkAnalysis = {
  syntax: DocumentLinkSyntax;
  relation: DocumentLinkRelation;
  label: string;
  target: string;
  referenceIdentifier?: string;
  from: number;
  to: number;
};

export type WorkspaceKnowledgeMetadata = {
  type?: string;
  tags: readonly string[];
  resource?: string;
};

export type DocumentAnalysis = {
  documentId: string;
  path: string;
  title: string;
  metadata: Record<string, unknown>;
  knowledgeMetadata: WorkspaceKnowledgeMetadata;
  headings: readonly DocumentHeadingAnalysis[];
  links: readonly DocumentLinkAnalysis[];
};

export type WorkspaceLinkStatus = "resolved" | "broken" | "ambiguous" | "external";

export type WorkspaceKnowledgeLink = DocumentLinkAnalysis & {
  sourceDocumentId: string;
  sourcePath: string;
  status: WorkspaceLinkStatus;
  targetDocumentId?: string;
  targetPath?: string;
  fragment?: string;
  candidateDocumentIds?: readonly string[];
};

export type WorkspaceKnowledgeIndex = {
  documentsById: ReadonlyMap<string, WorkspaceSourceDocument>;
  documentIdsByPath: ReadonlyMap<string, string>;
  analysesByDocumentId: ReadonlyMap<string, DocumentAnalysis>;
  documentIdsByType: ReadonlyMap<string, readonly string[]>;
  documentIdsByTag: ReadonlyMap<string, readonly string[]>;
  documentIdsByResource: ReadonlyMap<string, readonly string[]>;
  outgoingLinksByDocumentId: ReadonlyMap<string, readonly WorkspaceKnowledgeLink[]>;
  backlinksByDocumentId: ReadonlyMap<string, readonly WorkspaceKnowledgeLink[]>;
  brokenLinks: readonly WorkspaceKnowledgeLink[];
  ambiguousLinks: readonly WorkspaceKnowledgeLink[];
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
    start: { line?: number; offset?: number };
    end: { offset?: number };
  };
};

const visitAst = (
  node: AstNode,
  visitor: (node: AstNode, ancestors: readonly AstNode[]) => void,
  ancestors: readonly AstNode[] = [],
) => {
  visitor(node, ancestors);
  node.children?.forEach((child) => visitAst(child, visitor, [...ancestors, node]));
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

const getNonEmptyMetadataString = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const getKnowledgeTags = (value: unknown) => {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const candidate of values) {
    const tag = getNonEmptyMetadataString(candidate);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
};

const getWorkspaceKnowledgeMetadata = (
  metadata: Readonly<Record<string, unknown>>,
): WorkspaceKnowledgeMetadata => {
  const type = getNonEmptyMetadataString(metadata.type);
  const resource = getNonEmptyMetadataString(metadata.resource);
  return {
    ...(type ? { type } : {}),
    tags: getKnowledgeTags(metadata.tags),
    ...(resource ? { resource } : {}),
  };
};

const isEscapedAt = (text: string, offset: number) => {
  let backslashCount = 0;
  for (let cursor = offset - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
};

const findWikiLinkClose = (text: string, from: number) => {
  let cursor = text.indexOf("]]", from);
  while (cursor !== -1 && isEscapedAt(text, cursor)) {
    cursor = text.indexOf("]]", cursor + 2);
  }
  return cursor;
};

export const scanMarkdownWikiLinks = (text: string): MarkdownWikiLinkToken[] => {
  const links: MarkdownWikiLinkToken[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const opening = text.indexOf("[[", cursor);
    if (opening === -1) {
      break;
    }
    if (isEscapedAt(text, opening)) {
      cursor = opening + 2;
      continue;
    }

    const closing = findWikiLinkClose(text, opening + 2);
    if (closing === -1) {
      break;
    }
    const content = text.slice(opening + 2, closing);
    const aliasSeparator = content.indexOf("|");
    const target = content.slice(0, aliasSeparator === -1 ? undefined : aliasSeparator).trim();
    if (target && !target.includes("[[")) {
      const embedMarker = opening > 0 && text[opening - 1] === "!" && !isEscapedAt(text, opening - 1);
      const alias = aliasSeparator === -1 ? "" : content.slice(aliasSeparator + 1).trim();
      links.push({
        relation: embedMarker ? "embed" : "link",
        label: alias || target,
        target,
        from: embedMarker ? opening - 1 : opening,
        to: closing + 2,
      });
    }
    cursor = closing + 2;
  }
  return links;
};

const getWikiLinksFromTextNode = (
  node: AstNode,
  body: string,
  bodyOffset: number,
): DocumentLinkAnalysis[] => {
  const offsets = getNodeOffsets(node, 0);
  if (!offsets) {
    return [];
  }

  const source = body.slice(offsets.from, offsets.to);
  return scanMarkdownWikiLinks(source).map((link) => ({
    syntax: "wikilink",
    ...link,
    from: offsets.from + link.from + bodyOffset,
    to: offsets.from + link.to + bodyOffset,
  }));
};

const wikiLinkIgnoredAncestorTypes = new Set([
  "image",
  "imageReference",
  "link",
  "linkReference",
]);

export const analyzeWorkspaceDocument = (document: WorkspaceSourceDocument): DocumentAnalysis => {
  const parsed = parseFrontmatterData(document.markdown);
  const root = fromMarkdown(parsed.body) as AstNode;
  const definitions = new Map<string, string>();
  const headings: DocumentHeadingAnalysis[] = [];
  const links: DocumentLinkAnalysis[] = [];
  const headingSlugger = new GithubSlugger();
  const bodyLineOffset = document.markdown.slice(0, parsed.bodyOffset).split("\n").length - 1;

  visitAst(root, (node) => {
    if (node.type === "definition" && node.identifier && typeof node.url === "string") {
      const identifier = normalizeReferenceIdentifier(node.identifier);
      if (!definitions.has(identifier)) {
        definitions.set(identifier, node.url);
      }
    }
  });

  visitAst(root, (node, ancestors) => {
    const offsets = getNodeOffsets(node, parsed.bodyOffset);
    if (!offsets) {
      return;
    }

    if (node.type === "heading" && node.depth) {
      const text = getNodeText(node).trim();
      if (text) {
        headings.push({
          depth: node.depth,
          id: headingSlugger.slug(text),
          sourceLineNumber: bodyLineOffset + (node.position?.start.line ?? 1),
          text,
          ...offsets,
        });
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
      links.push({
        syntax: "markdown",
        relation: "link",
        label: getNodeText(node).trim(),
        target,
        ...(node.type === "linkReference" && node.identifier
          ? { referenceIdentifier: normalizeReferenceIdentifier(node.identifier) }
          : {}),
        ...offsets,
      });
      return;
    }

    if (
      node.type === "text" &&
      !ancestors.some((ancestor) => wikiLinkIgnoredAncestorTypes.has(ancestor.type))
    ) {
      links.push(...getWikiLinksFromTextNode(node, parsed.body, parsed.bodyOffset));
    }
  });

  return {
    documentId: document.id,
    path: document.path,
    title: getMarkdownDocumentTitle(document.markdown),
    metadata: parsed.metadata,
    knowledgeMetadata: getWorkspaceKnowledgeMetadata(parsed.metadata),
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

type InternalLinkResolution =
  | {
      status: "resolved";
      targetDocumentId: string;
      targetPath: string;
      fragment?: string;
    }
  | {
      status: "broken";
      targetPath?: string;
      fragment?: string;
    }
  | {
      status: "ambiguous";
      targetPath: string;
      fragment?: string;
      candidateDocumentIds: readonly string[];
    };

const resolveMarkdownTarget = (
  sourcePath: string,
  target: ReturnType<typeof splitLinkTarget>,
  documentIdsByPath: ReadonlyMap<string, string>,
): InternalLinkResolution => {
  const targetPath = target.path ? resolvePath(sourcePath, target.path) : sourcePath;
  const targetDocumentId = targetPath ? documentIdsByPath.get(targetPath) : undefined;
  return targetPath && typeof targetDocumentId !== "undefined"
    ? {
        status: "resolved",
        targetDocumentId,
        targetPath,
        fragment: target.fragment,
      }
    : {
        status: "broken",
        targetPath: targetPath ?? undefined,
        fragment: target.fragment,
      };
};

const getWikiPathVariants = (path: string) => {
  const basename = path.split("/").at(-1) ?? "";
  return /\.[^./]+$/.test(basename) ? [path] : [path, `${path}.md`, `${path}.markdown`];
};

const getCandidateDocumentIds = (
  paths: readonly string[],
  documentIdsByPath: ReadonlyMap<string, string>,
) => [
  ...new Set(
    paths
      .map((path) => documentIdsByPath.get(path))
      .filter((id): id is string => typeof id !== "undefined"),
  ),
];

const resolveWikiTarget = (
  sourcePath: string,
  target: ReturnType<typeof splitLinkTarget>,
  documentsById: ReadonlyMap<string, WorkspaceSourceDocument>,
  documentIdsByPath: ReadonlyMap<string, string>,
): InternalLinkResolution => {
  if (!target.path) {
    const targetDocumentId = documentIdsByPath.get(sourcePath);
    return typeof targetDocumentId !== "undefined"
      ? {
          status: "resolved",
          targetDocumentId,
          targetPath: sourcePath,
          fragment: target.fragment,
        }
      : { status: "broken", targetPath: sourcePath, fragment: target.fragment };
  }

  const resolvedBasePath = resolvePath(sourcePath, target.path);
  if (!resolvedBasePath) {
    return { status: "broken", fragment: target.fragment };
  }

  const directCandidateIds = getCandidateDocumentIds(
    getWikiPathVariants(resolvedBasePath),
    documentIdsByPath,
  );
  if (directCandidateIds.length === 1) {
    const targetDocumentId = directCandidateIds[0];
    const targetPath = documentsById.get(targetDocumentId)?.path;
    if (!targetPath) {
      return { status: "broken", targetPath: resolvedBasePath, fragment: target.fragment };
    }
    return {
      status: "resolved",
      targetDocumentId,
      targetPath,
      fragment: target.fragment,
    };
  }
  if (directCandidateIds.length > 1) {
    return {
      status: "ambiguous",
      targetPath: resolvedBasePath,
      fragment: target.fragment,
      candidateDocumentIds: directCandidateIds,
    };
  }

  const isBareTarget = !target.path.includes("/") && !target.path.startsWith(".");
  if (!isBareTarget) {
    return {
      status: "broken",
      targetPath: resolvedBasePath,
      fragment: target.fragment,
    };
  }

  const resolvedBasename = resolvedBasePath.split("/").at(-1) ?? "";
  const basenameVariants = new Set(getWikiPathVariants(resolvedBasename));
  const globalCandidates = [...documentsById.values()]
    .filter((document) => basenameVariants.has(document.path.split("/").at(-1) ?? ""))
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
    .map((document) => document.id);
  if (globalCandidates.length === 1) {
    const targetDocumentId = globalCandidates[0];
    const targetPath = documentsById.get(targetDocumentId)?.path;
    if (!targetPath) {
      return { status: "broken", targetPath: resolvedBasePath, fragment: target.fragment };
    }
    return {
      status: "resolved",
      targetDocumentId,
      targetPath,
      fragment: target.fragment,
    };
  }
  return globalCandidates.length > 1
    ? {
        status: "ambiguous",
        targetPath: resolvedBasePath,
        fragment: target.fragment,
        candidateDocumentIds: globalCandidates,
      }
    : {
        status: "broken",
        targetPath: resolvedBasePath,
        fragment: target.fragment,
      };
};

const decodeLinkFragment = (fragment: string) => {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return null;
  }
};

const resolveHeadingFragment = (
  analysis: DocumentAnalysis | undefined,
  fragment: string,
  syntax: DocumentLinkSyntax,
) => {
  const decodedFragment = decodeLinkFragment(fragment);
  if (!analysis || decodedFragment === null) {
    return undefined;
  }

  if (syntax === "markdown") {
    return analysis.headings.find((heading) => heading.id === decodedFragment)?.id;
  }

  const normalizedFragment = decodedFragment.trim().toLocaleLowerCase();
  return analysis.headings.find((heading) =>
    heading.id === decodedFragment ||
    heading.text.trim().toLocaleLowerCase() === normalizedFragment
  )?.id;
};

const validateResolvedFragment = (
  link: DocumentLinkAnalysis,
  resolution: InternalLinkResolution,
  analysesByDocumentId: ReadonlyMap<string, DocumentAnalysis>,
): InternalLinkResolution => {
  if (
    resolution.status !== "resolved" ||
    typeof resolution.fragment === "undefined" ||
    resolution.fragment === ""
  ) {
    return resolution;
  }

  const fragment = resolveHeadingFragment(
    analysesByDocumentId.get(resolution.targetDocumentId),
    resolution.fragment,
    link.syntax,
  );
  return typeof fragment === "string"
    ? { ...resolution, fragment }
    : {
        status: "broken",
        targetPath: resolution.targetPath,
        fragment: resolution.fragment,
      };
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

  const documentIdsByType = new Map<string, string[]>();
  const documentIdsByTag = new Map<string, string[]>();
  const documentIdsByResource = new Map<string, string[]>();
  const addMetadataEntry = (
    entries: Map<string, string[]>,
    value: string,
    documentId: string,
  ) => {
    const documentIds = entries.get(value) ?? [];
    documentIds.push(documentId);
    entries.set(value, documentIds);
  };
  for (const analysis of analysesByDocumentId.values()) {
    const { type, tags, resource } = analysis.knowledgeMetadata;
    if (type) addMetadataEntry(documentIdsByType, type, analysis.documentId);
    for (const tag of tags) addMetadataEntry(documentIdsByTag, tag, analysis.documentId);
    if (resource) addMetadataEntry(documentIdsByResource, resource, analysis.documentId);
  }

  const outgoingLinksByDocumentId = new Map<string, WorkspaceKnowledgeLink[]>();
  const backlinksByDocumentId = new Map<string, WorkspaceKnowledgeLink[]>();
  const brokenLinks: WorkspaceKnowledgeLink[] = [];
  const ambiguousLinks: WorkspaceKnowledgeLink[] = [];
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
      const pathResolution = link.syntax === "markdown"
        ? resolveMarkdownTarget(analysis.path, target, documentIdsByPath)
        : resolveWikiTarget(analysis.path, target, documentsById, documentIdsByPath);
      const resolution = validateResolvedFragment(
        link,
        pathResolution,
        analysesByDocumentId,
      );
      const resolvedLink: WorkspaceKnowledgeLink = { ...base, ...resolution };
      outgoing.push(resolvedLink);
      if (resolution.status === "resolved" && typeof resolution.targetDocumentId !== "undefined") {
        const backlinks = backlinksByDocumentId.get(resolution.targetDocumentId) ?? [];
        backlinks.push(resolvedLink);
        backlinksByDocumentId.set(resolution.targetDocumentId, backlinks);
      } else if (resolution.status === "broken") {
        brokenLinks.push(resolvedLink);
      } else if (resolution.status === "ambiguous") {
        ambiguousLinks.push(resolvedLink);
      }
    }
    outgoingLinksByDocumentId.set(analysis.documentId, outgoing);
  }

  return {
    documentsById,
    documentIdsByPath,
    analysesByDocumentId,
    documentIdsByType,
    documentIdsByTag,
    documentIdsByResource,
    outgoingLinksByDocumentId,
    backlinksByDocumentId,
    brokenLinks,
    ambiguousLinks,
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
