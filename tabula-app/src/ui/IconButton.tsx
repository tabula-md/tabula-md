import type { ButtonHTMLAttributes, ReactNode } from "react";

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children" | "type"
> & {
  children: ReactNode;
  label: string;
  tooltip?: string;
};

export function IconButton({
  children,
  className = "",
  label,
  tooltip = label,
  ...buttonProps
}: IconButtonProps) {
  return (
    <button
      {...buttonProps}
      className={`ui-icon-button ${className}`.trim()}
      type="button"
      aria-label={label}
      data-tooltip={tooltip}
    >
      {children}
    </button>
  );
}
