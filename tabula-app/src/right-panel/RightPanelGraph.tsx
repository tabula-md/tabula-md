import type { KeyboardEvent } from "react";
import type { WorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import type { WorkspaceFileTabLabel } from "../workspace/workspaceDisplayTitles";
import type { WorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { PanelEmptyState } from "./PanelEmptyState";
import {
  getRightPanelGraphLayout,
  getRightPanelGraphModel,
  type RightPanelGraphLayoutNode,
} from "./rightPanelGraphModel";

type RightPanelGraphCopy = WorkspaceInterfaceCopy["sidePanel"]["graph"];

type RightPanelGraphProps = {
  activeFileId: string;
  activeFileTitle: string;
  copy: RightPanelGraphCopy;
  fileLabels: ReadonlyMap<string, WorkspaceFileTabLabel>;
  index?: WorkspaceKnowledgeIndex;
  onSelectFile: (fileId: string) => void;
};

const GRAPH_NODE_RADIUS = 5.5;

const removeMarkdownExtension = (value: string) => value.replace(/\.(?:md|markdown)$/i, "");

const compactNodeLabel = (value: string) => {
  const normalized = removeMarkdownExtension(value);
  return normalized.length > 16 ? `${normalized.slice(0, 15)}…` : normalized;
};

const getEdgeLine = (
  source: RightPanelGraphLayoutNode,
  target: RightPanelGraphLayoutNode,
) => {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  const offsetX = length > 0 ? (dx / length) * GRAPH_NODE_RADIUS : 0;
  const offsetY = length > 0 ? (dy / length) * GRAPH_NODE_RADIUS : 0;
  return {
    x1: source.x + offsetX,
    y1: source.y + offsetY,
    x2: target.x - offsetX,
    y2: target.y - offsetY,
  };
};

const getEdgePath = (
  source: RightPanelGraphLayoutNode,
  target: RightPanelGraphLayoutNode,
  activeDocumentId: string,
) => {
  const line = getEdgeLine(source, target);
  if (
    source.documentId === activeDocumentId ||
    target.documentId === activeDocumentId
  ) {
    return `M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`;
  }

  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const length = Math.hypot(dx, dy) || 1;
  const midpoint = { x: (line.x1 + line.x2) / 2, y: (line.y1 + line.y2) / 2 };
  const curveOffset = 12;
  const firstControl = {
    x: midpoint.x - (dy / length) * curveOffset,
    y: midpoint.y + (dx / length) * curveOffset,
  };
  const secondControl = {
    x: midpoint.x + (dy / length) * curveOffset,
    y: midpoint.y - (dx / length) * curveOffset,
  };
  const distanceFromCenter = (point: { x: number; y: number }) =>
    Math.hypot(point.x - 50, point.y - 50);
  const control = distanceFromCenter(firstControl) >= distanceFromCenter(secondControl)
    ? firstControl
    : secondControl;
  return `M ${line.x1} ${line.y1} Q ${control.x} ${control.y} ${line.x2} ${line.y2}`;
};

export function RightPanelGraph({
  activeFileId,
  activeFileTitle,
  copy,
  fileLabels,
  index,
  onSelectFile,
}: RightPanelGraphProps) {
  if (!index) {
    return (
      <section className="right-panel-content right-graph-panel">
        <PanelEmptyState>{copy.unavailable}</PanelEmptyState>
      </section>
    );
  }

  const model = getRightPanelGraphModel(index, activeFileId);
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

  const layout = getRightPanelGraphLayout(model);
  const layoutByDocumentId = new Map(layout.map((node) => [node.documentId, node]));
  const getDocumentLabel = (documentId: string) => {
    const fileLabel = fileLabels.get(documentId);
    if (!fileLabel) return index.documentsById.get(documentId)?.path ?? documentId;
    return fileLabel.locationLabel
      ? `${fileLabel.displayTitle} · ${fileLabel.locationLabel}`
      : fileLabel.displayTitle;
  };
  const activateDocument = (documentId: string) => {
    if (documentId !== activeFileId) onSelectFile(documentId);
  };
  const handleNodeKeyDown = (event: KeyboardEvent<SVGGElement>, documentId: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    activateDocument(documentId);
  };

  return (
    <section
      className="right-panel-content right-graph-panel"
      aria-label={copy.forFile(activeFileTitle)}
    >
      <header className="right-graph-header">
        <h2>{copy.title}</h2>
        <span>{copy.summary(model.nodes.length, model.edges.length)}</span>
      </header>
      <svg
        className="right-graph-canvas"
        viewBox="0 0 100 100"
        role="group"
        aria-label={copy.forFile(activeFileTitle)}
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
                d={getEdgePath(source, target, activeFileId)}
                className="right-graph-edge"
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
            const documentLabel = getDocumentLabel(node.documentId);
            return (
              <g
                key={node.documentId}
                className={`right-graph-node depth-${node.depth}${isActive ? " active" : ""}`}
                role={isActive ? "img" : "button"}
                tabIndex={isActive ? undefined : 0}
                aria-current={isActive ? "page" : undefined}
                aria-label={isActive ? copy.current(documentLabel) : copy.open(documentLabel)}
                onClick={() => activateDocument(node.documentId)}
                onKeyDown={(event) => handleNodeKeyDown(event, node.documentId)}
              >
                <title>{documentLabel}</title>
                <circle cx={node.x} cy={node.y} r={GRAPH_NODE_RADIUS} />
                <text x={node.x} y={node.y + 9} textAnchor="middle">
                  {compactNodeLabel(documentLabel)}
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
