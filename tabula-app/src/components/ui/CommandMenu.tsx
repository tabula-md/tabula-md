import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";

type CommandMenuProps = HTMLAttributes<HTMLDivElement> & {
  ariaLabel: string;
};

export const CommandMenu = forwardRef<HTMLDivElement, CommandMenuProps>(
  ({ ariaLabel, children, className = "", ...props }, ref) => (
    <div
      {...props}
      ref={ref}
      className={`ui-menu ui-command-menu ${className}`.trim()}
      role="menu"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  ),
);

CommandMenu.displayName = "CommandMenu";

type CommandMenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  danger?: boolean;
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
};

export function CommandMenuItem({
  className = "",
  danger = false,
  icon,
  label,
  trailing,
  ...props
}: CommandMenuItemProps) {
  return (
    <button
      {...props}
      className={`ui-command-menu-item ${danger ? "danger" : ""} ${className}`.trim()}
      type={props.type ?? "button"}
      role={props.role ?? "menuitem"}
    >
      <span className="ui-command-menu-icon" aria-hidden="true">{icon}</span>
      <span className="ui-command-menu-label">{label}</span>
      {trailing && <span className="ui-command-menu-trailing">{trailing}</span>}
    </button>
  );
}
