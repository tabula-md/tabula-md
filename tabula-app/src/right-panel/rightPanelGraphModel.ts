import {
  getOkfFreshness,
  type OkfActorEvent,
  type OkfFreshness,
  type OkfLifecycleStatus,
  type OkfSource,
  type OkfTrustTier,
  type WorkspaceKnowledgeIndex,
} from "@tabula-md/tabula";

export type RightPanelGraphScope = "local" | "workspace" | "concept";
export type RightPanelGraphDocumentRole = "concept" | "index" | "log";
export type RightPanelGraphEdgeKind = "relationship" | "navigation";

export type RightPanelGraphFilters = {
  types: ReadonlySet<string>;
  tags: ReadonlySet<string>;
  statuses?: ReadonlySet<OkfLifecycleStatus>;
  trustTiers?: ReadonlySet<OkfTrustTier>;
  freshness?: ReadonlySet<OkfFreshness>;
};

export type RightPanelGraphOptions = {
  scope?: RightPanelGraphScope;
  filters?: RightPanelGraphFilters;
  today?: string;
};

export type RightPanelGraphNode = {
  documentId: string;
  path: string;
  depth: number;
  role: RightPanelGraphDocumentRole;
  isTypedConcept: boolean;
  title: string;
  description?: string;
  type?: string;
  tags: readonly string[];
  resource?: string;
  sources: readonly OkfSource[];
  generated?: OkfActorEvent;
  verified: readonly OkfActorEvent[];
  status: OkfLifecycleStatus;
  staleAfter?: string;
  freshness: OkfFreshness;
  trustTier: OkfTrustTier;
};

