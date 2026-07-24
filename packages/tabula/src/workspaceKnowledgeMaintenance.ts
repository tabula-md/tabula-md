import { fromMarkdown } from "mdast-util-from-markdown";
import { parseFrontmatterData } from "./markdown/parse";
import { applyTextPatches, type TextPatch } from "./textPatches";
import {
  createWorkspaceKnowledgeIndex,
  type DocumentLinkAnalysis,
  type WorkspaceKnowledgeLink,
  type WorkspaceSourceDocument,
} from "./workspaceKnowledgeIndex";

export type WorkspaceKnowledgeMaintenanceUpdate = {
  documentId: string;
  markdown: string;
  patches: readonly TextPatch[];
  updatedLinkCount: number;
};

export type WorkspaceKnowledgeMaintenancePlan = {
  updates: readonly WorkspaceKnowledgeMaintenanceUpdate[];
  updatedDocumentCount: number;
  updatedLinkCount: number;
  skippedLinkCount: number;
};

export const EMPTY_WORKSPACE_KNOWLEDGE_MAINTENANCE_PLAN: WorkspaceKnowledgeMaintenancePlan =
  Object.freeze({
    updates: Object.freeze([]),
    updatedDocumentCount: 0,
    updatedLinkCount: 0,
    skippedLinkCount: 0,
  });

type DefinitionNode = {
  type: string;
  identifier?: string;
  url?: string;
  children?: DefinitionNode[];
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
};

type LinkTargetParts = {
  path: string;
  suffix: string;
};

type PendingPatch = {
  patch: TextPatch;
  linkCount: number;
};

const normalizeReferenceIdentifier = (identifier: string) =>
  identifier.trim().replace(/\s+/g, " ").toLowerCase();

const splitLinkTarget = (target: string): LinkTargetParts => {
  const hashIndex = target.indexOf("#");
  const queryIndex = target.indexOf("?");
  const suffixIndex = [hashIndex, queryIndex]
    .filter((index) => index >= 0)
    .reduce((minimum, index) => Math.min(minimum, index), target.length);
  return {
    path: target.slice(0, suffixIndex),
    suffix: target.slice(suffixIndex),
  };
};

const decodePathSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const encodeMarkdownPathSegment = (segment: string) => encodeURIComponent(segment);
const encodeWikiPathSegment = (segment: string) =>
  encodeURIComponent(segment).replace(/%20/g, " ");

const getRelativePathSegments = (sourcePath: string, targetPath: string) => {
  const sourceDirectory = sourcePath.split("/").slice(0, -1);
  const targetSegments = targetPath.split("/");
  let commonLength = 0;
  while (
    commonLength < sourceDirectory.length &&
    commonLength < targetSegments.length &&
    sourceDirectory[commonLength] === targetSegments[commonLength]
  ) {
    commonLength += 1;
  }
  return [
    ...Array.from({ length: sourceDirectory.length - commonLength }, () => ".."),
    ...targetSegments.slice(commonLength),
  ];
};

const formatMaintainedPath = ({
  originalPath,
  sourcePath,
  targetPath,
  syntax,
}: {
  originalPath: string;
  sourcePath: string;
  targetPath: string;
  syntax: DocumentLinkAnalysis["syntax"];
}) => {
  const isRootRelative = originalPath.startsWith("/");
  const originalSegments = originalPath
    .replace(/^\/+/, "")
    .split("/")
    .map(decodePathSegment);
  const originalBasename = originalSegments.at(-1) ?? "";
  const omitMarkdownExtension =
    syntax === "wikilink" && !/\.(?:md|markdown)$/i.test(originalBasename);
  const nextTargetSegments = targetPath.split("/");
  if (omitMarkdownExtension) {
    const basename = nextTargetSegments.at(-1);
    if (basename) {
      nextTargetSegments[nextTargetSegments.length - 1] =
        basename.replace(/\.(?:md|markdown)$/i, "");
    }
  }
  const pathSegments = isRootRelative
    ? nextTargetSegments
    : getRelativePathSegments(sourcePath, nextTargetSegments.join("/"));
  const encodeSegment =
    syntax === "wikilink" ? encodeWikiPathSegment : encodeMarkdownPathSegment;
  const encodedPath = pathSegments.map(encodeSegment).join("/");
  if (isRootRelative) {
    return `/${encodedPath}`;
  }
  if (originalPath.startsWith("./") && !encodedPath.startsWith("../")) {
    return `./${encodedPath}`;
  }
  return encodedPath;
};

