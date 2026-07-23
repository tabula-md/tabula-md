import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ResizeHandle } from "../ui/ResizeHandle";

export const DEFAULT_RIGHT_PANEL_WIDTH = 288;
export const MIN_RIGHT_PANEL_WIDTH = 240;
const RIGHT_PANEL_WIDTH_STEP = 16;
const MIN_WORKBENCH_WIDTH = 360;

export const getMaximumRightPanelWidth = (viewportWidth: number) =>
  Math.max(MIN_RIGHT_PANEL_WIDTH, viewportWidth - MIN_WORKBENCH_WIDTH);

export const clampRightPanelWidth = (width: number, viewportWidth: number) =>
  Math.round(
    Math.min(
      getMaximumRightPanelWidth(viewportWidth),
      Math.max(MIN_RIGHT_PANEL_WIDTH, width),
    ),
  );

type RightPanelDividerProps = {
  label: string;
  width: number;
  onWidthChange: (width: number) => void;
};

export function RightPanelDivider({
  label,
  width,
  onWidthChange,
}: RightPanelDividerProps) {
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
  const maximumWidth = getMaximumRightPanelWidth(viewportWidth);
  const resizeFromPointer = (clientX: number) => {
    onWidthChange(clampRightPanelWidth(viewportWidth - clientX, viewportWidth));
  };
  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    draggingRef.current = true;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeFromPointer(event.clientX);
  };
  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    resizeFromPointer(event.clientX);
  };
  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    draggingRef.current = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? 1 : -1;
    onWidthChange(
      clampRightPanelWidth(
        width + direction * RIGHT_PANEL_WIDTH_STEP,
        viewportWidth,
      ),
    );
  };

  return (
    <ResizeHandle
      className="right-panel-divider"
      dragging={dragging}
      label={label}
      minimum={MIN_RIGHT_PANEL_WIDTH}
      maximum={maximumWidth}
      value={width}
      onDoubleClick={() => onWidthChange(DEFAULT_RIGHT_PANEL_WIDTH)}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
