import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { WorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import type { WorkspaceFileTabLabel } from "../workspace/workspaceDisplayTitles";
import type { WorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { PanelEmptyState } from "./PanelEmptyState";
import {
  getRightPanelGraphLayout,
  getRightPanelGraphModel,
  type RightPanelGraphLayoutNode,
} from "./rightPanelGraphModel";
import { useRightPanelGraphSimulation } from "./useRightPanelGraphSimulation";

type RightPanelGraphCopy = WorkspaceInterfaceCopy["sidePanel"]["graph"];

type RightPanelGraphProps = {
  activeFileId: string;
  activeFileTitle: string;
  copy: RightPanelGraphCopy;
  fileLabels: ReadonlyMap<string, WorkspaceFileTabLabel>;
  index?: WorkspaceKnowledgeIndex;
  onSelectFile: (fileId: string) => void;
};

const GRAPH_NODE_RADIUS = 2.8;
const GRAPH_RELATED_NODE_RADIUS = 3.4;
const GRAPH_ACTIVE_NODE_RADIUS = 4.8;
const GRAPH_LABEL_SECTOR_COUNT = 4;

const removeMarkdownExtension = (value: string) => value.replace(/\.(?:md|markdown)$/i, "");

const compactNodeLabel = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

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
  index,
  onSelectFile,
}: RightPanelGraphProps) {
  const model = useMemo(
    () => index ? getRightPanelGraphModel(index, activeFileId) : undefined,
    [activeFileId, index],
  );
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
      if (node.depth !== 1) continue;
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
  }, [activeFileId, layout, model]);

  if (!index || !model) {
    return (
      <section className="right-panel-content right-graph-panel">
        <PanelEmptyState>{copy.unavailable}</PanelEmptyState>
      </section>
    );
  }

  if (!model.hasConnections) {
    return (
      <section
        className="right-panel-content right-graph-panel"
        aria-label={copy.forFile(activeFileTitle)}
      >
        <PanelEmptyState>{copy.none}</PanelEmptyState>
      </section>
    );
  }

  const layoutByDocumentId = new Map(layout.map((node) => [node.documentId, node]));
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
  const handleNodeKeyDown = (event: KeyboardEvent<SVGGElement>, documentId: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    activateDocument(documentId);
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
      activateDocument(documentId);
    }
  };

  return (
    <section
      className="right-panel-content right-graph-panel"
      aria-label={copy.forFile(activeFileTitle)}
    >
      <div className="right-graph-meta">
        {copy.summary(model.totalNodeCount, model.totalLinkCount)}
      </div>
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
                className={`right-graph-edge${
                  edge.sourceDocumentId === activeFileId ||
                  edge.targetDocumentId === activeFileId
                    ? " connected"
                    : ""
                }`}
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
            const isLabelVisible = visibleLabelDocumentIds.has(node.documentId);
            const documentLabel = getDocumentLabel(node.documentId);
            const labelPlacement = getLabelPlacement(node);
            return (
              <g
                key={node.documentId}
                className={`right-graph-node depth-${node.depth}${
                  isActive ? " active" : ""
                }${isLabelVisible ? " label-visible" : ""}${
                  hoveredDocumentId === node.documentId ? " hovered" : ""
                }${draggingDocumentId === node.documentId ? " dragging" : ""}`}
                role={isActive ? "img" : "button"}
                tabIndex={isActive ? undefined : 0}
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
                <title>{documentLabel.fullPath}</title>
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
      {model.isTruncated && (
        <p className="right-graph-truncated">
          {copy.truncated(model.nodes.length, model.totalNodeCount)}
        </p>
      )}
    </section>
  );
}
