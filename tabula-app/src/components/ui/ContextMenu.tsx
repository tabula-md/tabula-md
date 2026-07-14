import * as RadixContextMenu from "@radix-ui/react-context-menu";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export const ContextMenuRoot = RadixContextMenu.Root;
export const ContextMenuTrigger = RadixContextMenu.Trigger;

type ContextMenuContentProps = ComponentPropsWithoutRef<typeof RadixContextMenu.Content> & {
  ariaLabel: string;
};

export function ContextMenuContent({
  ariaLabel,
  children,
  className = "",
  collisionPadding = 8,
  ...props
}: ContextMenuContentProps) {
  return (
    <RadixContextMenu.Portal>
      <RadixContextMenu.Content
        {...props}
        aria-label={ariaLabel}
        className={`ui-menu ui-command-menu ${className}`.trim()}
        collisionPadding={collisionPadding}
      >
        {children}
      </RadixContextMenu.Content>
    </RadixContextMenu.Portal>
  );
}

type ContextMenuItemProps = ComponentPropsWithoutRef<typeof RadixContextMenu.Item> & {
  danger?: boolean;
  icon?: ReactNode;
  label: string;
};

export function ContextMenuItem({
  className = "",
  danger = false,
  icon,
  label,
  ...props
}: ContextMenuItemProps) {
  return (
    <RadixContextMenu.Item
      {...props}
      className={`ui-command-menu-item ${danger ? "danger" : ""} ${className}`.trim()}
    >
      <span className="ui-command-menu-icon" aria-hidden="true">{icon}</span>
      <span className="ui-command-menu-label">{label}</span>
    </RadixContextMenu.Item>
  );
}