const getMaintainedTarget = (
  link: WorkspaceKnowledgeLink,
  sourcePath: string,
  targetPath: string,
) => {
  const original = splitLinkTarget(link.target);
  return `${formatMaintainedPath({
    originalPath: original.path,
    sourcePath,
    targetPath,
    syntax: link.syntax,
  })}${original.suffix}`;
};

const getWikiLinkTargetPatch = (
  markdown: string,
  link: DocumentLinkAnalysis,
  nextTarget: string,
): TextPatch | null => {
  const source = markdown.slice(link.from, link.to);
  const opening = source.indexOf("[[");
  if (opening === -1) return null;
  const contentFrom = opening + 2;
  const closing = source.lastIndexOf("]]");
  if (closing < contentFrom) return null;
  const alias = source.indexOf("|", contentFrom);
  const contentTo = alias >= 0 && alias < closing ? alias : closing;
  const targetSource = source.slice(contentFrom, contentTo);
  const leadingWhitespace = targetSource.length - targetSource.trimStart().length;
  const trailingWhitespace = targetSource.length - targetSource.trimEnd().length;
  return {
    from: link.from + contentFrom + leadingWhitespace,
    to: link.from + contentTo - trailingWhitespace,
    insert: nextTarget,
  };
};

const findDestinationRange = (
  source: string,
  destinationFrom: number,
  sourceOffset: number,
): Pick<TextPatch, "from" | "to"> | null => {
  let cursor = destinationFrom;
  while (cursor < source.length && /\s/.test(source[cursor] ?? "")) cursor += 1;
  if (source[cursor] === "<") {
    const close = source.indexOf(">", cursor + 1);
    return close === -1
      ? null
      : { from: sourceOffset + cursor + 1, to: sourceOffset + close };
  }
  const start = cursor;
  let nestedParentheses = 0;
  let escaped = false;
  while (cursor < source.length) {
    const character = source[cursor] ?? "";
    if (escaped) {
      escaped = false;
      cursor += 1;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      cursor += 1;
      continue;
    }
    if (character === "(") {
      nestedParentheses += 1;
    } else if (character === ")") {
      if (nestedParentheses === 0) break;
      nestedParentheses -= 1;
    } else if (/\s/.test(character) && nestedParentheses === 0) {
      break;
    }
    cursor += 1;
  }
  return cursor > start
    ? { from: sourceOffset + start, to: sourceOffset + cursor }
    : null;
};

const getInlineMarkdownTargetPatch = (
  markdown: string,
  link: DocumentLinkAnalysis,
  nextTarget: string,
): TextPatch | null => {
  const source = markdown.slice(link.from, link.to);
  const destinationMarker = source.lastIndexOf("](");
  if (destinationMarker === -1) return null;
  const range = findDestinationRange(
    source,
    destinationMarker + 2,
    link.from,
  );
  return range ? { ...range, insert: nextTarget } : null;
};

const getDefinitionTargetPatches = (markdown: string) => {
  const parsed = parseFrontmatterData(markdown);
  const root = fromMarkdown(parsed.body) as DefinitionNode;
  const ranges = new Map<string, Pick<TextPatch, "from" | "to">>();
  const visit = (node: DefinitionNode) => {
    if (
      node.type === "definition" &&
      node.identifier &&
      typeof node.url === "string" &&
      typeof node.position?.start.offset === "number" &&
      typeof node.position.end.offset === "number"
    ) {
      const source = parsed.body.slice(
        node.position.start.offset,
        node.position.end.offset,
      );
      const marker = source.indexOf("]:");
      const range = marker === -1
        ? null
        : findDestinationRange(
            source,
            marker + 2,
            parsed.bodyOffset + node.position.start.offset,
          );
      if (range) {
        const identifier = normalizeReferenceIdentifier(node.identifier);
        if (!ranges.has(identifier)) ranges.set(identifier, range);
      }
    }
    node.children?.forEach(visit);
  };
  visit(root);
  return ranges;
};

