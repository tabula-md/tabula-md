import type { WorkspaceKnowledgeIndex } from "@tabula-md/tabula";

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
  totalLinkCount: number;
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
const GRAPH_LAYOUT_MIN = 9;
const GRAPH_LAYOUT_MAX = 91;

const getDocumentSortKey = (index: WorkspaceKnowledgeIndex, documentId: string) =>
  index.documentsById.get(documentId)?.path ?? documentId;

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
): RightPanelGraphModel => {
  const activeDocument = index.documentsById.get(activeDocumentId);
  if (!activeDocument) {
    return {
      nodes: [],
      edges: [],
      totalNodeCount: 0,
      totalLinkCount: 0,
      isTruncated: false,
      hasConnections: false,
    };
  }

  const adjacentDocumentIds = new Set<string>();
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

      if (sourceDocumentId === activeDocumentId) {
        adjacentDocumentIds.add(targetDocumentId);
      } else if (targetDocumentId === activeDocumentId) {
        adjacentDocumentIds.add(sourceDocumentId);
      }

      incrementEdgeCount(edgeCountsBySourceId, sourceDocumentId, targetDocumentId);
    }
  }

  const nodes = [...index.documentsById.keys()]
    .sort((firstId, secondId) =>
      compareText(
        getDocumentSortKey(index, firstId),
        getDocumentSortKey(index, secondId),
      ))
    .map((documentId) => ({
      documentId,
      path: index.documentsById.get(documentId)?.path ?? documentId,
      depth: documentId === activeDocumentId
        ? 0
        : adjacentDocumentIds.has(documentId)
          ? 1
          : 2,
    }));
  const edges: RightPanelGraphEdge[] = [];
  for (const [sourceDocumentId, targetCounts] of edgeCountsBySourceId) {
    for (const [targetDocumentId, linkCount] of targetCounts) {
      edges.push({ sourceDocumentId, targetDocumentId, linkCount });
    }
  }
  edges.sort((first, second) =>
    compareText(getDocumentSortKey(index, first.sourceDocumentId), getDocumentSortKey(index, second.sourceDocumentId)) ||
    compareText(getDocumentSortKey(index, first.targetDocumentId), getDocumentSortKey(index, second.targetDocumentId)));
  const totalLinkCount = edges.reduce((total, edge) => total + edge.linkCount, 0);

  return {
    nodes,
    edges,
    totalNodeCount: nodes.length,
    totalLinkCount,
    isTruncated: false,
    hasConnections: nodes.length > 1 || edges.length > 0,
  };
};

type GraphSimulationNode = {
  id: string;
  graphNode: RightPanelGraphNode;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
};

type GraphSimulationLink = {
  sourceIndex: number;
  targetIndex: number;
  linkCount: number;
};

const fitLayoutToViewBox = (
  nodes: readonly GraphSimulationNode[],
): readonly RightPanelGraphLayoutNode[] => {
  if (nodes.length === 1) {
    return [{ ...nodes[0].graphNode, x: 50, y: 50 }];
  }

  const xCoordinates = nodes.map((node) => node.x ?? 0);
  const yCoordinates = nodes.map((node) => node.y ?? 0);
  const minX = Math.min(...xCoordinates);
  const maxX = Math.max(...xCoordinates);
  const minY = Math.min(...yCoordinates);
  const maxY = Math.max(...yCoordinates);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const availableSize = GRAPH_LAYOUT_MAX - GRAPH_LAYOUT_MIN;
  const scale = Math.min(availableSize / width, availableSize / height);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return nodes.map((node) => ({
    ...node.graphNode,
    x: roundCoordinate(50 + ((node.x ?? 0) - centerX) * scale),
    y: roundCoordinate(50 + ((node.y ?? 0) - centerY) * scale),
  }));
};

