import type { WorkspaceKnowledgeIndex, WorkspaceKnowledgeLink } from "@tabula-md/tabula";

export type RightPanelLinksModel = {
  outgoing: readonly WorkspaceKnowledgeLink[];
  backlinks: readonly WorkspaceKnowledgeLink[];
  broken: readonly WorkspaceKnowledgeLink[];
  ambiguous: readonly WorkspaceKnowledgeLink[];
  external: readonly WorkspaceKnowledgeLink[];
  hasLinks: boolean;
};

export const getRightPanelLinksModel = (
  index: WorkspaceKnowledgeIndex,
  activeDocumentId: string,
): RightPanelLinksModel => {
  const outgoingLinks = index.outgoingLinksByDocumentId.get(activeDocumentId) ?? [];
  const outgoing = outgoingLinks.filter((link) =>
    link.status === "resolved" &&
    link.targetDocumentId !== activeDocumentId
  );
  const backlinks = (index.backlinksByDocumentId.get(activeDocumentId) ?? [])
    .filter((link) => link.sourceDocumentId !== activeDocumentId);
  const broken = outgoingLinks.filter((link) => link.status === "broken");
  const ambiguous = outgoingLinks.filter((link) => link.status === "ambiguous");
  const external = outgoingLinks.filter((link) => link.status === "external");

  return {
    outgoing,
    backlinks,
    broken,
    ambiguous,
    external,
    hasLinks:
      outgoing.length + backlinks.length + broken.length + ambiguous.length + external.length > 0,
  };
};
