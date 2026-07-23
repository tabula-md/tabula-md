import type {
  DocumentLinkRelation,
  WorkspaceKnowledgeIndex,
  WorkspaceKnowledgeLink,
} from "@tabula-md/tabula";

export type RightPanelResolvedLinkGroup = {
  documentId: string;
  relation: DocumentLinkRelation;
  fragment?: string;
  links: readonly WorkspaceKnowledgeLink[];
  mentionCount: number;
};

export type RightPanelLinksModel = {
  outgoing: readonly RightPanelResolvedLinkGroup[];
  backlinks: readonly RightPanelResolvedLinkGroup[];
  external: readonly WorkspaceKnowledgeLink[];
  issues: readonly WorkspaceKnowledgeLink[];
};

const groupResolvedLinks = (
  links: readonly WorkspaceKnowledgeLink[],
  getDocumentId: (link: WorkspaceKnowledgeLink) => string | undefined,
  includeFragment: boolean,
) => {
  const groupsByKey = new Map<string, {
    documentId: string;
    relation: DocumentLinkRelation;
    fragment?: string;
    links: WorkspaceKnowledgeLink[];
  }>();

  for (const link of links) {
    const documentId = getDocumentId(link);
    if (!documentId) continue;
    const fragment = includeFragment ? link.fragment : undefined;
    const key = `${documentId}:${link.relation}:${fragment ?? ""}`;
    const group = groupsByKey.get(key) ?? {
      documentId,
      relation: link.relation,
      fragment,
      links: [],
    };
    group.links.push(link);
    groupsByKey.set(key, group);
  }

  return [...groupsByKey.values()].map((group) => ({
    ...group,
    mentionCount: group.links.length,
  }));
};

export const getRightPanelLinksModel = (
  index: WorkspaceKnowledgeIndex,
  activeDocumentId: string,
): RightPanelLinksModel => {
  const outgoingLinks = index.outgoingLinksByDocumentId.get(activeDocumentId) ?? [];
  const outgoing = groupResolvedLinks(
    outgoingLinks.filter((link) =>
      link.status === "resolved" &&
      link.targetDocumentId !== activeDocumentId),
    (link) => link.targetDocumentId,
    true,
  );
  const backlinks = groupResolvedLinks(
    (index.backlinksByDocumentId.get(activeDocumentId) ?? [])
      .filter((link) => link.sourceDocumentId !== activeDocumentId),
    (link) => link.sourceDocumentId,
    false,
  );
  const external = outgoingLinks.filter((link) => link.status === "external");
  const issues = outgoingLinks.filter((link) =>
    link.status === "broken" || link.status === "ambiguous");

  return {
    outgoing,
    backlinks,
    external,
    issues,
  };
};
