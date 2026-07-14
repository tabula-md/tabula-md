import type { ButtonHTMLAttributes } from "react";

type ResizeHandleProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "aria-orientation" | "aria-valuemax" | "aria-valuemin" | "aria-valuenow" | "type"
> & {
  className?: string;
  dragging?: boolean;
  label: string;
  maximum: number;
  minimum: number;
  value: number;
};

export function ResizeHandle({
  className = "",
  dragging = false,
  label,
  maximum,
  minimum,
  value,
  ...props
}: ResizeHandleProps) {
  return (
    <button
      {...props}
      className={`vertical-resize-handle ${className}`.trim()}
      type="button"
      data-dragging={dragging ? "true" : undefined}
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={minimum}
      aria-valuemax={maximum}
      aria-valuenow={value}
    />
  );
}
