import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Simulation,
  SimulationLinkDatum,
  SimulationNodeDatum,
} from "d3-force";
import {
  getRightPanelGraphLayout,
  type RightPanelGraphModel,
} from "./rightPanelGraphModel";

type GraphPosition = {
  x: number;
  y: number;
};

type GraphSimulationNode = SimulationNodeDatum & {
  id: string;
};

type GraphSimulationLink = SimulationLinkDatum<GraphSimulationNode> & {
  linkCount: number;
};

const GRAPH_BOUNDARY_MIN = 7;
const GRAPH_BOUNDARY_MAX = 93;

const clampCoordinate = (value: number | undefined) =>
  Math.max(
    GRAPH_BOUNDARY_MIN,
    Math.min(GRAPH_BOUNDARY_MAX, value ?? 50),
  );

const getTopologyKey = (model: RightPanelGraphModel | undefined) => {
  if (!model) return "";
  return [
    model.nodes.map((node) => node.documentId).join("\u0000"),
    model.edges.map((edge) =>
      `${edge.sourceDocumentId}\u0000${edge.targetDocumentId}\u0000${edge.linkCount}`)
      .join("\u0001"),
  ].join("\u0002");
};

const getInitialPositions = (model: RightPanelGraphModel) =>
  new Map(
    getRightPanelGraphLayout(model).map((node) => [
      node.documentId,
      { x: node.x, y: node.y },
    ]),
  );

export const useRightPanelGraphSimulation = (
  model: RightPanelGraphModel | undefined,
) => {
  const topologyKey = useMemo(() => getTopologyKey(model), [model]);
  const modelRef = useRef(model);
  modelRef.current = model;
  const simulationRef = useRef<
    Simulation<GraphSimulationNode, GraphSimulationLink> | undefined
  >(undefined);
  const nodesByIdRef = useRef(new Map<string, GraphSimulationNode>());
  const frameRef = useRef<number | undefined>(undefined);
  const [positionsByDocumentId, setPositionsByDocumentId] = useState<
    ReadonlyMap<string, GraphPosition>
  >(() => model ? getInitialPositions(model) : new Map());
  const [isReady, setIsReady] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const [draggingDocumentId, setDraggingDocumentId] = useState<string>();

  useEffect(() => {
    const currentModel = modelRef.current;
    if (!currentModel || currentModel.nodes.length === 0) {
      setPositionsByDocumentId(new Map());
      setIsReady(false);
      setIsSettled(false);
      return;
    }

    let cancelled = false;
    const initialPositions = getInitialPositions(currentModel);
    setPositionsByDocumentId(initialPositions);
    setIsReady(false);
    setIsSettled(false);

    const publishPositions = () => {
      frameRef.current = undefined;
      const nextPositions = new Map<string, GraphPosition>();
      for (const node of nodesByIdRef.current.values()) {
        node.x = clampCoordinate(node.x);
        node.y = clampCoordinate(node.y);
        nextPositions.set(node.id, { x: node.x, y: node.y });
      }
      setPositionsByDocumentId(nextPositions);
    };

    void import("d3-force").then(({
      forceCenter,
      forceCollide,
      forceLink,
      forceManyBody,
      forceSimulation,
    }) => {
      if (cancelled) return;

      const simulationNodes: GraphSimulationNode[] = currentModel.nodes.map((node) => {
        const initialPosition = initialPositions.get(node.documentId);
        return {
          id: node.documentId,
          x: initialPosition?.x ?? 50,
          y: initialPosition?.y ?? 50,
        };
      });
      const simulationLinks: GraphSimulationLink[] = currentModel.edges.map((edge) => ({
        source: edge.sourceDocumentId,
        target: edge.targetDocumentId,
        linkCount: edge.linkCount,
      }));
      nodesByIdRef.current = new Map(
        simulationNodes.map((node) => [node.id, node]),
      );

      const idealDistance = Math.max(
        11,
        Math.min(20, 72 / Math.sqrt(simulationNodes.length)),
      );
      const simulation = forceSimulation<GraphSimulationNode>(simulationNodes)
        .force(
          "link",
          forceLink<GraphSimulationNode, GraphSimulationLink>(simulationLinks)
            .id((node) => node.id)
            .distance((link) =>
              Math.max(8, idealDistance - Math.log2(link.linkCount) * 1.6))
            .strength((link) =>
              Math.min(0.72, 0.34 + Math.log2(link.linkCount) * 0.08)),
        )
        .force("charge", forceManyBody().strength(-30))
        .force("center", forceCenter(50, 50).strength(0.08))
        .force("collision", forceCollide(5.2).strength(0.9).iterations(2))
        .alpha(0.9)
        .alphaDecay(0.035)
        .velocityDecay(0.32)
        .on("tick", () => {
          for (const node of simulationNodes) {
            const boundedX = clampCoordinate(node.x);
            const boundedY = clampCoordinate(node.y);
            if (boundedX !== node.x) node.vx = -(node.vx ?? 0) * 0.2;
            if (boundedY !== node.y) node.vy = -(node.vy ?? 0) * 0.2;
            node.x = boundedX;
            node.y = boundedY;
          }
          if (frameRef.current === undefined) {
            frameRef.current = window.requestAnimationFrame(publishPositions);
          }
        })
        .on("end", () => {
          publishPositions();
          setIsSettled(true);
        });

      simulationRef.current = simulation;
      setIsReady(true);
    });

    return () => {
      cancelled = true;
      simulationRef.current?.stop();
      simulationRef.current = undefined;
      nodesByIdRef.current = new Map();
      if (frameRef.current !== undefined) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = undefined;
      }
    };
  }, [topologyKey]);

  const startDragging = useCallback((
    documentId: string,
    position: GraphPosition,
  ) => {
    const node = nodesByIdRef.current.get(documentId);
    if (!node) return;
    node.fx = clampCoordinate(position.x);
    node.fy = clampCoordinate(position.y);
    simulationRef.current?.alphaTarget(0.22).restart();
    setIsSettled(false);
    setDraggingDocumentId(documentId);
  }, []);

  const moveDragging = useCallback((
    documentId: string,
    position: GraphPosition,
  ) => {
    const node = nodesByIdRef.current.get(documentId);
    if (!node) return;
    node.fx = clampCoordinate(position.x);
    node.fy = clampCoordinate(position.y);
  }, []);

  const stopDragging = useCallback((documentId: string) => {
    const node = nodesByIdRef.current.get(documentId);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
    simulationRef.current?.alphaTarget(0);
    setDraggingDocumentId((currentDocumentId) =>
      currentDocumentId === documentId ? undefined : currentDocumentId);
  }, []);

  return {
    draggingDocumentId,
    isReady,
    isSettled,
    moveDragging,
    positionsByDocumentId,
    startDragging,
    stopDragging,
  };
};
