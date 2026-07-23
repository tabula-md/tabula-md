import type { WorkspaceKnowledgeIndex } from "@tabula-md/tabula";

export const RIGHT_PANEL_GRAPH_MAX_DEPTH = 2;
export const RIGHT_PANEL_GRAPH_MAX_NODES = 13;

export type RightPanelGraphNode = {
  documentId: string;
  path: string;
  depth: number;
};

export type RightPanelGraphEdge = {
  sourceDocumentId: string;
  targetDocumentId: string;
  linkCount: number;
};

export type RightPanelGraphModel = {
  nodes: readonly RightPanelGraphNode[];
  edges: readonly RightPanelGraphEdge[];
  totalNodeCount: number;
  isTruncated: boolean;
  hasConnections: boolean;
};

export type RightPanelGraphLayoutNode = RightPanelGraphNode & {
  x: number;
  y: number;
};

const compareText = (first: string, second: string) =>
  first < second ? -1 : first > second ? 1 : 0;

const roundCoordinate = (value: number) => Math.round(value * 100) / 100;

const getDocumentSortKey = (index: WorkspaceKnowledgeIndex, documentId: string) =>
  index.documentsById.get(documentId)?.path ?? documentId;

const addAdjacentDocument = (
  adjacencyByDocumentId: Map<string, Set<string>>,
  documentId: string,
  adjacentDocumentId: string,
) => {
  const adjacentIds = adjacencyByDocumentId.get(documentId) ?? new Set<string>();
  adjacentIds.add(adjacentDocumentId);
  adjacencyByDocumentId.set(documentId, adjacentIds);
};

const incrementEdgeCount = (
  edgeCountsBySourceId: Map<string, Map<string, number>>,
  sourceDocumentId: string,
  targetDocumentId: string,
) => {
  const targetCounts = edgeCountsBySourceId.get(sourceDocumentId) ?? new Map<string, number>();
  targetCounts.set(targetDocumentId, (targetCounts.get(targetDocumentId) ?? 0) + 1);
  edgeCountsBySourceId.set(sourceDocumentId, targetCounts);
};

export const getRightPanelGraphModel = (
  index: WorkspaceKnowledgeIndex,
  activeDocumentId: string,
  options: { maxDepth?: number; maxNodes?: number } = {},
): RightPanelGraphModel => {
  const activeDocument = index.documentsById.get(activeDocumentId);
  if (!activeDocument) {
    return {
      nodes: [],
      edges: [],
      totalNodeCount: 0,
      isTruncated: false,
      hasConnections: false,
    };
  }

  const maxDepth = Math.max(0, options.maxDepth ?? RIGHT_PANEL_GRAPH_MAX_DEPTH);
  const maxNodes = Math.max(1, options.maxNodes ?? RIGHT_PANEL_GRAPH_MAX_NODES);
  const adjacencyByDocumentId = new Map<string, Set<string>>();
  const edgeCountsBySourceId = new Map<string, Map<string, number>>();

  for (const [sourceDocumentId, links] of index.outgoingLinksByDocumentId) {
    for (const link of links) {
      const targetDocumentId = link.status === "resolved" ? link.targetDocumentId : undefined;
      if (
        !targetDocumentId ||
        targetDocumentId === sourceDocumentId ||
        !index.documentsById.has(targetDocumentId)
      ) {
        continue;
      }
      incrementEdgeCount(edgeCountsBySourceId, sourceDocumentId, targetDocumentId);
      addAdjacentDocument(adjacencyByDocumentId, sourceDocumentId, targetDocumentId);
      addAdjacentDocument(adjacencyByDocumentId, targetDocumentId, sourceDocumentId);
    }
  }

  const depthByDocumentId = new Map([[activeDocumentId, 0]]);
  let frontier = [activeDocumentId];
  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
    const nextFrontier = new Set<string>();
    for (const documentId of frontier) {
      const adjacentIds = [...(adjacencyByDocumentId.get(documentId) ?? [])]
        .sort((firstId, secondId) => compareText(
          getDocumentSortKey(index, firstId),
          getDocumentSortKey(index, secondId),
        ));
      for (const adjacentId of adjacentIds) {
        if (!depthByDocumentId.has(adjacentId)) {
          depthByDocumentId.set(adjacentId, depth);
          nextFrontier.add(adjacentId);
        }
      }
    }
    frontier = [...nextFrontier];
  }

  const nearbyDocumentIds = [...depthByDocumentId]
    .sort(([firstId, firstDepth], [secondId, secondDepth]) =>
      firstDepth - secondDepth || compareText(
        getDocumentSortKey(index, firstId),
        getDocumentSortKey(index, secondId),
      ))
    .map(([documentId]) => documentId);
  const visibleDocumentIds = nearbyDocumentIds.slice(0, maxNodes);
  const visibleDocumentIdSet = new Set(visibleDocumentIds);
  const nodes = visibleDocumentIds.map((documentId) => ({
    documentId,
    path: index.documentsById.get(documentId)?.path ?? documentId,
    depth: depthByDocumentId.get(documentId) ?? 0,
  }));
  const edges: RightPanelGraphEdge[] = [];
  for (const [sourceDocumentId, targetCounts] of edgeCountsBySourceId) {
    if (!visibleDocumentIdSet.has(sourceDocumentId)) continue;
    for (const [targetDocumentId, linkCount] of targetCounts) {
      if (!visibleDocumentIdSet.has(targetDocumentId)) continue;
      edges.push({ sourceDocumentId, targetDocumentId, linkCount });
    }
  }
  edges.sort((first, second) =>
    compareText(getDocumentSortKey(index, first.sourceDocumentId), getDocumentSortKey(index, second.sourceDocumentId)) ||
    compareText(getDocumentSortKey(index, first.targetDocumentId), getDocumentSortKey(index, second.targetDocumentId)));

  return {
    nodes,
    edges,
    totalNodeCount: nearbyDocumentIds.length,
    isTruncated: nearbyDocumentIds.length > visibleDocumentIds.length,
    hasConnections: nodes.length > 1 && edges.length > 0,
  };
};

const getRingPositions = (
  nodes: readonly RightPanelGraphNode[],
  radius: number,
  angleOffset: number,
) => nodes.map((node, index) => {
  const angle = angleOffset + (Math.PI * 2 * index) / nodes.length;
  return {
    ...node,
    x: roundCoordinate(50 + Math.cos(angle) * radius),
    y: roundCoordinate(50 + Math.sin(angle) * radius),
  };
});

export const getRightPanelGraphLayout = (
  model: RightPanelGraphModel,
): readonly RightPanelGraphLayoutNode[] => {
  const activeNode = model.nodes.find((node) => node.depth === 0);
  const depthOneNodes = model.nodes.filter((node) => node.depth === 1);
  const depthTwoNodes = model.nodes.filter((node) => node.depth >= 2);
  const hasOuterRing = depthTwoNodes.length > 0;

  return [
    ...(activeNode ? [{ ...activeNode, x: 50, y: 50 }] : []),
    ...getRingPositions(depthOneNodes, hasOuterRing ? 25 : 39, -Math.PI / 2),
    ...getRingPositions(
      depthTwoNodes,
      42,
      depthTwoNodes.length === 1
        ? Math.PI / 2
        : -Math.PI / 2 + Math.PI / depthTwoNodes.length,
    ),
  ];
};
