import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export const DEFAULT_SIDE_PANEL_WIDTH = 288;
export const MIN_SIDE_PANEL_WIDTH = 240;
export const MAX_SIDE_PANEL_WIDTH = 480;
const SIDE_PANEL_WIDTH_STEP = 16;
const MIN_WORKBENCH_WIDTH = 360;

export const getMaximumSidePanelWidth = (viewportWidth: number) =>
  Math.max(
    MIN_SIDE_PANEL_WIDTH,
    Math.min(MAX_SIDE_PANEL_WIDTH, viewportWidth - MIN_WORKBENCH_WIDTH),
  );

export const clampSidePanelWidth = (width: number, viewportWidth: number) =>
  Math.round(
    Math.min(
      getMaximumSidePanelWidth(viewportWidth),
      Math.max(MIN_SIDE_PANEL_WIDTH, width),
    ),
  );

type SidePanelDividerProps = {
  label: string;
  width: number;
  onWidthChange: (width: number) => void;
};

export function SidePanelDivider({
  label,
  width,
  onWidthChange,
}: SidePanelDividerProps) {
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
  const maximumWidth = getMaximumSidePanelWidth(viewportWidth);
  const resizeFromPointer = (clientX: number) => {
    onWidthChange(clampSidePanelWidth(viewportWidth - clientX, viewportWidth));
  };
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeFromPointer(event.clientX);
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    resizeFromPointer(event.clientX);
  };
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? 1 : -1;
    onWidthChange(
      clampSidePanelWidth(
        width + direction * SIDE_PANEL_WIDTH_STEP,
        viewportWidth,
      ),
    );
  };

  return (
    <div
      className="vertical-resize-handle side-panel-divider"
      data-dragging={dragging ? "true" : undefined}
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={MIN_SIDE_PANEL_WIDTH}
      aria-valuemax={maximumWidth}
      aria-valuenow={width}
      tabIndex={0}
      onDoubleClick={() => onWidthChange(DEFAULT_SIDE_PANEL_WIDTH)}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
