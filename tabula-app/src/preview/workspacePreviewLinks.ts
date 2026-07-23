import type {
  DocumentLinkSyntax,
  WorkspaceKnowledgeIndex,
  WorkspaceKnowledgeLink,
} from "@tabula-md/tabula";
import type { MarkdownPreviewWorkspaceLink } from "./markdownPreviewTypes";

const getMatchingMarkdownLink = (
  index: WorkspaceKnowledgeIndex,
  sourceDocumentId: string,
  target: string,
  syntax: DocumentLinkSyntax,
): WorkspaceKnowledgeLink | undefined =>
  index.outgoingLinksByDocumentId
    .get(sourceDocumentId)
    ?.find((link) => link.syntax === syntax && link.target === target);

export const resolveMarkdownPreviewWorkspaceLink = (
  index: WorkspaceKnowledgeIndex | undefined,
  sourceDocumentId: string | undefined,
  target: string,
  syntax: DocumentLinkSyntax = "markdown",
): MarkdownPreviewWorkspaceLink | undefined => {
  if (!index || !sourceDocumentId) {
    return undefined;
  }

  const link = getMatchingMarkdownLink(index, sourceDocumentId, target, syntax);
  if (!link || link.status === "external") {
    return undefined;
  }

  if (link.status === "resolved" && link.targetDocumentId) {
    const sourceLineNumber = link.fragment
      ? index.analysesByDocumentId
        .get(link.targetDocumentId)
        ?.headings.find((heading) => heading.id === link.fragment)
        ?.sourceLineNumber
      : undefined;
    return {
      status: "resolved",
      relation: link.relation,
      syntax: link.syntax,
      targetDocumentId: link.targetDocumentId,
      targetPath: link.targetPath,
      fragment: link.fragment,
      sourceLineNumber,
    };
  }

  if (link.status === "broken" || link.status === "ambiguous") {
    return {
      status: link.status,
      relation: link.relation,
      syntax: link.syntax,
      targetPath: link.targetPath,
    };
  }

  return undefined;
};

export const decodeMarkdownPreviewFragment = (fragment: string) => {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
};
