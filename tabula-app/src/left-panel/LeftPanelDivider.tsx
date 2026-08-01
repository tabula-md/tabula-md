import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ResizeHandle } from "../ui/ResizeHandle";
import {
  clampRightPanelWidth,
  DEFAULT_RIGHT_PANEL_WIDTH,
  MIN_RIGHT_PANEL_WIDTH,
} from "../right-panel/RightPanelDivider";

const LEFT_PANEL_WIDTH_STEP = 16;

type LeftPanelDividerProps = {
  label: string;
  width: number;
  onWidthChange: (width: number) => void;
};

export function LeftPanelDivider({
  label,
  width,
  onWidthChange,
}: LeftPanelDividerProps) {
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
  const maximumWidth = Math.max(MIN_RIGHT_PANEL_WIDTH, viewportWidth - 360);
  const resizeFromPointer = (clientX: number) => {
    onWidthChange(clampRightPanelWidth(clientX, viewportWidth));
  };
  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    draggingRef.current = true;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeFromPointer(event.clientX);
  };
  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (draggingRef.current) resizeFromPointer(event.clientX);
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
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    onWidthChange(clampRightPanelWidth(
      width + direction * LEFT_PANEL_WIDTH_STEP,
      viewportWidth,
    ));
  };

  return (
    <ResizeHandle
      className="left-panel-divider"
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