export const getRightPanelGraphLayout = (
  model: RightPanelGraphModel,
): readonly RightPanelGraphLayoutNode[] => {
  if (model.nodes.length === 0) return [];

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const simulationNodes: GraphSimulationNode[] = model.nodes.map((graphNode, index) => {
    const radius = 28 * Math.sqrt((index + 1) / model.nodes.length);
    const angle = index * goldenAngle;
    return {
      id: graphNode.documentId,
      graphNode,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      velocityX: 0,
      velocityY: 0,
    };
  });
  const nodeIndexById = new Map(
    simulationNodes.map((node, index) => [node.id, index]),
  );
  const simulationLinks: GraphSimulationLink[] = model.edges.flatMap((edge) => {
    const sourceIndex = nodeIndexById.get(edge.sourceDocumentId);
    const targetIndex = nodeIndexById.get(edge.targetDocumentId);
    return sourceIndex === undefined || targetIndex === undefined
      ? []
      : [{ sourceIndex, targetIndex, linkCount: edge.linkCount }];
  });
  const idealDistance = Math.max(10, Math.min(20, 70 / Math.sqrt(model.nodes.length)));
  const iterationCount = model.nodes.length > 400
    ? 45
    : model.nodes.length > 150
      ? 80
      : 160;

  for (let iteration = 0; iteration < iterationCount; iteration += 1) {
    const forceX = Array.from({ length: simulationNodes.length }, () => 0);
    const forceY = Array.from({ length: simulationNodes.length }, () => 0);

    for (let firstIndex = 0; firstIndex < simulationNodes.length; firstIndex += 1) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < simulationNodes.length;
        secondIndex += 1
      ) {
        const first = simulationNodes[firstIndex];
        const second = simulationNodes[secondIndex];
        let deltaX = second.x - first.x;
        let deltaY = second.y - first.y;
        if (deltaX === 0 && deltaY === 0) {
          deltaX = ((firstIndex + 1) * 0.17) % 1;
          deltaY = ((secondIndex + 1) * 0.23) % 1;
        }
        const distanceSquared = Math.max(1, deltaX * deltaX + deltaY * deltaY);
        const distance = Math.sqrt(distanceSquared);
        const repulsion = (idealDistance * idealDistance * 0.12) / distanceSquared;
        const repulsionX = (deltaX / distance) * repulsion;
        const repulsionY = (deltaY / distance) * repulsion;
        forceX[firstIndex] -= repulsionX;
        forceY[firstIndex] -= repulsionY;
        forceX[secondIndex] += repulsionX;
        forceY[secondIndex] += repulsionY;
      }
    }

    for (const link of simulationLinks) {
      const source = simulationNodes[link.sourceIndex];
      const target = simulationNodes[link.targetIndex];
      const deltaX = target.x - source.x;
      const deltaY = target.y - source.y;
      const distance = Math.max(1, Math.hypot(deltaX, deltaY));
      const linkStrength = Math.min(0.035, 0.018 + Math.log2(link.linkCount) * 0.004);
      const attraction = (distance - idealDistance) * linkStrength;
      const attractionX = (deltaX / distance) * attraction;
      const attractionY = (deltaY / distance) * attraction;
      forceX[link.sourceIndex] += attractionX;
      forceY[link.sourceIndex] += attractionY;
      forceX[link.targetIndex] -= attractionX;
      forceY[link.targetIndex] -= attractionY;
    }

    const temperature = 0.2 + 0.8 * (1 - iteration / iterationCount);
    for (let nodeIndex = 0; nodeIndex < simulationNodes.length; nodeIndex += 1) {
      const node = simulationNodes[nodeIndex];
      forceX[nodeIndex] -= node.x * 0.004;
      forceY[nodeIndex] -= node.y * 0.004;
      node.velocityX = (node.velocityX + forceX[nodeIndex]) * 0.76;
      node.velocityY = (node.velocityY + forceY[nodeIndex]) * 0.76;
      node.x += Math.max(-2, Math.min(2, node.velocityX)) * temperature;
      node.y += Math.max(-2, Math.min(2, node.velocityY)) * temperature;
    }
  }

  return fitLayoutToViewBox(simulationNodes);
};