const getLinkTargetPatch = ({
  definitionRanges,
  link,
  markdown,
  nextTarget,
}: {
  definitionRanges: ReadonlyMap<string, Pick<TextPatch, "from" | "to">>;
  link: DocumentLinkAnalysis;
  markdown: string;
  nextTarget: string;
}): TextPatch | null => {
  if (link.syntax === "wikilink") {
    return getWikiLinkTargetPatch(markdown, link, nextTarget);
  }
  if (link.referenceIdentifier) {
    const range = definitionRanges.get(link.referenceIdentifier);
    return range ? { ...range, insert: nextTarget } : null;
  }
  return getInlineMarkdownTargetPatch(markdown, link, nextTarget);
};

const getMatchingLink = (
  links: readonly WorkspaceKnowledgeLink[],
  previous: WorkspaceKnowledgeLink,
) => links.find((link) =>
  link.from === previous.from &&
  link.to === previous.to &&
  link.syntax === previous.syntax &&
  link.relation === previous.relation
);

export const planWorkspaceKnowledgeMaintenance = (
  previousDocuments: readonly WorkspaceSourceDocument[],
  nextDocuments: readonly WorkspaceSourceDocument[],
): WorkspaceKnowledgeMaintenancePlan => {
  const previousIndex = createWorkspaceKnowledgeIndex(previousDocuments);
  const nextIndex = createWorkspaceKnowledgeIndex(nextDocuments);
  const nextDocumentsById = new Map(
    nextDocuments.map((document) => [document.id, document]),
  );
  const updates: WorkspaceKnowledgeMaintenanceUpdate[] = [];
  let skippedLinkCount = 0;

  for (const previousDocument of previousDocuments) {
    const nextDocument = nextDocumentsById.get(previousDocument.id);
    if (!nextDocument) continue;
    const previousLinks =
      previousIndex.outgoingLinksByDocumentId.get(previousDocument.id) ?? [];
    const nextLinks =
      nextIndex.outgoingLinksByDocumentId.get(previousDocument.id) ?? [];
    const definitionRanges = getDefinitionTargetPatches(previousDocument.markdown);
    const pendingPatches = new Map<string, PendingPatch>();

    for (const previousLink of previousLinks) {
      if (
        previousLink.status !== "resolved" ||
        !previousLink.targetDocumentId
      ) {
        continue;
      }
      const nextTargetDocument = nextDocumentsById.get(
        previousLink.targetDocumentId,
      );
      if (!nextTargetDocument) continue;
      const nextLink = getMatchingLink(nextLinks, previousLink);
      if (
        nextLink?.status === "resolved" &&
        nextLink.targetDocumentId === previousLink.targetDocumentId
      ) {
        continue;
      }
      const nextTarget = getMaintainedTarget(
        previousLink,
        nextDocument.path,
        nextTargetDocument.path,
      );
      const patch = getLinkTargetPatch({
        definitionRanges,
        link: previousLink,
        markdown: previousDocument.markdown,
        nextTarget,
      });
      if (!patch) {
        skippedLinkCount += 1;
        continue;
      }
      const key = `${patch.from}:${patch.to}`;
      const pending = pendingPatches.get(key);
      if (pending && pending.patch.insert !== patch.insert) {
        pendingPatches.delete(key);
        skippedLinkCount += pending.linkCount + 1;
        continue;
      }
      pendingPatches.set(key, {
        patch,
        linkCount: (pending?.linkCount ?? 0) + 1,
      });
    }

    const patches = [...pendingPatches.values()].map(({ patch }) => patch);
    const markdown = applyTextPatches(previousDocument.markdown, patches);
    if (markdown === null || markdown === previousDocument.markdown) {
      skippedLinkCount += [...pendingPatches.values()].reduce(
        (total, pending) => total + pending.linkCount,
        0,
      );
      continue;
    }
    updates.push({
      documentId: previousDocument.id,
      markdown,
      patches,
      updatedLinkCount: [...pendingPatches.values()].reduce(
        (total, pending) => total + pending.linkCount,
        0,
      ),
    });
  }

  return {
    updates,
    updatedDocumentCount: updates.length,
    updatedLinkCount: updates.reduce(
      (total, update) => total + update.updatedLinkCount,
      0,
    ),
    skippedLinkCount,
  };
};