export type RightPanelGraphEdge = {
  sourceDocumentId: string;
  targetDocumentId: string;
  linkCount: number;
  kind: RightPanelGraphEdgeKind;
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

const getDocumentRole = (path: string): RightPanelGraphDocumentRole => {
  const fileName = path.split("/").at(-1)?.toLocaleLowerCase();
  if (fileName === "index.md") return "index";
  if (fileName === "log.md") return "log";
  return "concept";
};

const matchesConceptFilters = (
  node: RightPanelGraphNode,
  filters: RightPanelGraphFilters | undefined,
) => {
  if (!filters) return true;
  if (filters.types.size > 0 && (!node.type || !filters.types.has(node.type))) {
    return false;
  }
  if (
    filters.tags.size > 0 &&
    ![...filters.tags].every((tag) => node.tags.includes(tag))
  ) {
    return false;
  }
  if (
    filters.statuses?.size &&
    (!node.isTypedConcept || !filters.statuses.has(node.status))
  ) {
    return false;
  }
  if (
    filters.trustTiers?.size &&
    (!node.isTypedConcept || !filters.trustTiers.has(node.trustTier))
  ) {
    return false;
  }
  if (
    filters.freshness?.size &&
    (!node.isTypedConcept || !filters.freshness.has(node.freshness))
  ) {
    return false;
  }
  return true;
};

const incrementEdgeCount = (
  edgeCountsBySourceId: Map<string, Map<string, {
    count: number;
    kind: RightPanelGraphEdgeKind;
  }>>,
  sourceDocumentId: string,
  targetDocumentId: string,
  kind: RightPanelGraphEdgeKind,
) => {
  const targetCounts = edgeCountsBySourceId.get(sourceDocumentId) ?? new Map();
  const current = targetCounts.get(targetDocumentId);
  targetCounts.set(targetDocumentId, {
    count: (current?.count ?? 0) + 1,
    kind: current?.kind === "navigation" || kind === "navigation"
      ? "navigation"
      : "relationship",
  });
  edgeCountsBySourceId.set(sourceDocumentId, targetCounts);
};

export const getRightPanelGraphModel = (
  index: WorkspaceKnowledgeIndex,
  activeDocumentId: string,
  options: RightPanelGraphOptions = {},
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

  const scope = options.scope ?? "workspace";
  const allNodes = [...index.documentsById.values()]
    .map((document): RightPanelGraphNode => {
      const analysis = index.analysesByDocumentId.get(document.id);
      const metadata = analysis?.knowledgeMetadata;
      return {
        documentId: document.id,
        path: document.path,
        depth: 2,
        role: getDocumentRole(document.path),
        isTypedConcept: Boolean(metadata?.type),
        title: analysis?.title ?? document.path.split("/").at(-1) ?? document.path,
        ...(metadata?.description ? { description: metadata.description } : {}),
        ...(metadata?.type ? { type: metadata.type } : {}),
        tags: metadata?.tags ?? [],
        ...(metadata?.resource ? { resource: metadata.resource } : {}),
        sources: metadata?.sources ?? [],
        ...(metadata?.generated ? { generated: metadata.generated } : {}),
        verified: metadata?.verified ?? [],
        status: metadata?.status ?? "stable",
        ...(metadata?.staleAfter ? { staleAfter: metadata.staleAfter } : {}),
        freshness: metadata ? getOkfFreshness(metadata, options.today) : "current",
        trustTier: metadata?.trustTier ?? "unverified",
      };
    });
  const candidateNodes = allNodes.filter((node) =>
    (scope !== "concept" || node.role === "concept") &&
    matchesConceptFilters(node, options.filters));
  const candidateDocumentIds = new Set(candidateNodes.map((node) => node.documentId));
  const visibleActiveDocumentId = candidateDocumentIds.has(activeDocumentId)
    ? activeDocumentId
    : undefined;
  const rolesByDocumentId = new Map(
    allNodes.map((node) => [node.documentId, node.role]),
  );
  const adjacentDocumentIds = new Set<string>();
  const edgeCountsBySourceId = new Map<string, Map<string, {
    count: number;
    kind: RightPanelGraphEdgeKind;
  }>>();

  for (const [sourceDocumentId, links] of index.outgoingLinksByDocumentId) {
    for (const link of links) {
      const targetDocumentId = link.status === "resolved" ? link.targetDocumentId : undefined;
      if (
        !targetDocumentId ||
        targetDocumentId === sourceDocumentId ||
        !candidateDocumentIds.has(sourceDocumentId) ||
        !candidateDocumentIds.has(targetDocumentId)
      ) {
        continue;
      }

      if (sourceDocumentId === visibleActiveDocumentId) {
        adjacentDocumentIds.add(targetDocumentId);
      } else if (targetDocumentId === visibleActiveDocumentId) {
        adjacentDocumentIds.add(sourceDocumentId);
      }

      const kind =
        rolesByDocumentId.get(sourceDocumentId) === "concept" &&
        rolesByDocumentId.get(targetDocumentId) === "concept"
          ? "relationship"
          : "navigation";
      incrementEdgeCount(
        edgeCountsBySourceId,
        sourceDocumentId,
        targetDocumentId,
        kind,
      );
    }
  }

  const visibleNodes = scope === "local"
    ? candidateNodes.filter((node) =>
      node.documentId === visibleActiveDocumentId ||
      adjacentDocumentIds.has(node.documentId))
    : candidateNodes;
  const visibleDocumentIds = new Set(visibleNodes.map((node) => node.documentId));
  const nodes = visibleNodes
    .sort((first, second) =>
      compareText(
        getDocumentSortKey(index, first.documentId),
        getDocumentSortKey(index, second.documentId),
      ))
    .map((node) => ({
      ...node,
      depth: node.documentId === visibleActiveDocumentId
        ? 0
        : adjacentDocumentIds.has(node.documentId)
          ? 1
          : 2,
    }));
  const edges: RightPanelGraphEdge[] = [];
  for (const [sourceDocumentId, targetCounts] of edgeCountsBySourceId) {
    for (const [targetDocumentId, { count, kind }] of targetCounts) {
      if (
        !visibleDocumentIds.has(sourceDocumentId) ||
        !visibleDocumentIds.has(targetDocumentId)
      ) {
        continue;
      }
      edges.push({
        sourceDocumentId,
        targetDocumentId,
        linkCount: count,
        kind,
      });
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
