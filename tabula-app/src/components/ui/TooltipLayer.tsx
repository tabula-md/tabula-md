import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TooltipState = {
  placement: "above" | "below";
  text: string;
  x: number;
  y: number;
};

const tooltipDelayMs = 500;
const tooltipHalfWidth = 124;
const viewportPadding = 12;

const getTooltipTarget = (target: EventTarget | null) =>
  target instanceof Element
    ? target.closest<HTMLElement>("[data-tooltip]:not([data-tooltip=''])")
    : null;

const readTooltipState = (target: HTMLElement): TooltipState | null => {
  const text = target.dataset.tooltip?.trim();
  if (!text) return null;

  const rect = target.getBoundingClientRect();
  const x = Math.min(
    window.innerWidth - tooltipHalfWidth - viewportPadding,
    Math.max(tooltipHalfWidth + viewportPadding, rect.left + rect.width / 2),
  );
  const placement = rect.bottom + 44 <= window.innerHeight ? "below" : "above";

  return {
    placement,
    text,
    x,
    y: placement === "below" ? rect.bottom + 8 : rect.top - 8,
  };
};

export function TooltipLayer() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const timerRef = useRef<number | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current === null) return;
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    const hide = () => {
      clearTimer();
      targetRef.current = null;
      setTooltip(null);
    };
    const show = (target: HTMLElement, delay: number) => {
      clearTimer();
      targetRef.current = target;
      const reveal = () => {
        if (targetRef.current !== target || !target.isConnected) return;
        setTooltip(readTooltipState(target));
      };
      if (delay === 0) reveal();
      else timerRef.current = window.setTimeout(reveal, delay);
    };
    const handlePointerOver = (event: PointerEvent) => {
      const target = getTooltipTarget(event.target);
      if (!target || target === targetRef.current) return;
      show(target, tooltipDelayMs);
    };
    const handlePointerOut = (event: PointerEvent) => {
      const target = targetRef.current;
      if (!target) return;
      const relatedTarget = event.relatedTarget;
      if (relatedTarget instanceof Node && target.contains(relatedTarget)) return;
      hide();
    };
    const handleFocusIn = (event: FocusEvent) => {
      const target = getTooltipTarget(event.target);
      if (target) show(target, 0);
    };
    const handleFocusOut = (event: FocusEvent) => {
      const target = targetRef.current;
      if (!target) return;
      const relatedTarget = event.relatedTarget;
      if (relatedTarget instanceof Node && target.contains(relatedTarget)) return;
      hide();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };

    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("pointerout", handlePointerOut, true);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", handleFocusOut, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);

    return () => {
      clearTimer();
      document.removeEventListener("pointerover", handlePointerOver, true);
      document.removeEventListener("pointerout", handlePointerOut, true);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("focusout", handleFocusOut, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);

  if (!tooltip) return null;

  return createPortal(
    <div
      className={`app-tooltip ${tooltip.placement}`}
      role="tooltip"
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      {tooltip.text}
    </div>,
    document.body,
  );
}
