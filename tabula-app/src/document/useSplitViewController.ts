import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  clampSplitEditorRatio,
  DEFAULT_SPLIT_EDITOR_RATIO,
  MAX_SPLIT_EDITOR_RATIO,
  MIN_SPLIT_EDITOR_RATIO,
  type FileViewMode,
} from "@tabula-md/tabula";
import { useWorkspaceUiStore } from "../stores/workspaceUiStore";

const SPLIT_RESIZE_KEYBOARD_STEP = 0.02;
const SPLIT_CENTER_SNAP_THRESHOLD = 0.025;

export const getMagnetizedSplitRatio = (nextSplitRatio: number) => {
  const clampedRatio = clampSplitEditorRatio(nextSplitRatio);
  return Math.abs(clampedRatio - DEFAULT_SPLIT_EDITOR_RATIO) <= SPLIT_CENTER_SNAP_THRESHOLD
    ? DEFAULT_SPLIT_EDITOR_RATIO
    : clampedRatio;
};

type UseSplitViewControllerOptions = {
  activeViewMode: FileViewMode;
  activeSplitRatio: number;
  workspaceRef: RefObject<HTMLElement | null>;
  editorSurfaceRef: RefObject<HTMLElement | null>;
  onSetSplitRatio: (nextSplitRatio: number) => void;
};

export function useSplitViewController({
  activeViewMode,
  activeSplitRatio,
  workspaceRef,
  editorSurfaceRef,
  onSetSplitRatio,
}: UseSplitViewControllerOptions) {
  const splitDividerDragging = useWorkspaceUiStore((state) => state.splitDragging);
  const setSplitDividerDragging = useWorkspaceUiStore((state) => state.setSplitDragging);
  const dragFrameRef = useRef<number | null>(null);
  const dragWorkspaceLeftRef = useRef(0);
  const dragWorkspaceWidthRef = useRef(0);
  const dragSplitRatioRef = useRef(activeSplitRatio);
  const splitDividerDraggingRef = useRef(false);
  const splitResizeBiasRef = useRef(0);
  const splitWorkspaceStyle =
    activeViewMode === "split"
      ? ({
          "--split-editor-ratio": `${activeSplitRatio * 100}%`,
          "--split-preview-ratio": `${(1 - activeSplitRatio) * 100}%`,
        } as CSSProperties)
      : undefined;
  const splitDividerValue = Math.round(activeSplitRatio * 100);

  useEffect(() => {
    dragSplitRatioRef.current = activeSplitRatio;
  }, [activeSplitRatio]);

  useEffect(
    () => () => {
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!splitDividerDragging) {
      return undefined;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [splitDividerDragging]);

  const applySplitRatioToWorkspace = (nextSplitRatio: number) => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }

    workspace.style.setProperty("--split-editor-ratio", `${nextSplitRatio * 100}%`);
    workspace.style.setProperty("--split-preview-ratio", `${(1 - nextSplitRatio) * 100}%`);
  };

  const scheduleSplitRatioPaint = (nextSplitRatio: number) => {
    dragSplitRatioRef.current = nextSplitRatio;
    if (dragFrameRef.current !== null) {
      return;
    }

    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      applySplitRatioToWorkspace(dragSplitRatioRef.current);
    });
  };

  const setDividerAriaValue = (divider: HTMLButtonElement, nextSplitRatio: number) => {
    divider.setAttribute("aria-valuenow", String(Math.round(nextSplitRatio * 100)));
  };

  const commitSplitRatio = (nextSplitRatio: number) => {
    const splitRatio = clampSplitEditorRatio(nextSplitRatio);
    dragSplitRatioRef.current = splitRatio;
    applySplitRatioToWorkspace(splitRatio);
    onSetSplitRatio(splitRatio);
  };

  const getCurrentSplitBias = () => {
    const workspaceRect = workspaceRef.current?.getBoundingClientRect();
    const editorRect = editorSurfaceRef.current?.getBoundingClientRect();
    if (!workspaceRect || !editorRect || workspaceRect.width <= 0) {
      return 0;
    }

    return editorRect.width - activeSplitRatio * workspaceRect.width;
  };

  const beginSplitDrag = () => {
    const workspaceRect = workspaceRef.current?.getBoundingClientRect();
    if (!workspaceRect || workspaceRect.width <= 0) {
      return false;
    }

    dragWorkspaceLeftRef.current = workspaceRect.left;
    dragWorkspaceWidthRef.current = workspaceRect.width;
    splitResizeBiasRef.current = getCurrentSplitBias();
    dragSplitRatioRef.current = activeSplitRatio;
    return true;
  };

  const getSplitRatioFromClientX = (clientX: number) => {
    const workspaceWidth = dragWorkspaceWidthRef.current;
    if (workspaceWidth <= 0) {
      return null;
    }

    const nextSplitRatio =
      (clientX - dragWorkspaceLeftRef.current - splitResizeBiasRef.current) / workspaceWidth;
    return getMagnetizedSplitRatio(nextSplitRatio);
  };

  const updateSplitRatioFromClientX = (clientX: number) => {
    const splitRatio = getSplitRatioFromClientX(clientX);
    if (splitRatio === null) {
      return null;
    }

    scheduleSplitRatioPaint(splitRatio);
    return splitRatio;
  };

  const handleSplitDividerPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (activeViewMode !== "split" || event.button !== 0) {
      return;
    }

    event.preventDefault();
    if (!beginSplitDrag()) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    splitDividerDraggingRef.current = true;
    setSplitDividerDragging(true);
    const splitRatio = updateSplitRatioFromClientX(event.clientX);
    if (splitRatio !== null) {
      setDividerAriaValue(event.currentTarget, splitRatio);
    }
  };

  const handleSplitDividerPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!splitDividerDraggingRef.current) {
      return;
    }

    event.preventDefault();
    const splitRatio = updateSplitRatioFromClientX(event.clientX);
    if (splitRatio !== null) {
      setDividerAriaValue(event.currentTarget, splitRatio);
    }
  };

  const endSplitDividerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!splitDividerDraggingRef.current) {
      return;
    }

    splitDividerDraggingRef.current = false;
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    commitSplitRatio(dragSplitRatioRef.current);
    setDividerAriaValue(event.currentTarget, dragSplitRatioRef.current);
    setSplitDividerDragging(false);
  };

  const handleSplitDividerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commitSplitRatio(DEFAULT_SPLIT_EDITOR_RATIO);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      commitSplitRatio(activeSplitRatio - SPLIT_RESIZE_KEYBOARD_STEP);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      commitSplitRatio(activeSplitRatio + SPLIT_RESIZE_KEYBOARD_STEP);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      commitSplitRatio(MIN_SPLIT_EDITOR_RATIO);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      commitSplitRatio(MAX_SPLIT_EDITOR_RATIO);
    }
  };

  return {
    splitDividerDragging,
    splitDividerMinValue: Math.round(MIN_SPLIT_EDITOR_RATIO * 100),
    splitDividerMaxValue: Math.round(MAX_SPLIT_EDITOR_RATIO * 100),
    splitDividerValue,
    splitWorkspaceStyle,
    resetSplitRatio: () => commitSplitRatio(DEFAULT_SPLIT_EDITOR_RATIO),
    handleSplitDividerKeyDown,
    handleSplitDividerPointerDown,
    handleSplitDividerPointerMove,
    endSplitDividerDrag,
  };
}
