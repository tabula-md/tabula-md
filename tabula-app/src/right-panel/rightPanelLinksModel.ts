import type {
  WorkspaceKnowledgeIndex,
  WorkspaceKnowledgeLink,
} from "@tabula-md/tabula";

export type RightPanelLinkTargetGroup = {
  key: string;
  status: WorkspaceKnowledgeLink["status"];
  link: WorkspaceKnowledgeLink;
  links: readonly WorkspaceKnowledgeLink[];
  documentId?: string;
};

export type RightPanelDocumentLinkGroup = {
  documentId: string;
  links: readonly WorkspaceKnowledgeLink[];
};

export type RightPanelLinksModel = {
  outgoing: readonly RightPanelLinkTargetGroup[];
  backlinks: readonly RightPanelDocumentLinkGroup[];
};

const groupDocumentLinks = (
  links: readonly WorkspaceKnowledgeLink[],
  getDocumentId: (link: WorkspaceKnowledgeLink) => string | undefined,
) => {
  const groupsByDocumentId = new Map<string, {
    documentId: string;
    links: WorkspaceKnowledgeLink[];
  }>();

  for (const link of links) {
    const documentId = getDocumentId(link);
    if (!documentId) continue;
    const group = groupsByDocumentId.get(documentId) ?? {
      documentId,
      links: [],
    };
    group.links.push(link);
    groupsByDocumentId.set(documentId, group);
  }

  return [...groupsByDocumentId.values()];
};

export const getRightPanelLinksModel = (
  index: WorkspaceKnowledgeIndex,
  activeDocumentId: string,
): RightPanelLinksModel => {
  const outgoingLinks = index.outgoingLinksByDocumentId.get(activeDocumentId) ?? [];
  const outgoingByKey = new Map<string, {
    key: string;
    status: WorkspaceKnowledgeLink["status"];
    link: WorkspaceKnowledgeLink;
    links: WorkspaceKnowledgeLink[];
    documentId?: string;
  }>();
  for (const link of outgoingLinks) {
    if (link.status === "resolved" && link.targetDocumentId === activeDocumentId) {
      continue;
    }
    const targetKey = link.status === "resolved"
      ? `document:${link.targetDocumentId ?? link.target}`
      : `${link.status}:${link.targetPath ?? link.target}`;
    const key = `${activeDocumentId}:${targetKey}`;
    const group = outgoingByKey.get(key) ?? {
      key,
      status: link.status,
      link,
      links: [],
      documentId: link.targetDocumentId,
    };
    group.links.push(link);
    outgoingByKey.set(key, group);
  }
  const backlinks = groupDocumentLinks(
    (index.backlinksByDocumentId.get(activeDocumentId) ?? [])
      .filter((link) => link.sourceDocumentId !== activeDocumentId),
    (link) => link.sourceDocumentId,
  );

  return {
    outgoing: [...outgoingByKey.values()],
    backlinks,
  };
};
