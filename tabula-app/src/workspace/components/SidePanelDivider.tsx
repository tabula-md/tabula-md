import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ResizeHandle } from "../../ui/ResizeHandle";
import {
  clampSidePanelWidth,
  DEFAULT_SIDE_PANEL_WIDTH,
  getMaximumSidePanelWidth,
  MIN_SIDE_PANEL_WIDTH,
  type SidePanelSide,
} from "./sidePanelModel";

const SIDE_PANEL_WIDTH_STEP = 16;

type SidePanelDividerProps = {
  label: string;
  onWidthChange: (width: number) => void;
  side: SidePanelSide;
  width: number;
};

export function SidePanelDivider({
  label,
  onWidthChange,
  side,
  width,
}: SidePanelDividerProps) {
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
  const maximumWidth = getMaximumSidePanelWidth(viewportWidth);
  const widthFromPointer = (clientX: number) => side === "left"
    ? clientX
    : viewportWidth - clientX;
  const resizeFromPointer = (clientX: number) => {
    onWidthChange(clampSidePanelWidth(widthFromPointer(clientX), viewportWidth));
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
    const physicalDirection = event.key === "ArrowLeft" ? -1 : 1;
    const panelDirection = side === "left" ? physicalDirection : -physicalDirection;
    onWidthChange(clampSidePanelWidth(
      width + panelDirection * SIDE_PANEL_WIDTH_STEP,
      viewportWidth,
    ));
  };

  return (
    <ResizeHandle
      className={`${side}-panel-divider`}
      dragging={dragging}
      label={label}
      minimum={MIN_SIDE_PANEL_WIDTH}
      maximum={maximumWidth}
      value={width}
      onDoubleClick={() => onWidthChange(DEFAULT_SIDE_PANEL_WIDTH)}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
