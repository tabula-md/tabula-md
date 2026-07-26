import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type {
  OkfFreshness,
  OkfLifecycleStatus,
  OkfTrustTier,
  WorkspaceKnowledgeIndex,
} from "@tabula-md/tabula";
import {
  Check,
  ExternalLink,
  ListFilter,
} from "lucide-react";
import type { WorkspaceFileTabLabel } from "../workspace/workspaceDisplayTitles";
import type { WorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import {
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "../ui/Menu";
import { PanelEmptyState } from "./PanelEmptyState";
import {
  getRightPanelGraphLayout,
  getRightPanelGraphModel,
  type RightPanelGraphDocumentRole,
  type RightPanelGraphFilters,
  type RightPanelGraphLayoutNode,
  type RightPanelGraphNode,
  type RightPanelGraphScope,
} from "./rightPanelGraphModel";
import { useRightPanelGraphSimulation } from "./useRightPanelGraphSimulation";

type RightPanelGraphCopy = WorkspaceInterfaceCopy["sidePanel"]["graph"];

type RightPanelGraphProps = {
  activeFileId: string;
  activeFileTitle: string;
  copy: RightPanelGraphCopy;
  fileLabels: ReadonlyMap<string, WorkspaceFileTabLabel>;
  filters?: RightPanelGraphFilters;
  index?: WorkspaceKnowledgeIndex;
  onSelectFile: (fileId: string) => void;
  scopeOverride?: RightPanelGraphScope;
};

const GRAPH_NODE_RADIUS = 2.8;
const GRAPH_RELATED_NODE_RADIUS = 3.4;
const GRAPH_ACTIVE_NODE_RADIUS = 4.8;
const GRAPH_LABEL_SECTOR_COUNT = 4;
const GRAPH_TYPE_COLOR_COUNT = 6;

const removeMarkdownExtension = (value: string) => value.replace(/\.(?:md|markdown)$/i, "");

const compactNodeLabel = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

const getTypeColorIndex = (type: string | undefined) => {
  if (!type) return undefined;
  let hash = 0;
  for (const character of type) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  return hash % GRAPH_TYPE_COLOR_COUNT;
};

const getOpenableResource = (resource: string | undefined) => {
  if (!resource) return undefined;
  try {
    const url = new URL(resource);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};

const getMetadataFacets = <TValue extends string>(
  nodes: readonly RightPanelGraphNode[],
  getValues: (node: RightPanelGraphNode) => readonly TValue[],
) => {
  const counts = new Map<TValue, number>();
  for (const node of nodes) {
    for (const value of getValues(node)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((first, second) => first.value.localeCompare(second.value));
};

const getNodeRadius = (node: RightPanelGraphLayoutNode) =>
  node.depth === 0
    ? GRAPH_ACTIVE_NODE_RADIUS
    : node.depth === 1
      ? GRAPH_RELATED_NODE_RADIUS
      : GRAPH_NODE_RADIUS;

const getLabelPlacement = (node: RightPanelGraphLayoutNode) => {
  const deltaX = node.x - 50;
  const deltaY = node.y - 50;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance < 4) {
    return {
      x: node.x,
      y: node.y + getNodeRadius(node) + 5,
      textAnchor: "middle" as const,
    };
  }
  const directionX = deltaX / distance;
  const directionY = deltaY / distance;
  const offset = getNodeRadius(node) + 4;
  return {
    x: node.x + directionX * offset,
    y: node.y + directionY * offset + 1.2,
    textAnchor: directionX > 0.28
      ? "start" as const
      : directionX < -0.28
        ? "end" as const
        : "middle" as const,
  };
};

const getEdgeLine = (
  source: RightPanelGraphLayoutNode,
  target: RightPanelGraphLayoutNode,
) => {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  const sourceRadius = getNodeRadius(source);
  const targetRadius = getNodeRadius(target);
  const sourceOffsetX = length > 0 ? (dx / length) * sourceRadius : 0;
  const sourceOffsetY = length > 0 ? (dy / length) * sourceRadius : 0;
  const targetOffsetX = length > 0 ? (dx / length) * targetRadius : 0;
  const targetOffsetY = length > 0 ? (dy / length) * targetRadius : 0;
  return {
    x1: source.x + sourceOffsetX,
    y1: source.y + sourceOffsetY,
    x2: target.x - targetOffsetX,
    y2: target.y - targetOffsetY,
  };
};

const getEdgePath = (
  source: RightPanelGraphLayoutNode,
  target: RightPanelGraphLayoutNode,
) => {
  const line = getEdgeLine(source, target);
  return `M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`;
};

type GraphPointerDrag = {
  documentId: string;
  hasMoved: boolean;
  pointerId: number;
  startClientX: number;
  startClientY: number;
};

const getGraphPointerPosition = (
  event: PointerEvent<SVGGElement>,
) => {
  const svg = event.currentTarget.ownerSVGElement;
  const screenMatrix = svg?.getScreenCTM();
  if (!svg || !screenMatrix) return;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const graphPoint = point.matrixTransform(screenMatrix.inverse());
  return { x: graphPoint.x, y: graphPoint.y };
};

export function RightPanelGraph({
  activeFileId,
  activeFileTitle,
  copy,
  fileLabels,
  filters: controlledFilters,
  index,
  onSelectFile,
  scopeOverride,
}: RightPanelGraphProps) {
  const [scope, setScope] = useState<RightPanelGraphScope>("local");
  const [selectedDocumentId, setSelectedDocumentId] = useState(activeFileId);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(() => new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<OkfLifecycleStatus>>(
    () => new Set(),
  );
  const [selectedTrustTiers, setSelectedTrustTiers] = useState<Set<OkfTrustTier>>(
    () => new Set(),
  );
  const [selectedFreshness, setSelectedFreshness] = useState<Set<OkfFreshness>>(
    () => new Set(),
  );
  const unfilteredConceptModel = useMemo(
    () => index
      ? getRightPanelGraphModel(index, activeFileId, { scope: "concept" })
      : undefined,
    [activeFileId, index],
  );
  const typeFacets = useMemo(
    () => getMetadataFacets(
      unfilteredConceptModel?.nodes ?? [],
      (node) => node.type ? [node.type] : [],
    ),
    [unfilteredConceptModel],
  );
  const tagFacets = useMemo(
    () => getMetadataFacets(
      unfilteredConceptModel?.nodes ?? [],
      (node) => node.tags,
    ),
    [unfilteredConceptModel],
  );
  const statusFacets = useMemo(
    () => getMetadataFacets(
      unfilteredConceptModel?.nodes ?? [],
      (node) => node.isTypedConcept ? [node.status] : [],
    ),
    [unfilteredConceptModel],
  );
  const trustFacets = useMemo(
    () => getMetadataFacets(
      unfilteredConceptModel?.nodes ?? [],
      (node) => node.isTypedConcept ? [node.trustTier] : [],
    ),
    [unfilteredConceptModel],
  );
  const freshnessFacets = useMemo(
    () => getMetadataFacets(
      unfilteredConceptModel?.nodes ?? [],
      (node) => node.isTypedConcept ? [node.freshness] : [],
    ),
    [unfilteredConceptModel],
  );
  useEffect(() => {
    const available = new Set(typeFacets.map((facet) => facet.value));
    setSelectedTypes((current) => {
      const next = new Set([...current].filter((value) => available.has(value)));
      return next.size === current.size ? current : next;
    });
  }, [typeFacets]);
  useEffect(() => {
    const available = new Set(tagFacets.map((facet) => facet.value));
    setSelectedTags((current) => {
      const next = new Set([...current].filter((value) => available.has(value)));
      return next.size === current.size ? current : next;
    });
  }, [tagFacets]);
  useEffect(() => {
    const available = new Set(statusFacets.map((facet) => facet.value));
    setSelectedStatuses((current) => {
      const next = new Set([...current].filter((value) => available.has(value)));
      return next.size === current.size ? current : next;
    });
  }, [statusFacets]);
  useEffect(() => {
    const available = new Set(trustFacets.map((facet) => facet.value));
    setSelectedTrustTiers((current) => {
      const next = new Set([...current].filter((value) => available.has(value)));
      return next.size === current.size ? current : next;
    });
  }, [trustFacets]);
  useEffect(() => {
    const available = new Set(freshnessFacets.map((facet) => facet.value));
    setSelectedFreshness((current) => {
      const next = new Set([...current].filter((value) => available.has(value)));
      return next.size === current.size ? current : next;
    });
  }, [freshnessFacets]);
  const internalFilters = useMemo(
    () => ({
      types: selectedTypes,
      tags: selectedTags,
      statuses: selectedStatuses,
      trustTiers: selectedTrustTiers,
      freshness: selectedFreshness,
    }),
    [
      selectedFreshness,
      selectedStatuses,
      selectedTags,
      selectedTrustTiers,
      selectedTypes,
    ],
  );
  const effectiveScope: RightPanelGraphScope = scopeOverride ?? scope;
  const effectiveFilters = controlledFilters ?? internalFilters;
  const model = useMemo(
    () => index
      ? getRightPanelGraphModel(index, activeFileId, {
        scope: effectiveScope,
        filters: effectiveFilters,
      })
      : undefined,
    [activeFileId, effectiveFilters, effectiveScope, index],
  );
  useEffect(() => {
    setSelectedDocumentId((currentDocumentId) =>
      model?.nodes.some((node) => node.documentId === currentDocumentId)
        ? currentDocumentId
        : model?.nodes[0]?.documentId ?? activeFileId);
  }, [activeFileId, model]);
  const fallbackLayout = useMemo(
    () => model ? getRightPanelGraphLayout(model) : [],
    [model],
  );
  const {
    draggingDocumentId,
    isReady: isSimulationReady,
    isSettled: isSimulationSettled,
    moveDragging,
    positionsByDocumentId,
    startDragging,
    stopDragging,
  } = useRightPanelGraphSimulation(model);
  const layout = useMemo(
    () => fallbackLayout.map((node) => {
      const simulatedPosition = positionsByDocumentId.get(node.documentId);
      return simulatedPosition
        ? { ...node, ...simulatedPosition }
        : node;
    }),
    [fallbackLayout, positionsByDocumentId],
  );
  const [hoveredDocumentId, setHoveredDocumentId] = useState<string>();
  const pointerDragRef = useRef<GraphPointerDrag | undefined>(undefined);
  const hasVisibleActiveNode = Boolean(
    model?.nodes.some((node) => node.documentId === activeFileId),
  );
  const visibleLabelDocumentIds = useMemo(() => {
    if (!model) return new Set<string>();
    const linkWeightByDocumentId = new Map<string, number>();
    for (const edge of model.edges) {
      const adjacentDocumentId = edge.sourceDocumentId === activeFileId
        ? edge.targetDocumentId
        : edge.targetDocumentId === activeFileId
          ? edge.sourceDocumentId
          : undefined;
      if (!adjacentDocumentId) continue;
      linkWeightByDocumentId.set(
        adjacentDocumentId,
        (linkWeightByDocumentId.get(adjacentDocumentId) ?? 0) + edge.linkCount,
      );
    }
    const layoutByDocumentId = new Map(
      layout.map((node) => [node.documentId, node]),
    );
    const candidatesBySector = new Map<number, RightPanelGraphLayoutNode[]>();
    for (const node of model.nodes) {
      if (hasVisibleActiveNode ? node.depth !== 1 : false) continue;
      const layoutNode = layoutByDocumentId.get(node.documentId);
      if (!layoutNode) continue;
      const angle = Math.atan2(layoutNode.y - 50, layoutNode.x - 50);
      const normalizedAngle = (angle + Math.PI * 2 + Math.PI / 4) % (Math.PI * 2);
      const sector = Math.floor(
        normalizedAngle / ((Math.PI * 2) / GRAPH_LABEL_SECTOR_COUNT),
      );
      const candidates = candidatesBySector.get(sector) ?? [];
      candidates.push(layoutNode);
      candidatesBySector.set(sector, candidates);
    }
    const selectedDocumentIds = [...candidatesBySector.values()].map((candidates) =>
      candidates.sort((first, second) =>
        (linkWeightByDocumentId.get(second.documentId) ?? 0) -
          (linkWeightByDocumentId.get(first.documentId) ?? 0) ||
        Math.hypot(second.x - 50, second.y - 50) -
          Math.hypot(first.x - 50, first.y - 50) ||
        first.path.localeCompare(second.path))[0].documentId);
    return new Set(selectedDocumentIds);
  }, [activeFileId, hasVisibleActiveNode, layout, model]);

  if (!index || !model) {
    return (
      <section className="right-panel-content right-graph-panel">
        <PanelEmptyState>{copy.unavailable}</PanelEmptyState>
      </section>
    );
  }

  const layoutByDocumentId = new Map(layout.map((node) => [node.documentId, node]));
  const hasFilters = selectedTypes.size > 0 ||
    selectedTags.size > 0 ||
    selectedStatuses.size > 0 ||
    selectedTrustTiers.size > 0 ||
    selectedFreshness.size > 0;
  const hasAvailableFilters = typeFacets.length > 0 ||
    tagFacets.length > 0 ||
    statusFacets.length > 0 ||
    trustFacets.length > 0 ||
    freshnessFacets.length > 0;
  const isEmpty = model.nodes.length === 0;
  const toggleFacet = <TValue extends string>(
    setSelected: (updater: (current: Set<TValue>) => Set<TValue>) => void,
    value: TValue,
  ) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };
  const clearFilters = () => {
    setSelectedTypes(new Set());
    setSelectedTags(new Set());
    setSelectedStatuses(new Set());
    setSelectedTrustTiers(new Set());
    setSelectedFreshness(new Set());
  };
  const getDocumentLabel = (documentId: string) => {
    const fileLabel = fileLabels.get(documentId);
    if (fileLabel) {
      return {
        title: removeMarkdownExtension(fileLabel.displayTitle),
        location: fileLabel.locationLabel,
        accessibleLabel: fileLabel.locationLabel
          ? `${fileLabel.displayTitle} · ${fileLabel.locationLabel}`
          : fileLabel.displayTitle,
        fullPath: fileLabel.fullPath,
      };
    }
    const documentPath = index.documentsById.get(documentId)?.path ?? documentId;
    const pathParts = documentPath.split("/");
    return {
      title: removeMarkdownExtension(pathParts.at(-1) ?? documentPath),
      accessibleLabel: documentPath,
      fullPath: documentPath,
    };
  };
  const activateDocument = (documentId: string) => {
    if (documentId !== activeFileId) onSelectFile(documentId);
  };
  const inspectionMode = Boolean(scopeOverride);
  const handleNodeKeyDown = (event: KeyboardEvent<SVGGElement>, documentId: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (inspectionMode) setSelectedDocumentId(documentId);
    else activateDocument(documentId);
  };
  const handleNodePointerDown = (
    event: PointerEvent<SVGGElement>,
    documentId: string,
  ) => {
    if (event.button !== 0) return;
    const position = getGraphPointerPosition(event);
    if (!position) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDragRef.current = {
      documentId,
      hasMoved: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    startDragging(documentId, position);
  };
  const handleNodePointerMove = (
    event: PointerEvent<SVGGElement>,
    documentId: string,
  ) => {
    const pointerDrag = pointerDragRef.current;
    if (
      !pointerDrag ||
      pointerDrag.documentId !== documentId ||
      pointerDrag.pointerId !== event.pointerId
    ) {
      return;
    }
    if (
      Math.hypot(
        event.clientX - pointerDrag.startClientX,
        event.clientY - pointerDrag.startClientY,
      ) >= 3
    ) {
      pointerDrag.hasMoved = true;
    }
    const position = getGraphPointerPosition(event);
    if (position) moveDragging(documentId, position);
  };
  const handleNodePointerEnd = (
    event: PointerEvent<SVGGElement>,
    documentId: string,
  ) => {
    const pointerDrag = pointerDragRef.current;
    if (
      !pointerDrag ||
      pointerDrag.documentId !== documentId ||
      pointerDrag.pointerId !== event.pointerId
    ) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerDragRef.current = undefined;
    stopDragging(documentId);
    if (event.type === "pointerup" && !pointerDrag.hasMoved) {
      if (inspectionMode) setSelectedDocumentId(documentId);
      else activateDocument(documentId);
    }
  };
  const selectedGraphNode = model.nodes.find(
    (node) => node.documentId === selectedDocumentId,
  );
  const selectedGraphResource = getOpenableResource(selectedGraphNode?.resource);
  const getRoleLabel = (role: RightPanelGraphDocumentRole) => copy.roles[role];

  return (
    <section
      className="right-panel-content right-graph-panel"
      aria-label={copy.forFile(activeFileTitle)}
    >
      <div className="right-graph-toolbar">
        {!scopeOverride && (
          <div className="right-graph-scope" role="group" aria-label={copy.scope}>
          <button
            type="button"
            aria-pressed={scope === "local"}
            onClick={() => setScope("local")}
          >
            {copy.local}
          </button>
          <button
            type="button"
            aria-pressed={scope === "workspace"}
            onClick={() => setScope("workspace")}
          >
            {copy.workspace}
          </button>
          <button
            type="button"
            aria-pressed={scope === "concept"}
            onClick={() => setScope("concept")}
          >
            {copy.concepts}
          </button>
          </div>
        )}
        <div className="right-graph-toolbar-meta">
          <span>
            {effectiveScope === "concept"
              ? copy.conceptSummary(model.totalNodeCount, model.totalLinkCount)
              : copy.summary(model.totalNodeCount, model.totalLinkCount)}
          </span>
          {!controlledFilters &&
            effectiveScope === "concept" && hasAvailableFilters && (
            <MenuRoot>
              <MenuTrigger asChild>
                <button
                  className="right-graph-filter-trigger"
                  type="button"
                  aria-label={copy.filters}
                  data-tooltip={copy.filters}
                >
                  <ListFilter size={15} aria-hidden="true" />
                  {hasFilters && (
                    <span className="right-panel-control-status-dot" aria-hidden="true" />
                  )}
                </button>
              </MenuTrigger>
              <MenuContent className="right-graph-filter-menu" ariaLabel={copy.filters}>
                {typeFacets.length > 0 && (
                  <MenuSub>
                    <MenuSubTrigger
                      label={copy.types}
                      trailing={<span>{selectedTypes.size || typeFacets.length}</span>}
                    />
                    <MenuSubContent
                      ariaLabel={copy.types}
                      className="right-graph-filter-menu"
                    >
                      {typeFacets.map((facet) => (
                        <MenuCheckboxItem
                          key={facet.value}
                          checked={selectedTypes.has(facet.value)}
                          icon={selectedTypes.has(facet.value) ? <Check size={14} /> : undefined}
                          label={facet.value}
                          trailing={<span>{facet.count}</span>}
                          onCheckedChange={() => toggleFacet(setSelectedTypes, facet.value)}
                          onSelect={(event) => event.preventDefault()}
                        />
                      ))}
                    </MenuSubContent>
                  </MenuSub>
                )}
                {tagFacets.length > 0 && (
                  <MenuSub>
                    <MenuSubTrigger
                      label={copy.tags}
                      trailing={<span>{selectedTags.size || tagFacets.length}</span>}
                    />
                    <MenuSubContent
                      ariaLabel={copy.tags}
                      className="right-graph-filter-menu"
                    >
                      {tagFacets.map((facet) => (
                        <MenuCheckboxItem
                          key={facet.value}
                          checked={selectedTags.has(facet.value)}
                          icon={selectedTags.has(facet.value) ? <Check size={14} /> : undefined}
                          label={facet.value}
                          trailing={<span>{facet.count}</span>}
                          onCheckedChange={() => toggleFacet(setSelectedTags, facet.value)}
                          onSelect={(event) => event.preventDefault()}
                        />
                      ))}
                    </MenuSubContent>
                  </MenuSub>
                )}
                {statusFacets.length > 0 && (
                  <MenuSub>
                    <MenuSubTrigger
                      label="Status"
                      trailing={<span>{selectedStatuses.size || statusFacets.length}</span>}
                    />
                    <MenuSubContent
                      ariaLabel="Status"
                      className="right-graph-filter-menu"
                    >
                      {statusFacets.map((facet) => (
                        <MenuCheckboxItem
                          key={facet.value}
                          checked={selectedStatuses.has(facet.value)}
                          icon={selectedStatuses.has(facet.value) ? <Check size={14} /> : undefined}
                          label={facet.value}
                          trailing={<span>{facet.count}</span>}
                          onCheckedChange={() =>
                            toggleFacet(setSelectedStatuses, facet.value)}
                          onSelect={(event) => event.preventDefault()}
                        />
                      ))}
                    </MenuSubContent>
                  </MenuSub>
                )}
                {trustFacets.length > 0 && (
                  <MenuSub>
                    <MenuSubTrigger
                      label="Trust"
                      trailing={<span>{selectedTrustTiers.size || trustFacets.length}</span>}
                    />
                    <MenuSubContent
                      ariaLabel="Trust"
                      className="right-graph-filter-menu"
                    >
                      {trustFacets.map((facet) => (
                        <MenuCheckboxItem
                          key={facet.value}
                          checked={selectedTrustTiers.has(facet.value)}
                          icon={selectedTrustTiers.has(facet.value) ? <Check size={14} /> : undefined}
                          label={facet.value}
                          trailing={<span>{facet.count}</span>}
                          onCheckedChange={() =>
                            toggleFacet(setSelectedTrustTiers, facet.value)}
                          onSelect={(event) => event.preventDefault()}
                        />
                      ))}
                    </MenuSubContent>
                  </MenuSub>
                )}
                {freshnessFacets.length > 0 && (
                  <MenuSub>
                    <MenuSubTrigger
                      label="Freshness"
                      trailing={<span>{selectedFreshness.size || freshnessFacets.length}</span>}
                    />
                    <MenuSubContent
                      ariaLabel="Freshness"
                      className="right-graph-filter-menu"
                    >
                      {freshnessFacets.map((facet) => (
                        <MenuCheckboxItem
                          key={facet.value}
                          checked={selectedFreshness.has(facet.value)}
                          icon={selectedFreshness.has(facet.value) ? <Check size={14} /> : undefined}
                          label={facet.value}
                          trailing={<span>{facet.count}</span>}
                          onCheckedChange={() =>
                            toggleFacet(setSelectedFreshness, facet.value)}
                          onSelect={(event) => event.preventDefault()}
                        />
                      ))}
                    </MenuSubContent>
                  </MenuSub>
                )}
                <MenuItem
                  disabled={!hasFilters}
                  label={copy.clearFilters}
                  onSelect={clearFilters}
                />
              </MenuContent>
            </MenuRoot>
          )}
        </div>
      </div>
      {isEmpty ? (
        <PanelEmptyState>
          {effectiveScope === "concept" ? copy.noConcepts : copy.none}
        </PanelEmptyState>
      ) : (
      <svg
        className="right-graph-canvas"
        viewBox="0 0 100 100"
        role="group"
        aria-label={copy.forFile(activeFileTitle)}
        data-graph-simulation-ready={isSimulationReady ? "true" : "false"}
        data-graph-simulation-state={
          !isSimulationReady
            ? "loading"
            : isSimulationSettled
              ? "settled"
              : "running"
        }
      >
        <defs>
          <marker
            id="right-graph-arrow"
            markerWidth="4"
            markerHeight="4"
            refX="3.5"
            refY="2"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path className="right-graph-arrow" d="M0,0 L4,2 L0,4 Z" />
          </marker>
        </defs>
        <g className="right-graph-edges" aria-hidden="true">
          {model.edges.map((edge) => {
            const source = layoutByDocumentId.get(edge.sourceDocumentId);
            const target = layoutByDocumentId.get(edge.targetDocumentId);
            if (!source || !target) return null;
            return (
              <path
                key={`${edge.sourceDocumentId}:${edge.targetDocumentId}`}
                d={getEdgePath(source, target)}
                className={`right-graph-edge ${edge.kind}${
                  edge.sourceDocumentId === activeFileId ||
                  edge.targetDocumentId === activeFileId
                    ? " connected"
                    : ""
                }`}
                data-edge-kind={edge.kind}
                markerEnd="url(#right-graph-arrow)"
                style={{ strokeWidth: 0.65 + Math.min(0.85, Math.log2(edge.linkCount) * 0.3) }}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>
        <g className="right-graph-nodes">
          {layout.map((node) => {
            const isActive = node.documentId === activeFileId;
            const isSelected = node.documentId === selectedDocumentId;
            const isLabelVisible =
              isActive || visibleLabelDocumentIds.has(node.documentId);
            const documentLabel = getDocumentLabel(node.documentId);
            const labelPlacement = getLabelPlacement(node);
            const typeColorIndex = getTypeColorIndex(node.type);
            return (
              <g
                key={node.documentId}
                className={`right-graph-node depth-${node.depth}${
                  isActive ? " active" : ""
                }${isSelected ? " selected" : ""
                } role-${node.role}${
                  typeColorIndex === undefined ? "" : ` type-${typeColorIndex}`
                }${isLabelVisible ? " label-visible" : ""}${
                  hoveredDocumentId === node.documentId ? " hovered" : ""
                }${draggingDocumentId === node.documentId ? " dragging" : ""}`}
                role={inspectionMode || !isActive ? "button" : "img"}
                tabIndex={inspectionMode || !isActive ? 0 : undefined}
                data-document-id={node.documentId}
                aria-current={isActive ? "page" : undefined}
                aria-label={
                  isActive
                    ? copy.current(documentLabel.accessibleLabel)
                    : copy.open(documentLabel.accessibleLabel)
                }
                onKeyDown={(event) => handleNodeKeyDown(event, node.documentId)}
                onPointerDown={(event) =>
                  handleNodePointerDown(event, node.documentId)}
                onPointerMove={(event) =>
                  handleNodePointerMove(event, node.documentId)}
                onPointerUp={(event) =>
                  handleNodePointerEnd(event, node.documentId)}
                onPointerCancel={(event) =>
                  handleNodePointerEnd(event, node.documentId)}
              >
                <title>
                  {[
                    documentLabel.fullPath,
                    node.type ?? getRoleLabel(node.role),
                    node.description,
                  ].filter(Boolean).join("\n")}
                </title>
                <circle
                  className="right-graph-node-hit-target"
                  cx={node.x}
                  cy={node.y}
                  r={6}
                />
                <circle
                  className="right-graph-node-marker"
                  cx={node.x}
                  cy={node.y}
                  r={getNodeRadius(node)}
                  onPointerEnter={() => setHoveredDocumentId(node.documentId)}
                  onPointerLeave={() =>
                    setHoveredDocumentId((currentDocumentId) =>
                      currentDocumentId === node.documentId
                        ? undefined
                        : currentDocumentId)}
                />
                <text
                  x={labelPlacement.x}
                  y={labelPlacement.y}
                  textAnchor={labelPlacement.textAnchor}
                >
                  <tspan className="right-graph-node-title">
                    {compactNodeLabel(documentLabel.title, 18)}
                  </tspan>
                  {documentLabel.location && (
                    <tspan className="right-graph-node-location" dx="1.4">
                      {compactNodeLabel(documentLabel.location, 12)}
                    </tspan>
                  )}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      )}
      {selectedGraphNode && !isEmpty && (
        <aside className="right-graph-detail" aria-label={selectedGraphNode.title}>
          <div className="right-graph-detail-title">
            <span>{selectedGraphNode.title}</span>
            <span>{selectedGraphNode.type ?? getRoleLabel(selectedGraphNode.role)}</span>
          </div>
          {selectedGraphNode.description && (
            <p>{selectedGraphNode.description}</p>
          )}
          {selectedGraphNode.role === "concept" && selectedGraphNode.isTypedConcept && (
            <dl className="right-graph-detail-metadata">
              <div>
                <dt>Status</dt>
                <dd>{selectedGraphNode.status}</dd>
              </div>
              <div>
                <dt>Trust</dt>
                <dd>{selectedGraphNode.trustTier}</dd>
              </div>
              <div>
                <dt>Freshness</dt>
                <dd>
                  {selectedGraphNode.freshness}
                  {selectedGraphNode.staleAfter && ` · ${selectedGraphNode.staleAfter}`}
                </dd>
              </div>
              {selectedGraphNode.sources.length > 0 && (
                <div>
                  <dt>Sources</dt>
                  <dd>{selectedGraphNode.sources.length}</dd>
                </div>
              )}
              {selectedGraphNode.generated && (
                <div>
                  <dt>Generated</dt>
                  <dd>{selectedGraphNode.generated.by} · {selectedGraphNode.generated.at}</dd>
                </div>
              )}
              {selectedGraphNode.verified.length > 0 && (
                <div>
                  <dt>Verified</dt>
                  <dd>
                    {selectedGraphNode.verified.at(-1)?.by} ·{" "}
                    {selectedGraphNode.verified.at(-1)?.at}
                  </dd>
                </div>
              )}
            </dl>
          )}
          {selectedGraphNode.tags.length > 0 && (
            <div className="right-graph-detail-tags">
              {selectedGraphNode.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          )}
          {selectedGraphNode.resource && (
            selectedGraphResource ? (
              <a
                className="right-graph-detail-resource"
                href={selectedGraphResource}
                target="_blank"
                rel="noreferrer"
                aria-label={copy.openResource}
              >
                <span>{selectedGraphNode.resource}</span>
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            ) : (
              <span className="right-graph-detail-resource">
                {selectedGraphNode.resource}
              </span>
            )
          )}
          <button
            className="right-graph-detail-open"
            type="button"
            onClick={() => activateDocument(selectedGraphNode.documentId)}
          >
            {copy.open(getDocumentLabel(selectedGraphNode.documentId).accessibleLabel)}
          </button>
        </aside>
      )}
      {model.isTruncated && (
        <p className="right-graph-truncated">
          {copy.truncated(model.nodes.length, model.totalNodeCount)}
        </p>
      )}
    </section>
  );
}
