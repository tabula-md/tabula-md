import type {
  WorkspaceKnowledgeIndex,
  WorkspaceKnowledgeLink,
} from "@tabula-md/tabula";
import type { MarkdownPreviewWorkspaceLink } from "./markdownPreviewTypes";

const getMatchingMarkdownLink = (
  index: WorkspaceKnowledgeIndex,
  sourceDocumentId: string,
  href: string,
): WorkspaceKnowledgeLink | undefined =>
  index.outgoingLinksByDocumentId
    .get(sourceDocumentId)
    ?.find((link) => link.syntax === "markdown" && link.target === href);

export const resolveMarkdownPreviewWorkspaceLink = (
  index: WorkspaceKnowledgeIndex | undefined,
  sourceDocumentId: string | undefined,
  href: string,
): MarkdownPreviewWorkspaceLink | undefined => {
  if (!index || !sourceDocumentId) {
    return undefined;
  }

  const link = getMatchingMarkdownLink(index, sourceDocumentId, href);
  if (!link || link.status === "external") {
    return undefined;
  }

  if (link.status === "resolved" && link.targetDocumentId) {
    return {
      status: "resolved",
      targetDocumentId: link.targetDocumentId,
      targetPath: link.targetPath,
      fragment: link.fragment,
    };
  }

  if (link.status === "broken" || link.status === "ambiguous") {
    return {
      status: link.status,
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
